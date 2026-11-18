import api from './baseApi';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WhatsappConfig {
    id?: number;
    empresa_id?: number;
    numero_whatsapp?: string | null;
    zapi_instance_id?: string | null;
    zapi_token?: string | null;
    zapi_client_token?: string | null;
    zapi_token_configurado?: boolean;
    zapi_client_token_configurado?: boolean;
    meta_ativo?: boolean;
    meta_app_id?: string | null;
    meta_app_secret?: string | null;
    meta_app_secret_configurado?: boolean;
    meta_business_account_id?: string | null;
    meta_phone_number_id?: string | null;
    meta_access_token?: string | null;
    meta_access_token_configurado?: boolean;
    meta_verify_token?: string | null;
    meta_verify_token_configurado?: boolean;
    meta_webhook_token?: string | null;
    meta_api_version?: string | null;
    meta_status?: 'nao_configurado' | 'conectado' | 'erro' | string;
    meta_ultimo_teste_em?: string | null;
    meta_ultimo_erro?: string | null;
    meta_display_phone_number?: string | null;
    meta_verified_name?: string | null;
    meta_webhook_url?: string | null;
    meta_configurada?: boolean;
    webhook_token?: string | null;
    webhook_configurado?: boolean;
    webhook_urls?: {
        recebimento: string;
        status: string;
    } | null;
    nome_empresa?: string | null;
    nome_responsavel?: string | null;
    telefone_contato?: string | null;
    email_suporte?: string | null;
    email_meta?: string | null;
    fuso_horario?: string | null;
    idioma?: string | null;
    observacoes?: string | null;
    ia_ativa?: boolean;
    ia_modelo?: string | null;
    ia_temperatura?: number | string;
    ia_max_contexto?: number;
    ia_prompt_base?: string | null;
    ia_regras_comerciais?: string | null;
    ia_personalidade?: string | null;
    horario_comercial?: Record<string, unknown>;
    mensagens_padrao?: MensagemPadrao[];
    automacao_agendamento?: {
        ativa: boolean;
        mensagem: string;
        cooldown_horas: number;
    };
    automacao_agendamento_disponivel?: boolean;
    automacao_agendamento_link?: string;
}

export interface MensagemPadrao {
    id: string;
    atalho: string;
    titulo: string;
    mensagem: string;
}

export interface WhatsappDashboard {
    conectado: boolean;
    erroConexao: string | null;
    conversasNaoLidas: number;
    mensagensHoje: number;
    eventosRecentes: WhatsappLogEntry[];
}

export interface WhatsappTesteConexao {
    conectado: boolean;
    smartphoneConectado: boolean;
    webhooksConfigurados: boolean;
    webhookUrls?: WhatsappConfig['webhook_urls'];
    mensagem: string;
}

export interface WhatsappTesteMeta {
    conectado: boolean;
    mensagem: string;
    webhookUrl?: string | null;
    dados?: {
        display_phone_number?: string;
        verified_name?: string;
        quality_rating?: string;
        code_verification_status?: string;
        platform_type?: string;
        throughput?: Record<string, unknown>;
    };
}

export interface WhatsappLogEntry {
    id: number;
    empresa_id: number | null;
    conversa_id: number | null;
    tipo: 'webhook_recebido' | 'mensagem_enviada' | 'falha_envio' | 'conexao' | 'desconexao' | 'diagnostico' | 'merge_confirmado' | 'merge_manual' | 'resposta_automatica';
    mensagem: string | null;
    metadata: Record<string, unknown>;
    criado_em: string;
}

export interface WhatsappLogsPaginado {
    registros: WhatsappLogEntry[];
    total: number;
    pagina: number;
    tamanho: number;
}

// Estágio do lead e assunto deixaram de ser enum fixo — agora são um
// catálogo editável por empresa (ver WhatsappCatalogo/CatalogoService no
// backend). `chave` é o valor estável gravado no cliente; `nome`/`cor` são só
// exibição. Os 11/7 valores originais continuam existindo como seed padrão.
export type TipoCatalogo = 'estagio' | 'motivo_clinico' | 'profissional';

