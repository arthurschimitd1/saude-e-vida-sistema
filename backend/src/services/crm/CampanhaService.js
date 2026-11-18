import CrmCampanha from '../../models/CrmCampanha.js';
import CrmProspect from '../../models/CrmProspect.js';
import CrmCampanhaFiltro from '../../models/CrmCampanhaFiltro.js';
import { buscarEmpresas, buscarDetalhes } from './SerperService.js';
import { calcularLeadScore } from './LeadScoreService.js';
import { parsearPlanilha } from './PlanilhaImportService.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../../utils/empresaScope.js';
import sequelize from '../../config/database.js';
import { Op } from 'sequelize';

class CampanhaService {
    async listar(user) {
        const where = {};
        aplicarEmpresaScope(where, user);
        return CrmCampanha.findAll({
            where,
            order: [['created_at', 'DESC']]
        });
    }

    async buscarPorId(id, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const campanha = await CrmCampanha.findOne({ where });
        if (!campanha) throw new Error('Campanha não encontrada');
        return campanha;
    }

    async criar(data, user) {
        const empresa_id = empresaParaGravar(user);
        return CrmCampanha.create({
            ...data,
            empresa_id,
            created_by: user?.id ?? null
        });
    }

    async atualizar(id, data, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const [updated] = await CrmCampanha.update(data, { where });
        if (!updated) throw new Error('Campanha não encontrada');
        return this.buscarPorId(id, user);
    }

    async deletar(id, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const deleted = await CrmCampanha.destroy({ where });
        if (!deleted) throw new Error('Campanha não encontrada');
        return { success: true };
    }

    /**
     * Busca empresas via Google Places e salva como prospects da campanha.
     * Enriquece detalhes (telefone, site) em paralelo, limita a 20 places por chamada.
     */
    async buscarEmpresasGooglePlaces(campanhaId, { segment, city, state, radius, pagetoken, limit }, user) {
        const campanha = await this.buscarPorId(campanhaId, user);
        const empresa_id = empresaParaGravar(user);

        const { empresas, next_page_token } = await buscarEmpresas({
            segment: segment ?? campanha.segment,
            city,
            state,
            radius: radius ?? campanha.radius,
            pagetoken,
            limit,
        });

        const transaction = await sequelize.transaction();
        try {
            const prospects = [];

            for (const emp of empresas) {
                // Evita duplicata pelo google_place_id dentro da mesma campanha
                const existe = emp.google_place_id
                    ? await CrmProspect.findOne({
                        where: { campaign_id: campanhaId, google_place_id: emp.google_place_id },
                        transaction
                    })
                    : null;
                if (existe) continue;

                // Busca detalhes (telefone/site) pelo place_id
                let detalhes = {};
                if (emp.google_place_id) {
                    detalhes = (await buscarDetalhes(emp.google_place_id)) ?? {};
                }

                const prospectData = { ...emp, ...detalhes, campaign_id: campanhaId, empresa_id };
                prospectData.lead_score = calcularLeadScore(prospectData);

                const prospect = await CrmProspect.create(prospectData, { transaction });
                prospects.push(prospect);
            }

            await transaction.commit();
            return { salvos: prospects.length, next_page_token };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    /**
     * Importa prospects a partir de uma planilha (.xlsx/.xls/.csv) e salva na campanha.
     * Faz dedupe por telefone, e-mail ou nome da empresa já existentes na mesma campanha.
     */
    async importarProspectsPlanilha(campanhaId, fileBuffer, user) {
        const campanha = await this.buscarPorId(campanhaId, user);
        const empresa_id = empresaParaGravar(user);

        const { linhas, total, truncado } = parsearPlanilha(fileBuffer);

        const existentes = await CrmProspect.findAll({
            where: { campaign_id: campanha.id },
            attributes: ['phone', 'email', 'company_name'],
            raw: true,
        });
        const telefonesExistentes = new Set(existentes.map(e => e.phone).filter(Boolean));
        const emailsExistentes    = new Set(existentes.map(e => e.email?.toLowerCase()).filter(Boolean));
        const nomesExistentes     = new Set(existentes.map(e => e.company_name?.toLowerCase().trim()).filter(Boolean));

        const transaction = await sequelize.transaction();
        try {
            let importados = 0;
            let ignorados  = 0;

            for (const linha of linhas) {
                const telefone = linha.phone;
                const email    = linha.email?.toLowerCase();
                const nome     = linha.company_name.toLowerCase().trim();

                const duplicado =
                    (telefone && telefonesExistentes.has(telefone)) ||
                    (email && emailsExistentes.has(email)) ||
                    (!telefone && !email && nomesExistentes.has(nome));

                if (duplicado) {
                    ignorados++;
                    continue;
                }

                const prospectData = { ...linha, campaign_id: campanha.id, empresa_id };
                prospectData.lead_score = calcularLeadScore(prospectData);

                await CrmProspect.create(prospectData, { transaction });
                importados++;

                if (telefone) telefonesExistentes.add(telefone);
                if (email) emailsExistentes.add(email);
                nomesExistentes.add(nome);
            }

            await transaction.commit();
            return { importados, ignorados, total, truncado };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }
}

export default new CampanhaService();
