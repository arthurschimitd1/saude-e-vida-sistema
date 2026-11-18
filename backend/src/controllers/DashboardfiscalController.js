// src/controllers/fiscal/DashboardFiscalController.js
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import NotaFiscalEmitida from '../models/NotaFiscalEmitida.js';
import ConfiguracaoFiscal from '../models/ConfiguracaoFiscal.js';
import focusInvoiceService from '../services/focus/FocusInvoiceService.js';

class DashboardFiscalController {
    async getDashboard(req, res) {
        try {
            const { data_inicio, data_fim } = req.query;
            const empresa_id = req.user.empresa_id_override ?? req.user.empresa_id;

            // Monta filtro de período
            const whereBase = { empresa_id };

            if (data_inicio || data_fim) {
                whereBase.created_at = {};
                if (data_inicio) whereBase.created_at[Op.gte] = new Date(data_inicio);
                if (data_fim) whereBase.created_at[Op.lte] = new Date(`${data_fim}T23:59:59`);
            }

            // ── Notas emitidas ───────────────────────────────────────────────────────
            const [totalEmitidas, totalCanceladas, evolucaoRaw] = await Promise.all([
                NotaFiscalEmitida.count({ where: whereBase }),

                NotaFiscalEmitida.count({
                    where: { ...whereBase, status: 'cancelada' }
                }),

                // Evolução mensal de notas emitidas (para o gráfico)
                sequelize.query(
                    `SELECT
             TO_CHAR(created_at, 'YYYY-MM') AS mes,
             COUNT(*)                        AS total
           FROM notas_fiscais_emitidas
           WHERE empresa_id = :empresa_id
             ${data_inicio ? "AND created_at >= :data_inicio" : ""}
             ${data_fim ? "AND created_at <= :data_fim" : ""}
           GROUP BY mes
           ORDER BY mes ASC`,
                    {
                        replacements: {
                            empresa_id,
                            ...(data_inicio && { data_inicio: new Date(data_inicio) }),
                            ...(data_fim && { data_fim: new Date(`${data_fim}T23:59:59`) }),
                        },
                        type: sequelize.QueryTypes.SELECT,
                    }
                ),
            ]);

            // ── Notas recebidas via Focus ────────────────────────────────────────────
            let totalRecebidas = null;

            try {
                const config = await ConfiguracaoFiscal.findOne({ where: { empresa_id } });

                if (config) {
                    const [resNfe, resNfse] = await Promise.all([
                        focusInvoiceService.listarNFeRecebidas(empresa_id, data_inicio, data_fim),
                        focusInvoiceService.listarNFSeRecebidas(empresa_id, data_inicio, data_fim),
                    ]);

                    const countNfe = resNfe.success ? (resNfe.meta?.total ?? resNfe.data?.length ?? 0) : 0;
                    const countNfse = resNfse.success ? (resNfse.meta?.total ?? resNfse.data?.length ?? 0) : 0;

                    totalRecebidas = countNfe + countNfse;
                }
            } catch (err) {
                // Focus indisponível não deve derrubar o dashboard inteiro
                console.warn('[DashboardFiscal] Focus indisponível:', err.message);
            }

            return res.json({
                success: true,
                data: {
                    notas_emitidas: totalEmitidas,
                    notas_canceladas: totalCanceladas,
                    notas_recebidas: totalRecebidas,
                    evolucao_mensal: evolucaoRaw,   // [{ mes: '2025-01', total: '42' }, ...]

                    // Sem fonte real — retorna null para o frontend exibir estado vazio
                    impostos_previstos: null,
                    impostos_pagos: null,
                    obrigacoes_pendentes: null,
                    divergencias_fiscais: null,
                    produtos_sem_tributacao: null,
                    movimentacoes_inconsistentes: null,
                },
            });
        } catch (error) {
            console.error('[DashboardFiscal] Erro:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

export default new DashboardFiscalController();