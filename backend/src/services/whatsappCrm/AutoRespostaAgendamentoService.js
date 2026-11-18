import { Op } from 'sequelize';
import Empresa from '../../models/Empresa.js';
import WhatsappConfig from '../../models/WhatsappConfig.js';
import WhatsappConversa from '../../models/WhatsappConversa.js';
import mensagemService from './MensagemService.js';
import logService from './LogService.js';
import {
    detectarIntencaoAgendamento,
    ehEmpresaDomFerraz,
    montarMensagemAgendamento,
    normalizarConfiguracaoAutomacao,
} from '../../utils/whatsappAgendamentoAutoReply.js';

export const ORIGEM_AUTOMACAO_AGENDAMENTO = 'automacao_agendamento';

export class AutoRespostaAgendamentoService {
    constructor({
        EmpresaModel = Empresa,
        WhatsappConfigModel = WhatsappConfig,
        WhatsappConversaModel = WhatsappConversa,
        mensagem = mensagemService,
        logs = logService,
        agora = () => new Date(),
    } = {}) {
        this.Empresa = EmpresaModel;
        this.WhatsappConfig = WhatsappConfigModel;
        this.WhatsappConversa = WhatsappConversaModel;
        this.mensagemService = mensagem;
        this.logService = logs;
        this.agora = agora;
    }

    async processar({ empresaId, conversaId, texto, fromMe = false }) {
        if (fromMe || !detectarIntencaoAgendamento(texto)) {
            return { enviada: false, motivo: 'sem_intencao' };
        }

        const empresa = await this.Empresa.findByPk(empresaId, { attributes: ['id', 'nome'] });
        if (!empresa || !ehEmpresaDomFerraz(empresa.nome)) {
            return { enviada: false, motivo: 'empresa_fora_do_escopo' };
        }

        const config = await this.WhatsappConfig.findOne({ where: { empresa_id: empresaId } });
        const automacao = normalizarConfiguracaoAutomacao(config?.automacao_agendamento);
        if (!automacao.ativa) return { enviada: false, motivo: 'automacao_desativada' };
        if (!config?.zapi_instance_id || !config?.zapi_token) {
            return { enviada: false, motivo: 'integracao_nao_configurada' };
        }

        const conversa = await this.WhatsappConversa.findOne({
            where: { id: conversaId, empresa_id: empresaId },
            attributes: ['id', 'empresa_id', 'resposta_agendamento_em'],
        });
        if (!conversa) return { enviada: false, motivo: 'conversa_nao_encontrada' };

        const instante = this.agora();
        const limite = new Date(instante.getTime() - automacao.cooldown_horas * 60 * 60 * 1000);
        const anterior = conversa.resposta_agendamento_em ?? null;
        const [reservadas] = await this.WhatsappConversa.update(
            { resposta_agendamento_em: instante },
            {
                where: {
                    id: conversaId,
                    empresa_id: empresaId,
                    [Op.or]: [
                        { resposta_agendamento_em: null },
                        { resposta_agendamento_em: { [Op.lt]: limite } },
                    ],
                },
            }
        );
        if (!reservadas) return { enviada: false, motivo: 'ja_enviada_recentemente' };

        const userAutomacao = { id: null, tipo: 'EMPRESA', empresa_id: Number(empresaId) };
        try {
            const mensagem = await this.mensagemService.enviarTexto(
                conversaId,
                montarMensagemAgendamento(automacao),
                userAutomacao,
                { origem: ORIGEM_AUTOMACAO_AGENDAMENTO }
            );

            if (mensagem?.status === 'falha') {
                await this._liberarReserva({ empresaId, conversaId, instante, anterior });
                await this._registrarFalha({ empresaId, conversaId, motivo: 'falha_no_envio' });
                return { enviada: false, motivo: 'falha_no_envio' };
            }

            await this.logService.registrar({
                tipo: 'resposta_automatica',
                mensagem: 'Link de agendamento enviado automaticamente',
                conversa_id: conversaId,
                metadata: { automacao: ORIGEM_AUTOMACAO_AGENDAMENTO },
            }, userAutomacao).catch(() => {});
            return { enviada: true, mensagemId: mensagem?.id ?? null };
        } catch (error) {
            await this._liberarReserva({ empresaId, conversaId, instante, anterior });
            await this._registrarFalha({ empresaId, conversaId, motivo: 'erro_inesperado' });
            return { enviada: false, motivo: 'erro_no_envio' };
        }
    }

    async _liberarReserva({ empresaId, conversaId, instante, anterior }) {
        await this.WhatsappConversa.update(
            { resposta_agendamento_em: anterior },
            { where: { id: conversaId, empresa_id: empresaId, resposta_agendamento_em: instante } }
        ).catch(() => {});
    }

    async _registrarFalha({ empresaId, conversaId, motivo }) {
        await this.logService.registrar({
            tipo: 'falha_envio',
            mensagem: 'Não foi possível enviar a resposta automática de agendamento',
            conversa_id: conversaId,
            metadata: { automacao: ORIGEM_AUTOMACAO_AGENDAMENTO, motivo },
        }, { tipo: 'EMPRESA', empresa_id: Number(empresaId) }).catch(() => {});
    }
}

export default new AutoRespostaAgendamentoService();