export interface WhatsappCatalogoItem {
    id: number;
    empresa_id: number;
    tipo: TipoCatalogo;
    chave: string;
    nome: string;
    cor: string;
    ordem: number;
}

export interface WhatsappClienteCrm {
    id: number;
    cliente_id: number;
    empresa_id: number;
    status_atendimento: string;
    estagio: string;
    motivo_clinico: string | null;
    profissional: string | null;
    origem: string | null;
    responsavel_id: number | null;
    proximo_retorno: string | null;
    observacoes: string | null;
}

export interface WhatsappClienteFicha {
    cliente: Record<string, any>;
    crm: WhatsappClienteCrm;
    rfm: {
        ultimaCompra: string | null;
        diasSemComprar: number | null;
        totalCompras: number;
        totalGasto: number;
        ticketMedio: number;
        frequenciaMedia: number | null;
        produtoFavorito: string;
        scoreR: number;
        scoreF: number;
        scoreM: number;
        classificacao: string;
        status: string;
        temRecorrAtiva: boolean;
    };
    etiquetas: WhatsappClienteEtiquetaVinculo[];
}

export type TipoEtiqueta = 'etiqueta' | 'protocolo';

export interface WhatsappEtiqueta {
    id: number;
    empresa_id: number;
    tipo: TipoEtiqueta;
    nome: string;
    cor: string;
    created_at: string;
}

export interface WhatsappClienteEtiquetaVinculo {
    id: number;
    cliente_crm_id: number;
    etiqueta_id: number;
    status: 'sugerida' | 'aceita' | 'rejeitada';
    sugerida_por_ia: boolean;
    criado_em: string;
    etiqueta?: WhatsappEtiqueta;
}

export interface WhatsappConversa {
    id: number;
    empresa_id: number;
    cliente_id: number | null;
    telefone: string;
    nome_contato: string | null;
    status: 'aberta' | 'em_atendimento' | 'resolvida';
    nao_lidas: number;
    ultima_mensagem_preview: string | null;
    ultima_mensagem_em: string | null;
    responsavel_id: number | null;
    resumo_ia?: string | null;
    ultima_mensagem_direcao?: 'recebida' | 'enviada' | null;
    nome_editado_manualmente?: boolean;
    criado_em: string;
    atualizado_em: string;
    responsavel?: { id: number; nomeCompleto: string } | null;
    cliente?: {
        id: number;
        nomeCompleto: string;
        telefone: string;
        cpf?: string | null;
        data_nascimento?: string | null;
        whatsappCrm?: WhatsappClienteCrm;
    } | null;
}

// Palpite de junção (opção B): "estes dois podem ser a mesma pessoa?". Nasce
// quando um evento @lid (msg do celular / chamada) não casa com segurança — o
// atendente confirma na tela. Ver DIAGNOSTICO-duplicacao-chamada-e-match.md.
export interface MergeCandidatoConversa {
    id: number;
    nome_contato: string | null;
    telefone: string;
    ultima_mensagem_preview: string | null;
    ultima_mensagem_em: string | null;
}
export interface MergeCandidato {
    id: number;
    empresa_id: number;
    conversa_origem_id: number;
    conversa_alvo_id: number;
    motivo: string | null;
    status: 'pendente' | 'confirmado' | 'descartado';
    criado_em: string;
    conversaOrigem?: MergeCandidatoConversa | null;
    conversaAlvo?: MergeCandidatoConversa | null;
}
// Resultado da busca de contatos pra juntar na mão.
export interface ContatoBusca {
    id: number;
    nome_contato: string | null;
    telefone: string;
    cliente_id: number | null;
    ultima_mensagem_preview: string | null;
    ultima_mensagem_em: string | null;
    criado_em: string | null;
}

