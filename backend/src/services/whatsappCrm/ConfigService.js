import crypto from 'crypto';
import WhatsappConfig from '../../models/WhatsappConfig.js';
import CrmWhatsappConfig from '../../models/CrmWhatsappConfig.js';
import Empresa from '../../models/Empresa.js';
import { empresaParaGravar } from '../../utils/empresaScope.js';
import { encryptCredential } from '../../utils/credentialCrypto.js';
import {
    DOM_FERRAZ_LANDING_URL,
    ehEmpresaDomFerraz,
    normalizarConfiguracaoAutomacao,
} from '../../utils/whatsappAgendamentoAutoReply.js';
import zApiService from './ZApiService.js';
import metaWhatsAppService from './MetaWhatsAppService.js';

const gerarWebhookToken = () => crypto.randomBytes(24).toString('hex');

class ConfigService {
    urlsWebhook(config) {
        const rawBase = String(process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
        if (!rawBase || !config?.empresa_id || !config?.webhook_token) return null;
        const apiBase = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;
        const prefix = `${apiBase}/whatsapp-crm/webhook/${config.empresa_id}/${config.webhook_token}`;
        return {
            recebimento: `${prefix}/mensagem-recebida`,
            status: `${prefix}/status-mensagem`,
        };
    }

    metaWebhookUrl(config) {
        const rawBase = String(process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
        if (!rawBase || !config?.empresa_id || !config?.meta_webhook_token) return null;
        const apiBase = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;
        return `${apiBase}/whatsapp-meta/webhook/${config.empresa_id}/${config.meta_webhook_token}`;
    }

    async configurarWebhooks(config) {
        const urls = this.urlsWebhook(config);
        if (!urls || !config?.zapi_instance_id || !config?.zapi_token) return false;
        try {
            const resultado = await zApiService.configurarWebhooks(config, urls);
            if (resultado.erros.length) {
                console.warn('[WhatsApp CRM] Webhooks parcialmente configurados:', resultado.erros);
            }
            return resultado.configurado;
        } catch (error) {
            console.warn('[WhatsApp CRM] Não foi possível configurar os webhooks:', zApiService.mensagemErro(error));
            return false;
        }
    }

    async testar(user) {
        const config = await this.buscar(user);
        if (!config?.zapi_instance_id || !config?.zapi_token) {
            return {
                conectado: false,
                smartphoneConectado: false,
                webhooksConfigurados: false,
                mensagem: 'Informe e salve o ID e o token da instância antes de testar.',
            };
        }

        const status = await zApiService.statusInstancia(config);
        const webhooksConfigurados = status.connected ? await this.configurarWebhooks(config) : false;
        return {
            conectado: Boolean(status.connected),
            smartphoneConectado: Boolean(status.smartphoneConnected),
            webhooksConfigurados,
            webhookUrls: this.urlsWebhook(config),
            mensagem: status.connected
                ? (webhooksConfigurados ? 'Z-API conectada e webhooks configurados.' : 'Z-API conectada, mas os webhooks precisam ser revisados.')
                : (status.error || 'A instância Z-API está desconectada.'),
        };
    }

    async _buscarOuMigrar(empresa_id) {
        let config = await WhatsappConfig.findOne({ where: { empresa_id } });
        if (config) return config;

        const anterior = await CrmWhatsappConfig.findOne({
            where: { empresa_id, active: true },
            order: [['updated_at', 'DESC']],
        });
        const defaults = {
            empresa_id,
            webhook_token: gerarWebhookToken(),
            meta_webhook_token: gerarWebhookToken(),
        };
        if (anterior) {
            defaults.zapi_instance_id = anterior.instance_id;
            defaults.zapi_token = anterior.token_encrypted;
            defaults.zapi_client_token = anterior.client_token_encrypted;
        }
        config = await WhatsappConfig.create(defaults);
        if (anterior) await this.configurarWebhooks(config);
        return config;
    }

    async _garantirWebhookToken(config) {
        // Backfill pra configs criadas antes do campo existir (findOrCreate só
        // aplica defaults na criação, não em linhas já existentes).
        if (!config.webhook_token) {
            await config.update({ webhook_token: gerarWebhookToken() });
        }
        if (!config.meta_webhook_token) {
            await config.update({ meta_webhook_token: gerarWebhookToken() });
        }
        return config;
    }

    async buscar(user) {
        const empresa_id = empresaParaGravar(user);
        if (!empresa_id) return null;

        const config = await this._buscarOuMigrar(empresa_id);
        await this._garantirWebhookToken(config);
        return this._marcarAutomacaoDisponivel(config);
    }

    async _marcarAutomacaoDisponivel(config) {
        if (!config) return config;
        const empresa = await Empresa.findByPk(config.empresa_id, { attributes: ['nome'] });
        config.setDataValue('automacao_agendamento_disponivel', ehEmpresaDomFerraz(empresa?.nome));
        return config;
    }

    publico(config) {
        if (!config) return null;
        const data = config.toJSON();
        data.zapi_token = '';
        data.zapi_client_token = '';
        data.zapi_token_configurado = Boolean(config.zapi_token);
        data.zapi_client_token_configurado = Boolean(config.zapi_client_token);
        data.webhook_urls = this.urlsWebhook(config);
        data.meta_app_secret = '';
        data.meta_access_token = '';
        data.meta_verify_token = '';
        data.meta_app_secret_configurado = Boolean(config.meta_app_secret);
        data.meta_access_token_configurado = Boolean(config.meta_access_token);
        data.meta_verify_token_configurado = Boolean(config.meta_verify_token);
        data.meta_webhook_url = this.metaWebhookUrl(config);
        data.meta_configurada = Boolean(config.meta_phone_number_id && config.meta_access_token);
        data.automacao_agendamento = normalizarConfiguracaoAutomacao(config.automacao_agendamento);
        data.automacao_agendamento_link = DOM_FERRAZ_LANDING_URL;
        return data;
    }

    async salvar(data, user) {
        const empresa_id = empresaParaGravar(user);
        if (!empresa_id) throw new Error('Usuário sem empresa associada — não é possível salvar configurações');

        const config = await this._buscarOuMigrar(empresa_id);
        await this._garantirWebhookToken(config);

        // Nunca aceita empresa_id/webhook_token vindo do corpo da requisição
        const {
            empresa_id: _ignorado,
            id: _idIgnorado,
            webhook_token: _tokenIgnorado,
            meta_webhook_token: _metaWebhookTokenIgnorado,
            meta_status: _metaStatusIgnorado,
            meta_ultimo_teste_em: _metaTesteIgnorado,
            meta_ultimo_erro: _metaErroIgnorado,
            meta_display_phone_number: _metaNumeroIgnorado,
            meta_verified_name: _metaNomeIgnorado,
            automacao_agendamento_disponivel: _disponibilidadeIgnorada,
            automacao_agendamento_link: _linkIgnorado,
            ...campos
        } = data;
        const credenciaisMeta = ['meta_app_secret', 'meta_access_token', 'meta_verify_token'];
        if (campos.automacao_agendamento) {
            const empresa = await Empresa.findByPk(empresa_id, { attributes: ['nome'] });
            campos.automacao_agendamento = normalizarConfiguracaoAutomacao(campos.automacao_agendamento);
            if (campos.automacao_agendamento.ativa && !ehEmpresaDomFerraz(empresa?.nome)) {
                throw new Error('A resposta automática de agendamento está disponível somente para as empresas Dom Ferraz.');
            }
        }
        if (campos.zapi_token) campos.zapi_token = encryptCredential(campos.zapi_token);
        else delete campos.zapi_token;
        if (campos.zapi_client_token) campos.zapi_client_token = encryptCredential(campos.zapi_client_token);
        else delete campos.zapi_client_token;
        for (const campo of credenciaisMeta) {
            if (campos[campo]) campos[campo] = encryptCredential(campos[campo]);
            else delete campos[campo];
        }
        await config.update(campos);
        config.setDataValue('webhook_configurado', await this.configurarWebhooks(config));
        return this._marcarAutomacaoDisponivel(config);
    }

    async testarMeta(user) {
        const config = await this.buscar(user);
        if (!config?.meta_phone_number_id || !config?.meta_access_token) {
            return {
                conectado: false,
                mensagem: 'Informe o Phone Number ID e o Access Token da Meta antes de testar.',
            };
        }

        try {
            const dados = await metaWhatsAppService.testarConexao(config);
            await config.update({
                meta_status: 'conectado',
                meta_ultimo_teste_em: new Date(),
                meta_ultimo_erro: null,
                meta_display_phone_number: dados.display_phone_number || null,
                meta_verified_name: dados.verified_name || null,
            });
            return {
                conectado: true,
                mensagem: 'WhatsApp Meta Cloud API conectado e validado.',
                dados,
                webhookUrl: this.metaWebhookUrl(config),
            };
        } catch (error) {
            await config.update({ meta_status: 'erro', meta_ultimo_teste_em: new Date(), meta_ultimo_erro: error.message.slice(0, 500) });
            throw error;
        }
    }
}

export default new ConfigService();
