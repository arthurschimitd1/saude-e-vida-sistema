import CrmCampanha from '../../models/CrmCampanha.js';
import CrmProspect from '../../models/CrmProspect.js';
import { aplicarEmpresaScope } from '../../utils/empresaScope.js';
import sequelize from '../../config/database.js';
import { Op } from 'sequelize';

class DashboardService {
    async obterIndicadores(user) {
        const where = {};
        aplicarEmpresaScope(where, user);

        const [
            totalCampanhas,
            totalLeads,
            leadsQuentes,
            reunioesMarcadas,
            propostasEnviadas,
            fechados,
            perdidos,
            leadsPorCidade,
            leadsPorSegmento,
        ] = await Promise.all([
            CrmCampanha.count({ where }),
            CrmProspect.count({ where }),
            CrmProspect.count({ where: { ...where, lead_score: { [Op.gte]: 61 } } }),
            CrmProspect.count({ where: { ...where, status: 'Reunião Marcada' } }),
            CrmProspect.count({ where: { ...where, status: 'Proposta Enviada' } }),
            CrmProspect.count({ where: { ...where, status: 'Fechado' } }),
            CrmProspect.count({ where: { ...where, status: 'Perdido' } }),
            this.agruparPorCampo('city', where),
            this.agruparPorSegmento(where),
        ]);

        const taxaConversao = totalLeads > 0
            ? ((fechados / totalLeads) * 100).toFixed(1)
            : '0.0';

        return {
            campanhas: totalCampanhas,
            leads_total: totalLeads,
            leads_quentes: leadsQuentes,
            reunioes_marcadas: reunioesMarcadas,
            propostas_enviadas: propostasEnviadas,
            fechados,
            perdidos,
            taxa_conversao: Number(taxaConversao),
            leads_por_cidade: leadsPorCidade,
            leads_por_segmento: leadsPorSegmento,
        };
    }

    async agruparPorCampo(campo, where) {
        try {
            const rows = await CrmProspect.findAll({
                where,
                attributes: [campo, [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
                group: [campo],
                order: [[sequelize.literal('total'), 'DESC']],
                limit: 10,
                raw: true
            });
            return rows.map(r => ({ label: r[campo] ?? 'Não informado', value: Number(r.total) }));
        } catch {
            return [];
        }
    }

    async agruparPorSegmento(where) {
        try {
            const campanha_ids_rows = await CrmProspect.findAll({
                where,
                attributes: ['campaign_id', [sequelize.fn('COUNT', sequelize.col('CrmProspect.id')), 'total']],
                group: ['campaign_id'],
                order: [[sequelize.literal('total'), 'DESC']],
                limit: 10,
                raw: true
            });

            const ids = campanha_ids_rows.map(r => r.campaign_id).filter(Boolean);
            if (!ids.length) return [];

            const campanhas = await CrmCampanha.findAll({
                where: { id: ids },
                attributes: ['id', 'segment'],
                raw: true
            });

            const segMap = {};
            campanhas.forEach(c => { segMap[c.id] = c.segment ?? 'Sem segmento'; });

            return campanha_ids_rows.map(r => ({
                label: segMap[r.campaign_id] ?? 'Sem segmento',
                value: Number(r.total)
            }));
        } catch {
            return [];
        }
    }
}

export default new DashboardService();
