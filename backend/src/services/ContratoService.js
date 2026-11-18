import Contrato from '../models/Contrato.js';
import ContratoHistorico from '../models/ContratoHistorico.js';
import { Op } from 'sequelize';

class ContratoService {

    async createContrato(data, user) {
        const empresa_id = user?.empresa_id || user?.empresa_id_override;
        if (!empresa_id) throw { status: 400, message: 'empresa_id não encontrado no token' };
        const contrato = await Contrato.create({ ...data, empresa_id, criado_por: user?.id });
        return contrato;
    }

    async getAllContratos(filters, user) {
        const empresa_id = user?.empresa_id || user?.empresa_id_override;
        const where = { empresa_id };

        if (filters.status) where.status = filters.status;
        if (filters.tipo_contrato) where.tipo_contrato = filters.tipo_contrato;
        if (filters.responsavel_interno) where.responsavel_interno = { [Op.iLike]: `%${filters.responsavel_interno}%` };
        if (filters.search) where.titulo = { [Op.iLike]: `%${filters.search}%` };
        if (filters.data_vencimento_inicio && filters.data_vencimento_fim) {
            where.data_vencimento = {
                [Op.between]: [filters.data_vencimento_inicio, filters.data_vencimento_fim]
            };
        }

        return await Contrato.findAll({ where, order: [['created_at', 'DESC']] });
    }

    async getContratoById(id, user) {
        const empresa_id = user?.empresa_id || user?.empresa_id_override;
        const contrato = await Contrato.findOne({ where: { id, empresa_id } });
        if (!contrato) throw { status: 404, message: 'Contrato não encontrado' };
        return contrato;
    }

    async updateContrato(id, data, user) {
        const contrato = await this.getContratoById(id, user);

        if (contrato.status === 'encerrado') {
            throw { status: 403, message: 'Contratos encerrados não podem ser editados' };
        }

        const campos = Object.keys(data);
        const nomeCampo = {
            titulo: 'Título',
            partes_envolvidas: 'Partes Envolvidas',
            contratante: 'Contratante',
            contratado: 'Contratado(a)',
            tipo_parte: 'Contratado(a)/Contratante',
            tipo_contrato: 'Tipo de Contrato',
            valor: 'Valor',
            data_inicio: 'Data de Início',
            data_vencimento: 'Data de Vencimento',
            periodicidade: 'Periodicidade',
            status: 'Status',
            responsavel_interno: 'Responsável Interno',
            observacoes: 'Observações',
            corpo_contrato: 'Corpo do Contrato',
            observacoes_tipo: 'Especificação do Tipo',
        };

        const camposIgnorados = [
            'updated_at', 'created_at', 'updatedAt', 'createdAt',
            'empresa_id', 'criado_por', 'pdf_url', 'anexo_public_id'
        ];

        for (const campo of campos) {
            if (camposIgnorados.includes(campo)) continue;
            const valorAnterior = contrato[campo];
            const valorNovo = data[campo];
            if (String(valorAnterior) !== String(valorNovo)) {
                await ContratoHistorico.create({
                    contrato_id: id,
                    usuario_id: user?.id,
                    usuario_nome: user?.nome || user?.nomeCompleto,
                    campo_alterado: nomeCampo[campo] || campo,
                    valor_anterior: String(valorAnterior ?? ''),
                    valor_novo: String(valorNovo ?? '')
                });
            }
        }

        await contrato.update(data);
        return contrato;
    }

    async getHistorico(contrato_id, user) {
        await this.getContratoById(contrato_id, user);
        return await ContratoHistorico.findAll({
            where: { contrato_id },
            order: [['created_at', 'DESC']]
        });
    }
}

export default new ContratoService();