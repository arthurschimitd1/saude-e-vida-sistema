import CentroCusto from '../models/CentroCusto.js';
import CentroCustoDepartamento from '../models/CentroCustoDepartamento.js';
import CentroCustoProjeto from '../models/CentroCustoProjeto.js';
import RateioAutomatico from '../models/RateioAutomatico.js';
import ApiResponse from '../utils/apiResponse.js';
import sequelize from '../config/database.js';

// ─── Helper: resolve intervalo de datas pelo período ───────────────────────
function resolverPeriodo(periodo, dataInicio, dataFim) {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth();

    switch (periodo) {
        case 'trimestre':
            return {
                inicio: new Date(ano, mes - 2, 1),
                fim: new Date(ano, mes + 1, 0, 23, 59, 59),
                inicioPrev: new Date(ano, mes - 5, 1),
                fimPrev: new Date(ano, mes - 2, 0, 23, 59, 59),
            };
        case 'semestre':
            return {
                inicio: new Date(ano, mes - 5, 1),
                fim: new Date(ano, mes + 1, 0, 23, 59, 59),
                inicioPrev: new Date(ano, mes - 11, 1),
                fimPrev: new Date(ano, mes - 5, 0, 23, 59, 59),
            };
        case 'ano':
            return {
                inicio: new Date(ano, 0, 1),
                fim: new Date(ano, 11, 31, 23, 59, 59),
                inicioPrev: new Date(ano - 1, 0, 1),
                fimPrev: new Date(ano - 1, 11, 31, 23, 59, 59),
            };
        case 'personalizado':
            if (!dataInicio || !dataFim) throw { status: 400, message: 'data_inicio e data_fim são obrigatórios para período personalizado' };
            const ini = new Date(dataInicio);
            const fim_ = new Date(dataFim);
            fim_.setHours(23, 59, 59);
            const diff = fim_ - ini;
            return {
                inicio: ini,
                fim: fim_,
                inicioPrev: new Date(ini - diff),
                fimPrev: new Date(ini - 1),
            };
        default: // mes_atual
            return {
                inicio: new Date(ano, mes, 1),
                fim: new Date(ano, mes + 1, 0, 23, 59, 59),
                inicioPrev: new Date(ano, mes - 1, 1),
                fimPrev: new Date(ano, mes, 0, 23, 59, 59),
            };
    }
}

// ─── Helper: soma de saídas num intervalo ──────────────────────────────────
async function somarSaidas(centroCustoId, empresaId, inicio, fim) {
    const [row] = await sequelize.query(
        `SELECT COALESCE(SUM(valor), 0) AS total
         FROM saidas
         WHERE centro_custo_id = :id
           AND empresa_id      = :empresa_id
           AND natureza        = 'SAIDA'
           AND status         != 'cancelado'
           AND data BETWEEN :inicio AND :fim`,
        { replacements: { id: centroCustoId, empresa_id: empresaId, inicio, fim }, type: sequelize.QueryTypes.SELECT }
    );
    return parseFloat(row?.total || 0);
}

class CentroCustoController {

    // ── CRUD ──────────────────────────────────────────────────────────────

