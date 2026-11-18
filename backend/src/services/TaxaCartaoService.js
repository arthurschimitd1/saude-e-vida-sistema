import { Op } from 'sequelize';
import TaxaCartao from '../models/TaxaCartao.js';
import { empresaParaGravar } from '../utils/empresaScope.js';
import { dinheiro } from './ComissaoCalculo.js';
import { businessDate } from '../utils/businessTime.js';

export const calcularValorTaxa = (bruto, percentual, fixa = 0) => {
    const valorBruto = dinheiro(bruto);
    const valorTaxa = dinheiro(valorBruto * Number(percentual || 0) / 100 + Number(fixa || 0));
    return {
        valor_bruto: valorBruto,
        valor_taxa: valorTaxa,
        valor_liquido: dinheiro(valorBruto - valorTaxa)
    };
};

const dadosPermitidos = data => ({
    adquirente: String(data.adquirente ?? '').trim(),
    bandeira: String(data.bandeira ?? '').trim().toLowerCase(),
    tipo_cartao: String(data.tipo_cartao ?? '').trim().toLowerCase(),
    parcelas_de: Number(data.parcelas_de ?? 1),
    parcelas_ate: Number(data.parcelas_ate ?? 1),
    percentual: Number(data.percentual ?? 0),
    taxa_fixa: Number(data.taxa_fixa ?? 0),
    vigencia_inicio: data.vigencia_inicio,
    vigencia_fim: data.vigencia_fim || null,
    ativo: data.ativo !== false
});

const validar = dados => {
    if (!dados.adquirente || !dados.bandeira || !['credito', 'debito'].includes(dados.tipo_cartao)) {
        throw new Error('Informe adquirente, bandeira e modalidade do cartão');
    }
    if (!Number.isInteger(dados.parcelas_de) || !Number.isInteger(dados.parcelas_ate)
        || dados.parcelas_de < 1 || dados.parcelas_ate < dados.parcelas_de) {
        throw new Error('Faixa de parcelas inválida');
    }
    if (!Number.isFinite(dados.percentual) || dados.percentual < 0 || dados.percentual > 100
        || !Number.isFinite(dados.taxa_fixa) || dados.taxa_fixa < 0) {
        throw new Error('Taxa inválida');
    }
    if (!dados.vigencia_inicio) throw new Error('A data inicial da vigência é obrigatória');
    if (dados.vigencia_fim && dados.vigencia_fim < dados.vigencia_inicio) {
        throw new Error('O fim da vigência não pode ser anterior ao início');
    }
};

const dataComercial = data => {
    if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
    return businessDate(data);
};

class TaxaCartaoService {
    exigirEmpresa(currentUser) {
        const empresaId = Number(empresaParaGravar(currentUser));
        if (!Number.isInteger(empresaId) || empresaId <= 0) {
            const error = new Error('Selecione uma empresa para consultar as taxas de cartão');
            error.status = 400;
            throw error;
        }
        return empresaId;
    }

    async listar(currentUser) {
        const where = { empresa_id: this.exigirEmpresa(currentUser) };
        return TaxaCartao.findAll({ where, order: [['adquirente', 'ASC'], ['bandeira', 'ASC'], ['parcelas_de', 'ASC']] });
    }

    async criar(data, currentUser) {
        const empresaId = this.exigirEmpresa(currentUser);
        const dados = dadosPermitidos(data);
        validar(dados);
        return TaxaCartao.create({ ...dados, empresa_id: empresaId });
    }

    async atualizar(id, data, currentUser) {
        const where = { id: Number(id), empresa_id: this.exigirEmpresa(currentUser) };
        const taxa = await TaxaCartao.findOne({ where });
        if (!taxa) throw new Error('Taxa não encontrada');
        const dados = dadosPermitidos({ ...taxa.toJSON(), ...data });
        validar(dados);
        return taxa.update(dados);
    }

    async aplicar(pagamento, empresaId, data = new Date()) {
        if (pagamento.forma !== 'CARTAO' || !pagamento.bandeira || !empresaId) return pagamento;
        const dia = dataComercial(data);
        const parcelas = Number(pagamento.parcelas || 1);
        const taxa = await TaxaCartao.findOne({
            where: {
                empresa_id: empresaId,
                ativo: true,
                bandeira: String(pagamento.bandeira).toLowerCase(),
                tipo_cartao: pagamento.tipoCartao,
                parcelas_de: { [Op.lte]: parcelas },
                parcelas_ate: { [Op.gte]: parcelas },
                vigencia_inicio: { [Op.lte]: dia },
                [Op.or]: [{ vigencia_fim: null }, { vigencia_fim: { [Op.gte]: dia } }]
            },
            order: [['vigencia_inicio', 'DESC'], ['id', 'DESC']]
        });
        const bruto = dinheiro(pagamento.valor);
        if (!taxa) return { ...pagamento, valor_bruto: bruto, valor_taxa: 0, valor_liquido: bruto };
        const calculo = calcularValorTaxa(bruto, taxa.percentual, taxa.taxa_fixa);
        return {
            ...pagamento,
            taxa_id: taxa.id,
            adquirente: taxa.adquirente,
            taxa_percentual: Number(taxa.percentual),
            taxa_fixa: Number(taxa.taxa_fixa),
            valor_bruto: calculo.valor_bruto,
            valor_taxa: calculo.valor_taxa,
            valor_liquido: calculo.valor_liquido
        };
    }
}

export default new TaxaCartaoService();
