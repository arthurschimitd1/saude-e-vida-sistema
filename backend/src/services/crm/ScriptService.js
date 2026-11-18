import CrmScript from '../../models/CrmScript.js';
import { gerarScripts } from './GeminiService.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../../utils/empresaScope.js';

class ScriptService {
    async listar({ campaign_id, script_type } = {}, user) {
        const where = {};
        aplicarEmpresaScope(where, user);
        if (campaign_id) where.campaign_id = campaign_id;
        if (script_type) where.script_type = script_type;
        return CrmScript.findAll({ where, order: [['created_at', 'DESC']] });
    }

    async criar(data, user) {
        const empresa_id = empresaParaGravar(user);
        return CrmScript.create({ ...data, empresa_id });
    }

    async atualizar(id, data, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const [updated] = await CrmScript.update(data, { where });
        if (!updated) throw new Error('Script não encontrado');
        return CrmScript.findOne({ where: { id } });
    }

    async deletar(id, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const deleted = await CrmScript.destroy({ where });
        if (!deleted) throw new Error('Script não encontrado');
        return { success: true };
    }

    /**
     * Gera variações via Gemini e opcionalmente salva no banco.
     */
    async gerar({ segment, product, objective, script_type, variacoes, campaign_id, salvar }, user) {
        const scripts = await gerarScripts({ segment, product, objective, script_type, variacoes });

        if (salvar && campaign_id) {
            const empresa_id = empresaParaGravar(user);
            const criados = await Promise.all(
                scripts.map(s =>
                    CrmScript.create({
                        campaign_id,
                        empresa_id,
                        title: s.titulo,
                        content: s.conteudo,
                        script_type: script_type ?? 'primeiro_contato'
                    })
                )
            );
            return criados;
        }

        return scripts;
    }
}

export default new ScriptService();