    async getAll(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const centros = await CentroCusto.findAll({ where: { empresa_id }, order: [['nome', 'ASC']] });
            new ApiResponse(res).success(200, centros);
        } catch (error) {
            next(error);
        }
    }

    async getOne(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const centro = await CentroCusto.findOne({ where: { id: req.params.id, empresa_id } });
            if (!centro) throw { status: 404, message: 'Centro de custo não encontrado' };
            new ApiResponse(res).success(200, centro);
        } catch (error) {
            next(error);
        }
    }

    async create(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            if (!empresa_id) throw { status: 400, message: 'empresa_id não encontrado no token' };
            const { nome, descricao, budget } = req.body;
            const centro = await CentroCusto.create({ nome, descricao, budget, empresa_id });
            new ApiResponse(res).success(201, centro, 'Centro de custo criado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const centro = await CentroCusto.findOne({ where: { id: req.params.id, empresa_id } });
            if (!centro) throw { status: 404, message: 'Centro de custo não encontrado' };
            const { nome, descricao, budget } = req.body;
            await centro.update({ nome, descricao, budget });
            new ApiResponse(res).success(200, centro, 'Centro de custo atualizado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const centro = await CentroCusto.findOne({ where: { id: req.params.id, empresa_id } });
            if (!centro) throw { status: 404, message: 'Centro de custo não encontrado' };
            await centro.destroy();
            new ApiResponse(res).success(200, null, 'Centro de custo excluído com sucesso');
        } catch (error) {
            next(error);
        }
    }

    // ── Resumo simples (mantido para compatibilidade com AutomacaoEngine) ──

    async getResumo(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const centro = await CentroCusto.findOne({ where: { id: req.params.id, empresa_id } });
            if (!centro) throw { status: 404, message: 'Centro de custo não encontrado' };

            const agora = new Date();
            const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
            const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);
            const totalGasto = await somarSaidas(centro.id, empresa_id, inicio, fim);
            const budget = parseFloat(centro.budget);
            const percentual = budget > 0 ? (totalGasto / budget) * 100 : 0;

            new ApiResponse(res).success(200, {
                centro_custo_id: centro.id,
                nome: centro.nome,
                budget,
                total_gasto: totalGasto,
                percentual_atingido: Math.round(percentual * 100) / 100,
            });
        } catch (error) {
            next(error);
        }
    }

    // ── Cards de resumo com comparativo ───────────────────────────────────
    // GET /api/centros-de-custos/cards?periodo=mes_atual&data_inicio=&data_fim=

    async getCards(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { periodo, data_inicio, data_fim } = req.query;
            const { inicio, fim, inicioPrev, fimPrev } = resolverPeriodo(periodo, data_inicio, data_fim);

            const centros = await CentroCusto.findAll({ where: { empresa_id } });

            let totalBudget = 0;
            let totalGasto = 0;
            let totalGastoPrev = 0;
            let centrosAtingidos = 0;
            let centrosAlertas = 0;

            for (const c of centros) {
                const budget = parseFloat(c.budget);
                const gasto = await somarSaidas(c.id, empresa_id, inicio, fim);
                const gastoPrev = await somarSaidas(c.id, empresa_id, inicioPrev, fimPrev);
                const pct = budget > 0 ? (gasto / budget) * 100 : 0;

                totalBudget += budget;
                totalGasto += gasto;
                totalGastoPrev += gastoPrev;
                if (pct >= 100) centrosAtingidos++;
                else if (pct >= 80) centrosAlertas++;
            }

            const variacaoGasto = totalGastoPrev > 0
                ? ((totalGasto - totalGastoPrev) / totalGastoPrev) * 100
                : 0;

            new ApiResponse(res).success(200, {
                total_budget: Math.round(totalBudget * 100) / 100,
                total_gasto: Math.round(totalGasto * 100) / 100,
                total_gasto_prev: Math.round(totalGastoPrev * 100) / 100,
                variacao_gasto_pct: Math.round(variacaoGasto * 100) / 100,
                utilizacao_geral: totalBudget > 0 ? Math.round((totalGasto / totalBudget) * 10000) / 100 : 0,
                centros_atingidos: centrosAtingidos,
                centros_alerta: centrosAlertas,
                total_centros: centros.length,
            });
        } catch (error) {
            next(error);
        }
    }

    // ── Listagem enriquecida ───────────────────────────────────────────────
    // GET /api/centros-de-custos/listagem?periodo=mes_atual

    async getListagem(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { periodo, data_inicio, data_fim } = req.query;
            const { inicio, fim, inicioPrev, fimPrev } = resolverPeriodo(periodo, data_inicio, data_fim);

            const centros = await CentroCusto.findAll({
                where: { empresa_id },
                order: [['nome', 'ASC']],
            });

            const resultado = await Promise.all(centros.map(async (c) => {
                const budget = parseFloat(c.budget);
                const gasto = await somarSaidas(c.id, empresa_id, inicio, fim);
                const gastoPrev = await somarSaidas(c.id, empresa_id, inicioPrev, fimPrev);
                const pct = budget > 0 ? Math.round((gasto / budget) * 10000) / 100 : 0;

                const departamentos = await sequelize.query(
                    `SELECT d.id, d.nome
                     FROM centro_custo_departamentos ccd
                     JOIN departamentos d ON d.id = ccd.departamento_id
                     WHERE ccd.centro_custo_id = :id AND ccd.empresa_id = :empresa_id`,
                    { replacements: { id: c.id, empresa_id }, type: sequelize.QueryTypes.SELECT }
                );

                const projetos = await CentroCustoProjeto.findAll({
                    where: { centro_custo_id: c.id, empresa_id },
                    attributes: ['id', 'nome', 'budget'],
                });

                return {
                    id: c.id,
                    nome: c.nome,
                    descricao: c.descricao,
                    budget,
                    total_gasto: Math.round(gasto * 100) / 100,
                    gasto_prev: Math.round(gastoPrev * 100) / 100,
                    utilizacao: pct,
                    status: pct >= 100 ? 'atingido' : pct >= 80 ? 'alerta' : 'normal',
                    departamentos,
                    projetos,
                };
            }));

            new ApiResponse(res).success(200, resultado);
        } catch (error) {
            next(error);
        }
    }

    // ── Gráfico por departamento ───────────────────────────────────────────
    // GET /api/centros-de-custos/grafico-departamento?periodo=mes_atual

    async getGraficoDepartamento(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { periodo, data_inicio, data_fim } = req.query;
            const { inicio, fim } = resolverPeriodo(periodo, data_inicio, data_fim);

            const rows = await sequelize.query(
                `SELECT
                    d.id,
                    d.nome AS departamento,
                    COALESCE(SUM(s.valor), 0) AS total_gasto
                 FROM departamentos d
                 JOIN centro_custo_departamentos ccd ON ccd.departamento_id = d.id AND ccd.empresa_id = :empresa_id
                 JOIN centros_de_custos cc ON cc.id = ccd.centro_custo_id
                 LEFT JOIN saidas s
                    ON s.centro_custo_id = cc.id
                   AND s.empresa_id      = :empresa_id
                   AND s.natureza        = 'SAIDA'
                   AND s.status         != 'cancelado'
                   AND s.data BETWEEN :inicio AND :fim
                 WHERE d.empresa_id = :empresa_id
                 GROUP BY d.id, d.nome
                 ORDER BY total_gasto DESC`,
                { replacements: { empresa_id, inicio, fim }, type: sequelize.QueryTypes.SELECT }
            );

            new ApiResponse(res).success(200, rows.map(r => ({
                id: r.id,
                departamento: r.departamento,
                total_gasto: Math.round(parseFloat(r.total_gasto) * 100) / 100,
            })));
        } catch (error) {
            next(error);
        }
    }

    // ── Sidebar de detalhamento ────────────────────────────────────────────
    // GET /api/centros-de-custos/:id/detalhes?periodo=mes_atual

    async getDetalhes(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { periodo, data_inicio, data_fim } = req.query;
            const { inicio, fim } = resolverPeriodo(periodo, data_inicio, data_fim);

            const centro = await CentroCusto.findOne({ where: { id: req.params.id, empresa_id } });
            if (!centro) throw { status: 404, message: 'Centro de custo não encontrado' };

            // Despesas do período
            const despesas = await sequelize.query(
                `SELECT id, descricao, valor, data, categoria, status
                 FROM saidas
                 WHERE centro_custo_id = :id
                   AND empresa_id      = :empresa_id
                   AND natureza        = 'SAIDA'
                   AND status         != 'cancelado'
                   AND data BETWEEN :inicio AND :fim
                 ORDER BY data DESC
                 LIMIT 50`,
                { replacements: { id: centro.id, empresa_id, inicio, fim }, type: sequelize.QueryTypes.SELECT }
            );

            // Departamentos vinculados
            const departamentos = await sequelize.query(
                `SELECT d.id, d.nome
                 FROM centro_custo_departamentos ccd
                 JOIN departamentos d ON d.id = ccd.departamento_id
                 WHERE ccd.centro_custo_id = :id AND ccd.empresa_id = :empresa_id`,
                { replacements: { id: centro.id, empresa_id }, type: sequelize.QueryTypes.SELECT }
            );

            // Projetos vinculados
            const projetos = await CentroCustoProjeto.findAll({
                where: { centro_custo_id: centro.id, empresa_id },
            });

            // Evolução mensal — últimos 6 meses
            const evolucao = await sequelize.query(
                `SELECT
                    TO_CHAR(DATE_TRUNC('month', data), 'YYYY-MM') AS mes,
                    COALESCE(SUM(valor), 0) AS total
                 FROM saidas
                 WHERE centro_custo_id = :id
                   AND empresa_id      = :empresa_id
                   AND natureza        = 'SAIDA'
                   AND status         != 'cancelado'
                   AND data >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
                 GROUP BY DATE_TRUNC('month', data)
                 ORDER BY DATE_TRUNC('month', data) ASC`,
                { replacements: { id: centro.id, empresa_id }, type: sequelize.QueryTypes.SELECT }
            );

            new ApiResponse(res).success(200, {
                centro: {
                    id: centro.id,
                    nome: centro.nome,
                    descricao: centro.descricao,
                    budget: parseFloat(centro.budget),
                },
                despesas,
                departamentos,
                projetos,
                evolucao_mensal: evolucao.map(e => ({
                    mes: e.mes,
                    total: Math.round(parseFloat(e.total) * 100) / 100,
                })),
            });
        } catch (error) {
            next(error);
        }
    }

    // ── Rateio automático ─────────────────────────────────────────────────

    async getRateio(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const rateio = await RateioAutomatico.findOne({
                where: { centro_custo_id: req.params.id, empresa_id },
            });
            new ApiResponse(res).success(200, rateio || null);
        } catch (error) {
            next(error);
        }
    }

    async listarRateios(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const rateios = await RateioAutomatico.findAll({
                where: { empresa_id },
                include: [{ model: CentroCusto, as: 'centroCusto', attributes: ['id', 'nome'] }],
                order: [['created_at', 'ASC']],
            });
            new ApiResponse(res).success(200, rateios);
        } catch (error) {
            next(error);
        }
    }

    async salvarRateio(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { metodo, configuracao, ativo } = req.body;
            const centro_custo_id = req.params.id;

            const centro = await CentroCusto.findOne({ where: { id: centro_custo_id, empresa_id } });
            if (!centro) throw { status: 404, message: 'Centro de custo não encontrado' };

            const [rateio, created] = await RateioAutomatico.findOrCreate({
                where: { centro_custo_id, empresa_id },
                defaults: { metodo, configuracao: configuracao || {}, ativo: ativo ?? true, empresa_id },
            });

            if (!created) {
                await rateio.update({ metodo, configuracao: configuracao || {}, ativo: ativo ?? true });
            }

            new ApiResponse(res).success(200, rateio, created ? 'Rateio configurado' : 'Rateio atualizado');
        } catch (error) {
            next(error);
        }
    }

    // Aplica o rateio — distribui o valor de uma saída entre centros de custo
    async calcularRateio(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { valor_total } = req.body;
            if (!valor_total) throw { status: 400, message: 'valor_total é obrigatório' };

            const rateios = await RateioAutomatico.findAll({
                where: { empresa_id, ativo: true },
                include: [{ model: CentroCusto, as: 'centroCusto' }],
            });

            if (!rateios.length) throw { status: 404, message: 'Nenhuma configuração de rateio ativa encontrada' };

            const distribuicao = rateios.map(r => {
                const config = r.configuracao || {};
                let percentual = 0;

                if (r.metodo === 'personalizado') {
                    percentual = parseFloat(config.percentual || 0);
                } else if (r.metodo === 'proporcional_area') {
                    const totalArea = rateios.reduce((acc, x) => acc + parseFloat(x.configuracao?.area || 0), 0);
                    percentual = totalArea > 0 ? (parseFloat(config.area || 0) / totalArea) * 100 : 0;
                } else if (r.metodo === 'por_usuario') {
                    const totalUsers = rateios.reduce((acc, x) => acc + parseFloat(x.configuracao?.usuarios || 0), 0);
                    percentual = totalUsers > 0 ? (parseFloat(config.usuarios || 0) / totalUsers) * 100 : 0;
                } else if (r.metodo === 'por_departamento') {
                    const totalDepts = rateios.reduce((acc, x) => acc + parseFloat(x.configuracao?.departamentos || 0), 0);
                    percentual = totalDepts > 0 ? (parseFloat(config.departamentos || 0) / totalDepts) * 100 : 0;
                }

                return {
                    centro_custo_id: r.centro_custo_id,
                    nome: r.centroCusto?.nome,
                    metodo: r.metodo,
                    percentual: Math.round(percentual * 100) / 100,
                    valor_rateado: Math.round((valor_total * percentual / 100) * 100) / 100,
                };
            });

            new ApiResponse(res).success(200, { valor_total, distribuicao });
        } catch (error) {
            next(error);
        }
    }

    // ── Departamentos de um centro ─────────────────────────────────────────

    async getDepartamentos(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const rows = await sequelize.query(
                `SELECT d.id, d.nome
                 FROM centro_custo_departamentos ccd
                 JOIN departamentos d ON d.id = ccd.departamento_id
                 WHERE ccd.centro_custo_id = :id AND ccd.empresa_id = :empresa_id`,
                { replacements: { id: req.params.id, empresa_id }, type: sequelize.QueryTypes.SELECT }
            );
            new ApiResponse(res).success(200, rows);
        } catch (error) {
            next(error);
        }
    }

    async adicionarDepartamento(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { departamento_id } = req.body;
            await CentroCustoDepartamento.findOrCreate({
                where: { centro_custo_id: req.params.id, departamento_id, empresa_id },
                defaults: { centro_custo_id: req.params.id, departamento_id, empresa_id },
            });
            new ApiResponse(res).success(200, null, 'Departamento vinculado');
        } catch (error) {
            next(error);
        }
    }

    async removerDepartamento(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            await CentroCustoDepartamento.destroy({
                where: { centro_custo_id: req.params.id, departamento_id: req.params.departamentoId, empresa_id },
            });
            new ApiResponse(res).success(200, null, 'Departamento desvinculado');
        } catch (error) {
            next(error);
        }
    }

    // ── Projetos de um centro ──────────────────────────────────────────────

    async getProjetos(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const projetos = await CentroCustoProjeto.findAll({
                where: { centro_custo_id: req.params.id, empresa_id },
                order: [['nome', 'ASC']],
            });
            new ApiResponse(res).success(200, projetos);
        } catch (error) {
            next(error);
        }
    }

    async criarProjeto(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { nome, descricao, budget } = req.body;
            const projeto = await CentroCustoProjeto.create({
                centro_custo_id: req.params.id,
                nome, descricao, budget: budget || 0, empresa_id,
            });
            new ApiResponse(res).success(201, projeto, 'Projeto criado');
        } catch (error) {
            next(error);
        }
    }

    async atualizarProjeto(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const projeto = await CentroCustoProjeto.findOne({
                where: { id: req.params.projetoId, centro_custo_id: req.params.id, empresa_id },
            });
            if (!projeto) throw { status: 404, message: 'Projeto não encontrado' };
            const { nome, descricao, budget } = req.body;
            await projeto.update({ nome, descricao, budget });
            new ApiResponse(res).success(200, projeto, 'Projeto atualizado');
        } catch (error) {
            next(error);
        }
    }

    async deletarProjeto(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const projeto = await CentroCustoProjeto.findOne({
                where: { id: req.params.projetoId, centro_custo_id: req.params.id, empresa_id },
            });
            if (!projeto) throw { status: 404, message: 'Projeto não encontrado' };
            await projeto.destroy();
            new ApiResponse(res).success(200, null, 'Projeto excluído');
        } catch (error) {
            next(error);
        }
    }
    // ── Exportação — listagem geral ───────────────────────────────────────────
    // GET /api/centros-de-custos/exportar?formato=pdf|excel&periodo=mes_atual

    async exportarListagem(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { formato = 'pdf', periodo, data_inicio, data_fim } = req.query;
            const { inicio, fim } = resolverPeriodo(periodo, data_inicio, data_fim);

            const centros = await CentroCusto.findAll({ where: { empresa_id }, order: [['nome', 'ASC']] });

            const dados = await Promise.all(centros.map(async (c) => {
                const budget = parseFloat(c.budget);
                const gasto = await somarSaidas(c.id, empresa_id, inicio, fim);
                const pct = budget > 0 ? Math.round((gasto / budget) * 10000) / 100 : 0;
                const [deptRow] = await sequelize.query(
                    `SELECT COUNT(*) AS total FROM centro_custo_departamentos WHERE centro_custo_id = :id AND empresa_id = :empresa_id`,
                    { replacements: { id: c.id, empresa_id }, type: sequelize.QueryTypes.SELECT }
                );
                const nProjetos = await CentroCustoProjeto.count({ where: { centro_custo_id: c.id, empresa_id } });

                return {
                    nome: c.nome,
                    descricao: c.descricao || '-',
                    budget,
                    total_gasto: Math.round(gasto * 100) / 100,
                    utilizacao: pct,
                    status: pct >= 100 ? 'Atingido' : pct >= 80 ? 'Alerta' : 'Normal',
                    n_departamentos: parseInt(deptRow?.total || 0),
                    n_projetos: nProjetos,
                };
            }));

            const periodoLabel = `${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`;

            if (formato === 'excel') {
                const { default: ExcelJS } = await import('exceljs');
                const wb = new ExcelJS.Workbook();
                const ws = wb.addWorksheet('Centros de Custo');

                ws.columns = [
                    { header: 'Nome', key: 'nome', width: 28 },
                    { header: 'Descrição', key: 'descricao', width: 32 },
                    { header: 'Budget (R$)', key: 'budget', width: 16 },
                    { header: 'Total Gasto (R$)', key: 'total_gasto', width: 18 },
                    { header: 'Utilização (%)', key: 'utilizacao', width: 15 },
                    { header: 'Status', key: 'status', width: 12 },
                    { header: 'Departamentos', key: 'n_departamentos', width: 15 },
                    { header: 'Projetos', key: 'n_projetos', width: 12 },
                ];

                const headerRow = ws.getRow(1);
                headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
                headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

                dados.forEach(d => {
                    const row = ws.addRow(d);
                    const statusCell = row.getCell('status');
                    if (d.status === 'Atingido')
                        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    else if (d.status === 'Alerta')
                        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="centros-custo-${Date.now()}.xlsx"`);
                await wb.xlsx.write(res);
                return res.end();
            }

            // ── PDF ──────────────────────────────────────────────────────────────
            const { default: PDFDocument } = await import('pdfkit');
            const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="centros-custo-${Date.now()}.pdf"`);
            doc.pipe(res);

            const cols = [
                { label: 'Nome', width: 130 },
                { label: 'Descrição', width: 140 },
                { label: 'Budget', width: 82 },
                { label: 'Total Gasto', width: 82 },
                { label: 'Utiliz. %', width: 60 },
                { label: 'Status', width: 60 },
                { label: 'Depts', width: 44 },
                { label: 'Projetos', width: 44 },
            ];
            const tableWidth = cols.reduce((a, c) => a + c.width, 0);
            const startX = 40;

            doc.fontSize(16).font('Helvetica-Bold').text('Centros de Custo — Listagem Geral', { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Período: ${periodoLabel}`, { align: 'center' });
            doc.moveDown(0.8);

            const drawHeader = (yPos) => {
                doc.rect(startX, yPos, tableWidth, 20).fill('#2563EB');
                doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
                let x = startX;
                cols.forEach(col => {
                    doc.text(col.label, x + 4, yPos + 5, { width: col.width - 8, lineBreak: false });
                    x += col.width;
                });
                doc.fillColor('black').font('Helvetica').fontSize(8);
                return yPos + 20;
            };

            let y = drawHeader(doc.y);

            dados.forEach((d, i) => {
                const rowH = 18;
                if (i % 2 === 0) doc.rect(startX, y, tableWidth, rowH).fill('#F8FAFC');
                doc.fillColor('black');

                const values = [
                    d.nome,
                    d.descricao,
                    `R$ ${d.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    `R$ ${d.total_gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    `${d.utilizacao}%`,
                    d.status,
                    String(d.n_departamentos),
                    String(d.n_projetos),
                ];

                let x = startX;
                values.forEach((val, vi) => {
                    doc.text(val, x + 4, y + 4, { width: cols[vi].width - 8, lineBreak: false, ellipsis: true });
                    x += cols[vi].width;
                });
                y += rowH;

                if (y > doc.page.height - 60) {
                    doc.addPage({ layout: 'landscape' });
                    y = drawHeader(40);
                }
            });

            doc.end();

        } catch (error) {
            next(error);
        }
    }

    // ── Exportação — detalhamento individual ──────────────────────────────────
    // GET /api/centros-de-custos/:id/exportar?formato=pdf|excel&periodo=mes_atual

    async exportarDetalhes(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { formato = 'pdf', periodo, data_inicio, data_fim } = req.query;
            const { inicio, fim } = resolverPeriodo(periodo, data_inicio, data_fim);

            const centro = await CentroCusto.findOne({ where: { id: req.params.id, empresa_id } });
            if (!centro) throw { status: 404, message: 'Centro de custo não encontrado' };

            const budget = parseFloat(centro.budget);
            const totalGasto = await somarSaidas(centro.id, empresa_id, inicio, fim);
            const utilizacao = budget > 0 ? Math.round((totalGasto / budget) * 10000) / 100 : 0;

            const despesas = await sequelize.query(
                `SELECT descricao, valor, data, categoria, status
             FROM saidas
             WHERE centro_custo_id = :id AND empresa_id = :empresa_id
               AND natureza = 'SAIDA' AND status != 'cancelado'
               AND data BETWEEN :inicio AND :fim
             ORDER BY data DESC`,
                { replacements: { id: centro.id, empresa_id, inicio, fim }, type: sequelize.QueryTypes.SELECT }
            );

            const departamentos = await sequelize.query(
                `SELECT d.nome FROM centro_custo_departamentos ccd
             JOIN departamentos d ON d.id = ccd.departamento_id
             WHERE ccd.centro_custo_id = :id AND ccd.empresa_id = :empresa_id`,
                { replacements: { id: centro.id, empresa_id }, type: sequelize.QueryTypes.SELECT }
            );

            const projetos = await CentroCustoProjeto.findAll({
                where: { centro_custo_id: centro.id, empresa_id },
                attributes: ['nome', 'budget'],
            });

            const evolucao = await sequelize.query(
                `SELECT TO_CHAR(DATE_TRUNC('month', data), 'YYYY-MM') AS mes,
                    COALESCE(SUM(valor), 0) AS total
             FROM saidas
             WHERE centro_custo_id = :id AND empresa_id = :empresa_id
               AND natureza = 'SAIDA' AND status != 'cancelado'
               AND data >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
             GROUP BY DATE_TRUNC('month', data)
             ORDER BY 1 ASC`,
                { replacements: { id: centro.id, empresa_id }, type: sequelize.QueryTypes.SELECT }
            );

            const periodoLabel = `${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`;

            if (formato === 'excel') {
                const { default: ExcelJS } = await import('exceljs');
                const wb = new ExcelJS.Workbook();

                // Aba 1 — Resumo
                const wsResumo = wb.addWorksheet('Resumo');
                wsResumo.columns = [{ width: 24 }, { width: 28 }];
                const infoRows = [
                    ['Centro de Custo', centro.nome],
                    ['Descrição', centro.descricao || '-'],
                    ['Período', periodoLabel],
                    ['Budget (R$)', budget],
                    ['Total Gasto (R$)', totalGasto],
                    ['Utilização (%)', utilizacao],
                    ['Status', utilizacao >= 100 ? 'Atingido' : utilizacao >= 80 ? 'Alerta' : 'Normal'],
                    ['Departamentos', departamentos.map(d => d.nome).join(', ') || '-'],
                    ['Projetos', projetos.map(p => p.nome).join(', ') || '-'],
                ];
                infoRows.forEach(([label, value]) => {
                    const row = wsResumo.addRow([label, value]);
                    row.getCell(1).font = { bold: true };
                });

                // Aba 2 — Despesas
                const wsDespesas = wb.addWorksheet('Despesas');
                wsDespesas.columns = [
                    { header: 'Descrição', key: 'descricao', width: 30 },
                    { header: 'Valor (R$)', key: 'valor', width: 15 },
                    { header: 'Data', key: 'data', width: 14 },
                    { header: 'Categoria', key: 'categoria', width: 20 },
                    { header: 'Status', key: 'status', width: 14 },
                ];
                wsDespesas.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                wsDespesas.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
                despesas.forEach(d => wsDespesas.addRow({
                    ...d,
                    data: new Date(d.data).toLocaleDateString('pt-BR'),
                }));

                // Aba 3 — Evolução mensal
                const wsEvolucao = wb.addWorksheet('Evolução Mensal');
                wsEvolucao.columns = [
                    { header: 'Mês', key: 'mes', width: 14 },
                    { header: 'Total (R$)', key: 'total', width: 16 },
                ];
                wsEvolucao.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                wsEvolucao.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
                evolucao.forEach(e => wsEvolucao.addRow({ mes: e.mes, total: parseFloat(e.total) }));

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="centro-${centro.id}-${Date.now()}.xlsx"`);
                await wb.xlsx.write(res);
                return res.end();
            }

            // ── PDF ──────────────────────────────────────────────────────────────
            const { default: PDFDocument } = await import('pdfkit');
            const doc = new PDFDocument({ margin: 40, size: 'A4' });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="centro-${centro.id}-${Date.now()}.pdf"`);
            doc.pipe(res);

            const pageW = doc.page.width - 80;
            const startX = 40;

            // ── Cabeçalho ────────────────────────────────────────────────────────
            doc.fontSize(16).font('Helvetica-Bold').text(`Centro de Custo: ${centro.nome}`, { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Período: ${periodoLabel}`, { align: 'center' });
            doc.moveDown(0.5);

            // ── Ficha resumo ──────────────────────────────────────────────────────
            doc.rect(startX, doc.y, pageW, 100).fill('#F1F5F9').stroke('#E2E8F0');
            const boxY = doc.y + 10;
            doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold');

            const resumoItems = [
                ['Descrição', centro.descricao || '-'],
                ['Budget', `R$ ${budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                ['Total Gasto', `R$ ${totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                ['Utilização', `${utilizacao}%`],
                ['Status', utilizacao >= 100 ? 'Atingido' : utilizacao >= 80 ? 'Alerta' : 'Normal'],
                ['Departamentos', departamentos.map(d => d.nome).join(', ') || '-'],
                ['Projetos', projetos.map(p => p.nome).join(', ') || '-'],
            ];

            let ry = boxY;
            resumoItems.forEach(([label, value]) => {
                doc.font('Helvetica-Bold').text(label + ':', startX + 10, ry, { continued: true, width: 100 });
                doc.font('Helvetica').text(' ' + value, { width: pageW - 120 });
                ry = doc.y;
            });

            doc.moveDown(1);

            // ── Helper: tabela simples ────────────────────────────────────────────
            const desenharTabela = (titulo, colunas, linhas) => {
                if (doc.y > doc.page.height - 120) doc.addPage();
                doc.fontSize(12).font('Helvetica-Bold').fillColor('#1E40AF').text(titulo);
                doc.fillColor('black');
                doc.moveDown(0.3);

                const tW = pageW;
                let ty = doc.y;

                doc.rect(startX, ty, tW, 18).fill('#2563EB');
                doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
                let tx = startX;
                colunas.forEach(col => {
                    doc.text(col.label, tx + 3, ty + 4, { width: col.width - 6, lineBreak: false });
                    tx += col.width;
                });
                doc.fillColor('black').font('Helvetica').fontSize(8);
                ty += 18;

                if (!linhas.length) {
                    doc.rect(startX, ty, tW, 16).fill('#F8FAFC');
                    doc.fillColor('#6B7280').text('Nenhum registro', startX + 4, ty + 4);
                    doc.fillColor('black');
                    ty += 16;
                }

                linhas.forEach((row, i) => {
                    if (ty > doc.page.height - 60) {
                        doc.addPage();
                        ty = 40;
                    }
                    if (i % 2 === 0) doc.rect(startX, ty, tW, 16).fill('#F8FAFC');
                    doc.fillColor('black');
                    tx = startX;
                    colunas.forEach(col => {
                        doc.text(String(row[col.key] ?? '-'), tx + 3, ty + 3, { width: col.width - 6, lineBreak: false, ellipsis: true });
                        tx += col.width;
                    });
                    ty += 16;
                });

                doc.y = ty;
                doc.moveDown(1);
            };

            // ── Despesas ──────────────────────────────────────────────────────────
            desenharTabela('Despesas do Período', [
                { label: 'Descrição', key: 'descricao', width: pageW * 0.35 },
                { label: 'Valor', key: 'valor_fmt', width: pageW * 0.20 },
                { label: 'Data', key: 'data_fmt', width: pageW * 0.18 },
                { label: 'Categoria', key: 'categoria', width: pageW * 0.15 },
                { label: 'Status', key: 'status', width: pageW * 0.12 },
            ], despesas.map(d => ({
                ...d,
                valor_fmt: `R$ ${parseFloat(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                data_fmt: new Date(d.data).toLocaleDateString('pt-BR'),
            })));

            // ── Evolução mensal ───────────────────────────────────────────────────
            desenharTabela('Evolução Mensal (últimos 6 meses)', [
                { label: 'Mês', key: 'mes', width: pageW * 0.40 },
                { label: 'Total (R$)', key: 'total_fmt', width: pageW * 0.60 },
            ], evolucao.map(e => ({
                mes: e.mes,
                total_fmt: `R$ ${parseFloat(e.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            })));

            doc.end();

        } catch (error) {
            next(error);
        }
    }
}

export default new CentroCustoController();