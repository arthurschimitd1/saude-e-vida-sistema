import cron from 'node-cron';
import Saida from '../models/Saida.js';
import AutomacaoEngine from '../services/AutomacaoEngine.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

// Roda todo dia às 08:00
cron.schedule('0 8 * * *', async () => {
    console.log('[AutomacaoJob] Verificando vencimentos...');

    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Busca todas as empresas ativas que têm regras de automação
        const empresas = await sequelize.query(
            `SELECT DISTINCT empresa_id FROM automacao_regras 
             WHERE status = 'ativo' 
             AND evento_gatilho IN ('conta_pagar_vence', 'conta_receber_vence')`,
            { type: sequelize.QueryTypes.SELECT }
        );

        for (const { empresa_id } of empresas) {
            try {
                // Busca lançamentos de SAIDA (contas a pagar) pendentes por empresa
                const saidas = await Saida.findAll({
                    where: {
                        empresa_id,
                        natureza: 'SAIDA',
                        status: 'pendente',
                        data: { [Op.gte]: hoje }
                    }
                });

                for (const saida of saidas) {
                    const diasParaVencer = Math.ceil(
                        (new Date(saida.data).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
                    );

                    // Dispara o evento — o engine verifica os parâmetros da regra
                    // e só executa se dias_para_vencer bater com o configurado
                    AutomacaoEngine.dispararEvento('conta_pagar_vence', empresa_id, {
                        lancamento: saida,
                        dias_para_vencer: diasParaVencer
                    });
                }

                // Busca lançamentos de ENTRADA (contas a receber) pendentes
                const entradas = await Saida.findAll({
                    where: {
                        empresa_id,
                        natureza: 'ENTRADA',
                        status: 'pendente',
                        data: { [Op.gte]: hoje }
                    }
                });

                for (const entrada of entradas) {
                    const diasParaVencer = Math.ceil(
                        (new Date(entrada.data).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
                    );

                    AutomacaoEngine.dispararEvento('conta_receber_vence', empresa_id, {
                        lancamento: entrada,
                        dias_para_vencer: diasParaVencer
                    });
                }

                console.log(`[AutomacaoJob] Empresa ${empresa_id}: ${saidas.length} saidas, ${entradas.length} entradas verificadas`);
            } catch (err) {
                console.error(`[AutomacaoJob] Erro na empresa ${empresa_id}:`, err.message);
            }
        }

        console.log('[AutomacaoJob] Verificacao concluida.');
    } catch (err) {
        console.error('[AutomacaoJob] Erro geral:', err.message);
    }
});

export default cron;