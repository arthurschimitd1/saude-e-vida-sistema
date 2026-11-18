'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { whatsappCrmService, WhatsappConfig } from '../../services/api/whatsappCrmService';
import styles from './WhatsAppConfiguracao.module.scss';

type MetaForm = {
    meta_ativo: boolean;
    meta_app_id: string;
    meta_app_secret: string;
    meta_business_account_id: string;
    meta_phone_number_id: string;
    meta_access_token: string;
    meta_verify_token: string;
    meta_api_version: string;
};

const FORM_VAZIO: MetaForm = {
    meta_ativo: false,
    meta_app_id: '',
    meta_app_secret: '',
    meta_business_account_id: '',
    meta_phone_number_id: '',
    meta_access_token: '',
    meta_verify_token: '',
    meta_api_version: 'v23.0',
};

export default function AutomacaoWhatsappPage() {
    const [config, setConfig] = useState<WhatsappConfig | null>(null);
    const [form, setForm] = useState<MetaForm>(FORM_VAZIO);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [testando, setTestando] = useState(false);
    const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso' | 'info'; texto: string } | null>(null);

    const carregar = async () => {
        setCarregando(true);
        try {
            const atual = await whatsappCrmService.getConfig();
            setConfig(atual);
            setForm({
                meta_ativo: Boolean(atual?.meta_ativo),
                meta_app_id: atual?.meta_app_id || '',
                meta_app_secret: '',
                meta_business_account_id: atual?.meta_business_account_id || '',
                meta_phone_number_id: atual?.meta_phone_number_id || '',
                meta_access_token: '',
                meta_verify_token: '',
                meta_api_version: atual?.meta_api_version || 'v23.0',
            });
        } catch (error: any) {
            setMensagem({ tipo: 'erro', texto: error?.response?.data?.message || error?.message || 'Não foi possível carregar a configuração.' });
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => { carregar(); }, []);

    const webhookUrl = config?.meta_webhook_url || '';
    const metaPronta = useMemo(() => Boolean(config?.meta_configurada), [config]);
    const alterar = (campo: keyof MetaForm, valor: string | boolean) => setForm((atual) => ({ ...atual, [campo]: valor }));

    const salvar = async (event: React.FormEvent) => {
        event.preventDefault();
        setSalvando(true);
        setMensagem(null);
        try {
            const atualizada = await whatsappCrmService.saveConfig(form);
            setConfig(atualizada);
            setForm((atual) => ({ ...atual, meta_app_secret: '', meta_access_token: '', meta_verify_token: '' }));
            setMensagem({ tipo: 'sucesso', texto: 'Configuração da Meta salva com segurança.' });
        } catch (error: any) {
            setMensagem({ tipo: 'erro', texto: error?.response?.data?.message || error?.message || 'Não foi possível salvar a configuração.' });
        } finally {
            setSalvando(false);
        }
    };

    const testar = async () => {
        setTestando(true);
        setMensagem(null);
        try {
            const resultado = await whatsappCrmService.testMeta();
            await carregar();
            setMensagem({ tipo: resultado.conectado ? 'sucesso' : 'erro', texto: resultado.mensagem });
        } catch (error: any) {
            setMensagem({ tipo: 'erro', texto: error?.response?.data?.message || error?.message || 'A Meta recusou o teste de conexão.' });
            await carregar();
        } finally {
            setTestando(false);
        }
    };

    const copiar = async () => {
        if (!webhookUrl) return;
        await navigator.clipboard?.writeText(webhookUrl);
        setMensagem({ tipo: 'info', texto: 'URL do webhook copiada.' });
    };

    if (carregando) return <main className={styles.page}><div className={styles.loading}>Carregando configuração do WhatsApp…</div></main>;

    return <main className={styles.page}>
        <header className={styles.heading}>
            <div><span>INTEGRAÇÕES</span><h1>WhatsApp da empresa</h1><p>Conecte o número oficial pela WhatsApp Cloud API da Meta e use o mesmo CRM para receber e enviar mensagens.</p></div>
            <div className={styles.headingActions}><Link href="/uikit/crm" className={styles.secondaryButton}><i className="pi pi-comments" /> Abrir CRM</Link></div>
        </header>

        {mensagem && <div className={`${styles.alert} ${styles[mensagem.tipo]}`}><i className={`pi ${mensagem.tipo === 'erro' ? 'pi-times-circle' : mensagem.tipo === 'sucesso' ? 'pi-check-circle' : 'pi-info-circle'}`} />{mensagem.texto}</div>}

        <section className={styles.statusCard}>
            <div className={`${styles.statusIcon} ${metaPronta ? styles.statusIconOk : ''}`}><i className="pi pi-whatsapp" /></div>
            <div><span className={styles.kicker}>META CLOUD API</span><h2>{metaPronta ? (config?.meta_verified_name || 'WhatsApp conectado') : 'Ainda não conectado'}</h2><p>{config?.meta_display_phone_number || 'Cadastre as credenciais para validar o número oficial.'}</p></div>
            <span className={`${styles.badge} ${metaPronta ? styles.badgeOk : styles.badgeIdle}`}>{config?.meta_status === 'erro' ? 'Erro na última validação' : metaPronta ? 'Configurado' : 'Pendente'}</span>
        </section>

        <form className={styles.grid} onSubmit={salvar}>
            <section className={styles.card}>
                <div className={styles.cardHeader}><div><span className={styles.kicker}>CREDENCIAIS DA META</span><h2>Dados do WhatsApp Business</h2><p>Esses valores vêm do Meta for Developers e do WhatsApp Manager.</p></div><i className="pi pi-lock" /></div>
                <label className={styles.toggle}><input type="checkbox" checked={form.meta_ativo} onChange={(event) => alterar('meta_ativo', event.target.checked)} /><span><strong>Usar Meta Cloud API no CRM</strong><small>Ao ativar, novas mensagens de texto serão enviadas pela Meta.</small></span></label>
                <div className={styles.fields}>
                    <label>App ID<input value={form.meta_app_id} onChange={(event) => alterar('meta_app_id', event.target.value)} placeholder="ID do aplicativo Meta" /></label>
                    <label>Business Account ID (WABA)<input value={form.meta_business_account_id} onChange={(event) => alterar('meta_business_account_id', event.target.value)} placeholder="ID da conta do WhatsApp Business" /></label>
                    <label>Phone Number ID<input required={form.meta_ativo} value={form.meta_phone_number_id} onChange={(event) => alterar('meta_phone_number_id', event.target.value)} placeholder="ID do número no WhatsApp Manager" /></label>
                    <label>Versão da Graph API<input value={form.meta_api_version} onChange={(event) => alterar('meta_api_version', event.target.value)} placeholder="v23.0" /></label>
                    <label className={styles.wide}>Access Token permanente<input type="password" value={form.meta_access_token} onChange={(event) => alterar('meta_access_token', event.target.value)} placeholder={config?.meta_access_token_configurado ? 'Token já configurado — deixe vazio para manter' : 'Cole o token de acesso permanente'} autoComplete="new-password" /><small>O token é criptografado no servidor e nunca volta para o navegador.</small></label>
                    <label>App Secret<input type="password" value={form.meta_app_secret} onChange={(event) => alterar('meta_app_secret', event.target.value)} placeholder={config?.meta_app_secret_configurado ? 'Já configurado — deixe vazio para manter' : 'Secret do aplicativo Meta'} autoComplete="new-password" /></label>
                    <label>Token de verificação<input type="password" value={form.meta_verify_token} onChange={(event) => alterar('meta_verify_token', event.target.value)} placeholder={config?.meta_verify_token_configurado ? 'Já configurado — deixe vazio para manter' : 'Crie um token para o webhook'} autoComplete="new-password" /><small>Esse mesmo valor será informado no painel Webhooks da Meta.</small></label>
                </div>
                <div className={styles.actions}><button className={styles.primaryButton} type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar configuração'}</button><button className={styles.testButton} type="button" onClick={testar} disabled={testando || !metaPronta}>{testando ? 'Testando…' : 'Testar conexão'}</button></div>
            </section>

            <section className={styles.card}>
                <div className={styles.cardHeader}><div><span className={styles.kicker}>WEBHOOKS</span><h2>Receber mensagens da Meta</h2><p>Cadastre a URL abaixo no produto WhatsApp da sua aplicação Meta.</p></div><i className="pi pi-link" /></div>
                <div className={styles.steps}><div><b>1</b><span>Abra <strong>WhatsApp → Configuration → Webhooks</strong> no Meta for Developers.</span></div><div><b>2</b><span>Use a URL de callback e o token de verificação configurados acima.</span></div><div><b>3</b><span>Assine o campo <strong>messages</strong> para receber mensagens e status.</span></div></div>
                <label>Callback URL da Meta<div className={styles.copyField}><input readOnly value={webhookUrl || 'Salve a configuração para gerar a URL pública'} /><button type="button" onClick={copiar} disabled={!webhookUrl} aria-label="Copiar URL"><i className="pi pi-copy" /></button></div></label>
                <div className={styles.note}><i className="pi pi-shield" /><span>A rota aceita a verificação GET da Meta e valida o cabeçalho <code>X-Hub-Signature-256</code> nos eventos POST usando o App Secret.</span></div>
                {config?.meta_ultimo_erro && <div className={styles.lastError}><strong>Último erro</strong><span>{config.meta_ultimo_erro}</span></div>}
            </section>
        </form>

        <section className={styles.compatibility}><i className="pi pi-info-circle" /><div><strong>Integração atual preservada</strong><p>A Z-API continua disponível para empresas que já usam essa conexão. A Meta Cloud API passa a ser a opção oficial quando o botão acima estiver ativo.</p></div></section>
    </main>;
}
