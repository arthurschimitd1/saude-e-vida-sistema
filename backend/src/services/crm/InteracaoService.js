import CrmInteracao from '../../models/CrmInteracao.js';
import CrmProspect from '../../models/CrmProspect.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../../utils/empresaScope.js';

class InteracaoService {
    async listarPorProspect(prospect_id, user) {
        // Verifica acesso ao prospect
        const prospectWhere = { id: prospect_id };
        aplicarEmpresaScope(prospectWhere, user);
        const prospect = await CrmProspect.findOne({ where: prospectWhere });
        if (!prospect) throw new Error('Prospect não encontrado');

        return CrmInteracao.findAll({
            where: { prospect_id },
            order: [['created_at', 'DESC']]
        });
    }

    async criar(data, user) {
        const empresa_id = empresaParaGravar(user);
        return CrmInteracao.create({
            ...data,
            user_id: user?.id ?? null,
            empresa_id
        });
    }

    async deletar(id, user) {
        const empresa_id = empresaParaGravar(user);
        const where = { id };
        if (empresa_id) where.empresa_id = empresa_id;

        const deleted = await CrmInteracao.destroy({ where });
        if (!deleted) throw new Error('Interação não encontrada');
        return { success: true };
    }
}

export default new InteracaoService();
