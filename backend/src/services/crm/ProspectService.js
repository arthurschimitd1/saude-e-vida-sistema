import CrmProspect from '../../models/CrmProspect.js';
import CrmInteracao from '../../models/CrmInteracao.js';
import { calcularLeadScore } from './LeadScoreService.js';
import { enriquecerProspect } from './EnriquecimentoService.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../../utils/empresaScope.js';
import { Op } from 'sequelize';

class ProspectService {
    async listar({ campaign_id, status, search } = {}, user) {
        const where = {};
        aplicarEmpresaScope(where, user);
        if (campaign_id) where.campaign_id = campaign_id;
        if (status) where.status = status;
        if (search) {
            where[Op.or] = [
                { company_name: { [Op.iLike]: `%${search}%` } },
                { responsible_name: { [Op.iLike]: `%${search}%` } },
                { city: { [Op.iLike]: `%${search}%` } },
            ];
        }
        return CrmProspect.findAll({ where, order: [['lead_score', 'DESC'], ['created_at', 'DESC']] });
    }

    async buscarPorId(id, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const prospect = await CrmProspect.findOne({ where });
        if (!prospect) throw new Error('Prospect não encontrado');
        return prospect;
    }

    async criar(data, user) {
        const empresa_id = empresaParaGravar(user);
        const prospectData = { ...data, empresa_id };
        prospectData.lead_score = calcularLeadScore(prospectData);
        return CrmProspect.create(prospectData);
    }

    async atualizar(id, data, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const atual = await CrmProspect.findOne({ where });
        if (!atual) throw new Error('Prospect não encontrado');

        const prospectData = { ...atual.toJSON(), ...data };
        prospectData.lead_score = calcularLeadScore(prospectData);

        await CrmProspect.update(prospectData, { where });
        return CrmProspect.findOne({ where: { id } });
    }

    async atualizarStatus(id, status, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const [updated] = await CrmProspect.update({ status }, { where });
        if (!updated) throw new Error('Prospect não encontrado');

        // Registra a mudança de status como interação automática
        await CrmInteracao.create({
            prospect_id: id,
            user_id: user?.id ?? null,
            empresa_id: user?.empresa_id ?? null,
            interaction_type: 'status_change',
            content: `Status atualizado para: ${status}`
        });

        return CrmProspect.findOne({ where: { id } });
    }

    async deletar(id, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const deleted = await CrmProspect.destroy({ where });
        if (!deleted) throw new Error('Prospect não encontrado');
        return { success: true };
    }

    async enriquecer(id, user) {
        const prospect = await this.buscarPorId(id, user);
        const dados = await enriquecerProspect(prospect.toJSON());

        if (Object.keys(dados).length > 0) {
            await this.atualizar(id, dados, user);
        }

        return { enriched: Object.keys(dados), prospect: await this.buscarPorId(id, user) };
    }
}

export default new ProspectService();