export interface WhatsappMensagem {
    id: number;
    conversa_id: number;
    empresa_id: number | null;
    direcao: 'recebida' | 'enviada';
    tipo: 'texto' | 'imagem' | 'documento' | 'audio';
    conteudo_texto: string | null;
    midia_url: string | null;
    midia_nome: string | null;
    midia_mime: string | null;
    zapi_message_id: string | null;
    status: 'enviando' | 'enviada' | 'entregue' | 'lida' | 'falha';
    enviado_por_user_id: number | null;
    origem?: string | null;
    editado_em?: string | null;
    transcricao?: string | null;
    criado_em: string;
}

export type FiltroConversa = 'todos' | 'nao_lidas' | 'aberta' | 'em_atendimento' | 'resolvida';

export interface FiltrosAvancados {
    estagio?: string;
    motivo_clinico?: string;
    profissional?: string;
    etiqueta_id?: number;
    responsavel_id?: number | 'nenhum';
}

export interface AnaliseIA {
    resumo: string | null;
    etiquetas_sugeridas: WhatsappClienteEtiquetaVinculo[];
    estagio_sugerido: WhatsappCatalogoItem | null;
    motivo_sugerido: WhatsappCatalogoItem | null;
}

export interface AvaliacaoAgendamentoIA {
    agendamento_confirmado: boolean;
    data_detectada: string | null;
    horario_detectado: string | null;
}

export interface RelatorioMonitoria {
    id: number;
    empresa_id: number;
    data: string;
    conteudo: {
        pontos_principais: string[];
        objecoes: string[];
        condutas_corretas: string[];
        pontos_melhoria: string[];
        sugestoes_argumentos: string[];
    };
    gerado_por: number | null;
    criado_em: string;
}

// ── Service ────────────────────────────────────────────────────────────────

