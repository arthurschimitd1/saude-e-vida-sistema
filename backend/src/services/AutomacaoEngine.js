/**
 * AutomacaoEngine — Motor Central de Automação
 *
 * Uso: AutomacaoEngine.dispararEvento('nota_fiscal_emitida', empresa_id, { nota })
 *
 * Totalmente desacoplado. Os controllers existentes só chamam dispararEvento()
 * e não precisam saber o que acontece depois.
 */

import AutomacaoRegra from '../models/Automacaoregra.js';
import AutomacaoExecucao from '../models/AutomacaoExecucao.js';
import AutomacaoNotificacao from '../models/AutomacaoNotificacao.js';
import axios from 'axios';
import EmailService from './EmailService.js';

class AutomacaoEngine {

    /**
     * Ponto de entrada principal.
     * Chamado pelos controllers quando um evento relevante ocorre.
     *
     * @param {string} tipoEvento - Ex: 'nota_fiscal_emitida'
     * @param {number} empresa_id
     * @param {object} dados - Payload do evento (nota, cliente, etc)
     */
    async dispararEvento(tipoEvento, empresa_id, dados = {}) {
        if (!tipoEvento || !empresa_id) return;

        try {
            const regras = await AutomacaoRegra.findAll({
                where: { evento_gatilho: tipoEvento, empresa_id, status: 'ativo' }
            });

            if (!regras.length) return;

            for (const regra of regras) {
                this._executarRegra(regra, tipoEvento, empresa_id, dados).catch(err => {
                    console.error(`[AutomacaoEngine] Erro ao executar regra ${regra.id}:`, err.message);
                });
            }
        } catch (err) {
            console.error('[AutomacaoEngine] Erro ao disparar evento:', err.message);
        }
    }

    /**
     * Verifica se os parâmetros do gatilho são compatíveis com os dados do evento.
     * Ex: conta_pagar_vence com dias=5 só executa se o vencimento for em 5 dias.
     */
    _validarParametrosGatilho(regra, dados) {
        const params = regra.parametros_gatilho || {};

        if (regra.evento_gatilho === 'conta_pagar_vence' || regra.evento_gatilho === 'conta_receber_vence') {
            const diasConfig = Number(params.dias ?? 5);
            const diasDados = Number(dados.dias_para_vencer ?? diasConfig);
            return diasDados <= diasConfig;
        }

        if (regra.evento_gatilho === 'budget_atingido') {
            const percConfig = Number(params.percentual ?? 80);
            const percDados = Number(dados.percentual_atingido ?? 0);
            return percDados >= percConfig;
        }

        return true;
    }

    async _executarRegra(regra, tipoEvento, empresa_id, dados) {
        const inicio = Date.now();
        let resultado = 'sucesso';
        let erroMensagem = null;
        const detalhes = { acoes_executadas: [] };

        try {
            if (!this._validarParametrosGatilho(regra, dados)) return;

            const acoes = Array.isArray(regra.acoes) ? regra.acoes : [];

            for (const acao of acoes) {
                try {
                    await this._executarAcao(acao, regra, dados, empresa_id);
                    detalhes.acoes_executadas.push({ tipo: acao.tipo, status: 'ok' });
                } catch (err) {
                    detalhes.acoes_executadas.push({ tipo: acao.tipo, status: 'falha', erro: err.message });
                    throw err; // propaga para registrar a regra como falha
                }
            }

            // Atualiza contadores de sucesso
            await regra.update({
                total_execucoes: (regra.total_execucoes || 0) + 1,
                ultima_execucao: new Date(),
                falhas_consecutivas: 0
            });

        } catch (err) {
            resultado = 'falha';
            erroMensagem = err.message;

            const novasFalhas = (regra.falhas_consecutivas || 0) + 1;

            // Desativa automaticamente após 3 falhas consecutivas
            const novoStatus = novasFalhas >= 3 ? 'inativo' : regra.status;

            await regra.update({
                total_execucoes: (regra.total_execucoes || 0) + 1,
                ultima_execucao: new Date(),
                falhas_consecutivas: novasFalhas,
                status: novoStatus
            });

            if (novasFalhas >= 3) {
                console.warn(`[AutomacaoEngine] Regra "${regra.nome}" desativada após 3 falhas consecutivas.`);
                // Cria notificação de desativação automática
                await AutomacaoNotificacao.create({
                    empresa_id,
                    regra_id: regra.id,
                    tipo: 'erro',
                    titulo: 'Regra desativada automaticamente',
                    mensagem: `A regra "${regra.nome}" foi desativada após 3 falhas consecutivas. Último erro: ${erroMensagem}`,
                    lida: false
                }).catch(() => { });
            }
        }

        // Registra a execução no histórico
        await AutomacaoExecucao.create({
            regra_id: regra.id,
            evento: tipoEvento,
            resultado,
            duracao_ms: Date.now() - inicio,
            detalhes,
            erro_mensagem: erroMensagem,
            empresa_id
        }).catch(err => console.error('[AutomacaoEngine] Erro ao salvar execução:', err.message));
    }

    async _executarAcao(acao, regra, dados, empresa_id) {
        switch (acao.tipo) {

            case 'notificacao_sistema': {
                const mensagem = acao.parametros?.mensagem || `Regra "${regra.nome}" executada.`;
                await AutomacaoNotificacao.create({
                    empresa_id,
                    regra_id: regra.id,
                    tipo: 'info',
                    titulo: regra.nome,
                    mensagem,
                    lida: false
                });
                break;
            }

            case 'enviar_email': {
                const { para, assunto, mensagem } = acao.parametros || {};
                if (!para) throw new Error('Destinatário de e-mail não configurado na ação');
                await EmailService.send({ to: para, subject: assunto, body: mensagem });
                break;
            }

            case 'webhook': {
                const { url } = acao.parametros || {};
                if (!url) throw new Error('URL do webhook não configurada');
                await axios.post(url, {
                    evento: regra.evento_gatilho,
                    regra: regra.nome,
                    dados,
                    timestamp: new Date().toISOString()
                }, { timeout: 10000 });
                break;
            }

            default:
                console.warn(`[AutomacaoEngine] Tipo de ação desconhecido: "${acao.tipo}"`);
        }
    }
}

export default new AutomacaoEngine();
