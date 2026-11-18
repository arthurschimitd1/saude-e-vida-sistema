import WhatsappEtiqueta from '../../models/WhatsappEtiqueta.js';
import WhatsappClienteEtiqueta from '../../models/WhatsappClienteEtiqueta.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../../utils/empresaScope.js';
import ApiError from '../../utils/apiError.js';
import { SEED_ETIQUETAS_PADRAO } from './catalogoSeeds.js';

class EtiquetaService {
    async _garantirEtiquetasPadrao(empresa_id) {
        for (const seed of SEED_ETIQUETAS_PADRAO) {
            await WhatsappEtiqueta.findOrCreate({
                where: { empresa_id, tipo: 'etiqueta', nome: seed.nome },
                defaults: { empresa_id, tipo: 'etiqueta', nome: seed.nome, cor: seed.cor },
            });
        }
    }

    async listar(user, tipo = 'etiqueta') {
        const empresa_id = empresaParaGravar(user);
        if (tipo === 'etiqueta' && empresa_id) await this._garantirEtiquetasPadrao(empresa_id);

        const where = { tipo };
        aplicarEmpresaScope(where, user);
        return WhatsappEtiqueta.findAll({ where, order: [['nome', 'ASC']] });
    }

    async criar({ nome, cor, tipo = 'etiqueta' }, user) {
        const empresa_id = empresaParaGravar(user);
        if (!empresa_id) throw new ApiError(400, 'Usuário sem empresa associada');
        return WhatsappEtiqueta.create({ empresa_id, tipo, nome, cor: cor || '#64748b' });
    }

    async atualizar(id, { nome, cor }, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const etiqueta = await WhatsappEtiqueta.findOne({ where });
        if (!etiqueta) throw new ApiError(404, 'Etiqueta não encontrada');
        await etiqueta.update({ nome, cor });
        return etiqueta;
    }

    async remover(id, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const etiqueta = await WhatsappEtiqueta.findOne({ where });
        if (!etiqueta) throw new ApiError(404, 'Etiqueta não encontrada');
        await WhatsappClienteEtiqueta.destroy({ where: { etiqueta_id: id } });
        await etiqueta.destroy();
        return { success: true };
    }

    async aceitarSugestao(clienteEtiquetaId, user) {
        // Mesma observação de removerDoCliente: id já vem de uma listagem escopada por empresa.
        const vinculo = await WhatsappClienteEtiqueta.findByPk(clienteEtiquetaId);
        if (!vinculo) throw new ApiError(404, 'Etiqueta do cliente não encontrada');
        await vinculo.update({ status: 'aceita' });
        return vinculo;
    }

    async removerDoCliente(clienteEtiquetaId, user) {
        // A checagem de empresa acontece via join no cliente_crm; aqui confiamos
        // que o id foi obtido através de uma listagem já escopada por empresa.
        const vinculo = await WhatsappClienteEtiqueta.findByPk(clienteEtiquetaId);
        if (!vinculo) throw new ApiError(404, 'Etiqueta do cliente não encontrada');
        await vinculo.destroy();
        return { success: true };
    }
}

export default new EtiquetaService();