// O backend embrulha toda resposta em { success, message, data } (ApiResponse).
function unwrap<T>(res: { data: any }): T {
    return (res.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res.data;
}

export const whatsappCrmService = {
    getConfig: () => api.get('/whatsapp-crm/config').then(res => unwrap<WhatsappConfig | null>(res)),
    saveConfig: (data: WhatsappConfig) => api.put('/whatsapp-crm/config', data).then(res => unwrap<WhatsappConfig>(res)),
    testConfig: () => api.post('/whatsapp-crm/config/testar').then(res => unwrap<WhatsappTesteConexao>(res)),
    testMeta: () => api.post('/whatsapp-crm/config/testar-meta').then(res => unwrap<WhatsappTesteMeta>(res)),

    getDashboard: () => api.get('/whatsapp-crm/dashboard').then(res => unwrap<WhatsappDashboard>(res)),

    listLogs: (pagina = 1, tamanho = 20) =>
        api.get('/whatsapp-crm/logs', { params: { pagina, tamanho } }).then(res => unwrap<WhatsappLogsPaginado>(res)),

    lookupClienteByTelefone: (telefone: string) =>
        api.get(`/whatsapp-crm/clientes/telefone/${telefone}`).then(res => unwrap<WhatsappClienteFicha>(res)),
    addObservacao: (clienteId: number, observacao: string) =>
        api.post(`/whatsapp-crm/clientes/${clienteId}/observacoes`, { observacao }).then(res => unwrap(res)),
    addEtiqueta: (clienteId: number, etiqueta_id: number, sugerida_por_ia = false) =>
        api.post(`/whatsapp-crm/clientes/${clienteId}/etiquetas`, { etiqueta_id, sugerida_por_ia }).then(res => unwrap(res)),
    updateEstagio: (clienteId: number, estagio: string) =>
        api.patch(`/whatsapp-crm/clientes/${clienteId}/estagio`, { estagio }).then(res => unwrap<WhatsappClienteCrm>(res)),
    updateMotivoClinico: (clienteId: number, motivo_clinico: string | null) =>
        api.patch(`/whatsapp-crm/clientes/${clienteId}/motivo-clinico`, { motivo_clinico }).then(res => unwrap<WhatsappClienteCrm>(res)),
    updateProfissional: (clienteId: number, profissional: string | null) =>
        api.patch(`/whatsapp-crm/clientes/${clienteId}/profissional`, { profissional }).then(res => unwrap<WhatsappClienteCrm>(res)),

    listEtiquetas: (tipo: TipoEtiqueta = 'etiqueta') =>
        api.get('/whatsapp-crm/etiquetas', { params: { tipo } }).then(res => unwrap<WhatsappEtiqueta[]>(res)),
    createEtiqueta: (nome: string, cor?: string, tipo: TipoEtiqueta = 'etiqueta') =>
        api.post('/whatsapp-crm/etiquetas', { nome, cor, tipo }).then(res => unwrap<WhatsappEtiqueta>(res)),
    updateEtiqueta: (id: number, nome: string, cor?: string) =>
        api.put(`/whatsapp-crm/etiquetas/${id}`, { nome, cor }).then(res => unwrap<WhatsappEtiqueta>(res)),
    deleteEtiqueta: (id: number) => api.delete(`/whatsapp-crm/etiquetas/${id}`).then(res => unwrap(res)),
    removeEtiquetaDoCliente: (vinculoId: number) =>
        api.delete(`/whatsapp-crm/etiquetas/vinculo/${vinculoId}`).then(res => unwrap(res)),
    aceitarSugestaoEtiqueta: (vinculoId: number) =>
        api.patch(`/whatsapp-crm/etiquetas/vinculo/${vinculoId}/aceitar`).then(res => unwrap(res)),

    listCatalogo: (tipo: TipoCatalogo) =>
        api.get(`/whatsapp-crm/catalogos/${tipo}`).then(res => unwrap<WhatsappCatalogoItem[]>(res)),
    createCatalogoItem: (tipo: TipoCatalogo, nome: string, cor?: string) =>
        api.post(`/whatsapp-crm/catalogos/${tipo}`, { nome, cor }).then(res => unwrap<WhatsappCatalogoItem>(res)),
    updateCatalogoItem: (tipo: TipoCatalogo, id: number, nome: string, cor?: string) =>
        api.put(`/whatsapp-crm/catalogos/${tipo}/${id}`, { nome, cor }).then(res => unwrap<WhatsappCatalogoItem>(res)),
    deleteCatalogoItem: (tipo: TipoCatalogo, id: number) =>
        api.delete(`/whatsapp-crm/catalogos/${tipo}/${id}`).then(res => unwrap(res)),

    listConversas: (filtro: FiltroConversa = 'todos', busca?: string, avancados?: FiltrosAvancados) =>
        api.get('/whatsapp-crm/conversas', { params: { status: filtro, busca, ...avancados } }).then(res => unwrap<WhatsappConversa[]>(res)),
    iniciarConversa: (dados: { cliente_id?: number; telefone?: string; nome_contato?: string }) =>
        api.post('/whatsapp-crm/conversas', dados).then(res => unwrap<WhatsappConversa>(res)),
    getConversa: (id: number) => api.get(`/whatsapp-crm/conversas/${id}`).then(res => unwrap<WhatsappConversa>(res)),
    updateConversaStatus: (id: number, status: WhatsappConversa['status']) =>
        api.patch(`/whatsapp-crm/conversas/${id}/status`, { status }).then(res => unwrap<WhatsappConversa>(res)),
    updateConversaResponsavel: (id: number, responsavel_id: number | null) =>
        api.patch(`/whatsapp-crm/conversas/${id}/responsavel`, { responsavel_id }).then(res => unwrap<WhatsappConversa>(res)),
    renomearContato: (id: number, nome_contato: string) =>
        api.patch(`/whatsapp-crm/conversas/${id}/nome`, { nome_contato }).then(res => unwrap<WhatsappConversa>(res)),
    marcarConversaLida: (id: number) =>
        api.post(`/whatsapp-crm/conversas/${id}/marcar-lida`).then(res => unwrap<WhatsappConversa>(res)),

    listMensagens: (conversaId: number) =>
        api.get(`/whatsapp-crm/conversas/${conversaId}/mensagens`).then(res => unwrap<WhatsappMensagem[]>(res)),
    enviarTexto: (conversaId: number, texto: string) =>
        api.post(`/whatsapp-crm/conversas/${conversaId}/mensagens`, { texto }).then(res => unwrap<WhatsappMensagem>(res)),
    reenviarMensagem: (conversaId: number, mensagemId: number) =>
        api.post(`/whatsapp-crm/conversas/${conversaId}/mensagens/${mensagemId}/reenviar`).then(res => unwrap<WhatsappMensagem>(res)),
    enviarMidia: (conversaId: number, tipo: 'imagem' | 'documento' | 'audio', arquivo: File, caption?: string) => {
        const form = new FormData();
        form.append('midia', arquivo);
        form.append('tipo', tipo);
        if (caption) form.append('texto', caption);
        return api.post(`/whatsapp-crm/conversas/${conversaId}/mensagens`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(res => unwrap<WhatsappMensagem>(res));
    },

    analisarConversaComIA: (conversaId: number) =>
        api.post(`/whatsapp-crm/conversas/${conversaId}/analisar-ia`).then(res => unwrap<AnaliseIA>(res)),
    avaliarAgendamentoComIA: (conversaId: number) =>
        api.post(`/whatsapp-crm/conversas/${conversaId}/avaliar-agendamento`).then(res => unwrap<AvaliacaoAgendamentoIA>(res)),

    buscarUltimoRelatorioMonitoria: () =>
        api.get(`/whatsapp-crm/monitoria/relatorio`).then(res => unwrap<RelatorioMonitoria | null>(res)),
    gerarRelatorioMonitoria: () =>
        api.post(`/whatsapp-crm/monitoria/relatorio`).then(res => unwrap<RelatorioMonitoria>(res)),

    editarMensagem: (conversaId: number, mensagemId: number, texto: string) =>
        api.patch(`/whatsapp-crm/conversas/${conversaId}/mensagens/${mensagemId}`, { texto }).then(res => unwrap<WhatsappMensagem>(res)),
    transcreverMensagem: (conversaId: number, mensagemId: number) =>
        api.post(`/whatsapp-crm/conversas/${conversaId}/mensagens/${mensagemId}/transcrever`).then(res => unwrap<WhatsappMensagem>(res)),

    // Merge na tela (opção B): palpites pendentes de "são a mesma pessoa?" +
    // confirmar (junta as conversas) / descartar (nunca sugere de novo).
    listMergePendentes: () =>
        api.get('/whatsapp-crm/merge/pendentes').then(res => unwrap<MergeCandidato[]>(res)),
    confirmarMerge: (id: number) =>
        api.post(`/whatsapp-crm/merge/${id}/confirmar`).then(res => unwrap<{ conversaId: number }>(res)),
    descartarMerge: (id: number) =>
        api.post(`/whatsapp-crm/merge/${id}/descartar`).then(res => unwrap<{ ok: boolean }>(res)),
    // Juntar na mão: busca o outro contato e funde as duas conversas (a mais
    // antiga vira principal — decidido no backend).
    buscarContatos: (q: string, excluirId?: number) =>
        api.get('/whatsapp-crm/merge/buscar', { params: { q, excluir: excluirId } }).then(res => unwrap<ContatoBusca[]>(res)),
    mergeManual: (conversaA: number, conversaB: number) =>
        api.post('/whatsapp-crm/merge/manual', { conversa_a: conversaA, conversa_b: conversaB }).then(res => unwrap<{ conversaId: number }>(res)),
};

export default whatsappCrmService;
