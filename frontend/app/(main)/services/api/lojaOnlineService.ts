import axios from 'axios';
import api from './baseApi';
import { getApiUrl } from './apiConfig';

const LOCAL_PRODUCTS_KEY = 'saude_e_vida_loja_produtos';
const LOCAL_ORDERS_KEY = 'saude_e_vida_loja_pedidos';
const LOCAL_CUSTOMERS_KEY = 'saude_e_vida_loja_clientes';
const LOCAL_CUSTOMER_KEY = 'saude_e_vida_loja_cliente_atual';
const LOCAL_CUSTOMER_TOKEN_KEY = 'saude_e_vida_loja_cliente_token';
const LOCAL_COUPONS_KEY = 'saude_e_vida_loja_cupons';
const LOCAL_CATEGORIES_KEY = 'saude_e_vida_loja_categorias';
const LOCAL_CATEGORIES_SEED: LojaCategoria[] = [
    { id: -1, nome: 'Alimentação saudável', slug: 'alimentacao-saudavel', ordem: 0, ativo: true },
    { id: -2, nome: 'Autocuidado', slug: 'autocuidado', ordem: 1, ativo: true },
    { id: -3, nome: 'Cápsulas e suplementos', slug: 'capsulas-e-suplementos', ordem: 2, ativo: true },
    { id: -4, nome: 'Chás e infusões', slug: 'chas-e-infusoes', ordem: 3, ativo: true },
];
const cidadePermiteEntregaLocal = (cidade: unknown, estado: unknown) => {
    const normalizar = (valor: unknown) => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    return normalizar(estado) === 'pb' && ['campina grande', 'esperanca'].includes(normalizar(cidade));
};

// A loja pública não pode reutilizar o interceptor da API interna: ele troca o
// Authorization pelo token do usuário administrativo. Esta instância mantém
// o token da conta do cliente da loja separado.
const publicApi = axios.create({
    baseURL: getApiUrl(),
    headers: { 'Content-Type': 'application/json' },
});

const LOCAL_PRODUCTS_SEED: LojaProdutoConfiguracao[] = [
    { id: 1, nome: 'Chá verde orgânico', codigo: 'CHA-001', categoria_estoque: 'Chás', preco_estoque: 18.9, estoque: 24, unidade: 'un', ativo: true, preco: 24.9, preco_original: 29.9, categoria: 'Chás e infusões', descricao: 'Chá verde orgânico para sua rotina de bem-estar.', foto_url: null, secoes: ['destaques', 'mais-vendidos'], ordem: 1, destaque: true, promocao: true, vendidos: 38 },
    { id: 2, nome: 'Granola natural', codigo: 'GRA-001', categoria_estoque: 'Alimentos', preco_estoque: 22.5, estoque: 18, unidade: 'un', ativo: true, preco: 29.9, preco_original: null, categoria: 'Alimentação saudável', descricao: 'Granola crocante com ingredientes selecionados.', foto_url: null, secoes: ['destaques'], ordem: 2, destaque: true, promocao: false, vendidos: 26 },
    { id: 3, nome: 'Whey protein natural', codigo: 'SUP-001', categoria_estoque: 'Suplementos', preco_estoque: 89.9, estoque: 12, unidade: 'un', ativo: true, preco: 99.9, preco_original: 119.9, categoria: 'Cápsulas e suplementos', descricao: 'Suplemento para apoiar uma rotina ativa.', foto_url: null, secoes: ['promocoes', 'mais-vendidos'], ordem: 3, destaque: false, promocao: true, vendidos: 54 },
    { id: 4, nome: 'Kit autocuidado', codigo: 'KIT-001', categoria_estoque: 'Cuidados', preco_estoque: 45, estoque: 8, unidade: 'un', ativo: true, preco: 59.9, preco_original: null, categoria: 'Autocuidado', descricao: 'Uma seleção especial para momentos de cuidado.', foto_url: null, secoes: ['promocoes'], ordem: 4, destaque: false, promocao: false, vendidos: 17 },
    { id: 5, nome: 'Castanha de caju torrada', codigo: 'GRA-002', categoria_estoque: 'Granel', preco_estoque: 42, estoque: 18.5, unidade: 'kg', ativo: true, preco: 49.9, preco_kg: 49.9, a_granel: true, preco_original: null, categoria: 'Granel', descricao: 'Castanha selecionada para comprar na quantidade que você quiser.', foto_url: null, secoes: ['destaques', 'mais-vendidos'], ordem: 5, destaque: true, promocao: false, vendidos: 31 },
];

const ambienteLocal = () => typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.localStorage.getItem('modo_local') === 'true'
);

function lerLocal<T>(chave: string, padrao: T): T {
    if (typeof window === 'undefined') return padrao;
    try {
        const salvo = window.localStorage.getItem(chave);
        if (salvo) return JSON.parse(salvo) as T;
    } catch { /* usa o padrão */ }
    window.localStorage.setItem(chave, JSON.stringify(padrao));
    return JSON.parse(JSON.stringify(padrao)) as T;
}

function salvarLocal<T>(chave: string, valor: T) {
    if (typeof window !== 'undefined') window.localStorage.setItem(chave, JSON.stringify(valor));
}

function respostaLocal<T>(data: T): { data: T } {
    return { data };
}

function arquivoComoDataUrl(arquivo: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
        reader.readAsDataURL(arquivo);
    });
}

function otimizarImagem(arquivo: File): Promise<File> {
    if (typeof window === 'undefined' || arquivo.size <= 1.5 * 1024 * 1024) return Promise.resolve(arquivo);

    return new Promise((resolve, reject) => {
        const imagem = new Image();
        const url = URL.createObjectURL(arquivo);
        imagem.onload = () => {
            URL.revokeObjectURL(url);
            const limite = 1600;
            const escala = Math.min(1, limite / Math.max(imagem.naturalWidth, imagem.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
            canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
            canvas.getContext('2d')?.drawImage(imagem, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Não foi possível preparar a imagem para o envio.'));
                    return;
                }
                resolve(new File([blob], `${arquivo.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.82);
        };
        imagem.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Não foi possível ler a imagem selecionada.'));
        };
        imagem.src = url;
    });
}

export type LojaProduto = {
    id: number;
    nome: string;
    nome_original?: string | null;
    nome_loja?: string | null;
    codigo?: string | null;
    categoria?: string | null;
    fabricante?: string | null;
    preco: number;
    estoque: number;
    unidade: string;
    disponivel: boolean;
    descricao?: string | null;
    foto_url?: string | null;
    secoes?: string[];
    ordem?: number;
    destaque?: boolean;
    promocao?: boolean;
    preco_original?: number | null;
    vendidos?: number;
    a_granel?: boolean;
    preco_kg?: number | null;
};

export type LojaProdutoConfiguracao = {
    id: number;
    nome: string;
    nome_original?: string | null;
    nome_loja?: string | null;
    codigo?: string | null;
    categoria_estoque?: string | null;
    preco_estoque: number;
    estoque: number;
    unidade: string;
    ativo: boolean;
    configurado?: boolean;
    preco: number;
    categoria: string;
    descricao: string;
    foto_url?: string | null;
    secoes: string[];
    ordem: number;
    destaque: boolean;
    promocao: boolean;
    preco_original?: number | null;
    vendidos: number;
    a_granel?: boolean;
    preco_kg?: number | null;
};

export type LojaCatalogo = {
    empresa: { id: number; nome: string; slug: string };
    categorias?: LojaCategoria[];
    produtos: LojaProduto[];
};

export type LojaCategoria = {
    id: number;
    nome: string;
    slug: string;
    ordem: number;
    ativo: boolean;
    sistema?: boolean;
    em_uso?: boolean;
    legado?: boolean;
};

export type LojaCliente = {
    id: number;
    nome: string;
    email: string;
    telefone: string;
    cep?: string | null;
    rua?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
  pontos_saldo?: number;
  pontos_acumulados?: number;
};

export type LojaPremio = {
  id: number;
  nome: string;
  descricao?: string | null;
  tipo: 'desconto_percentual' | 'desconto_fixo' | 'produto';
  valor: number;
  pontos_custo: number;
  produto_id?: number | null;
  chance: number;
  estoque?: number | null;
  ativo: boolean;
};

export type LojaPontosResumo = {
  saldo: number;
  acumulados: number;
  pontos_por_real: number;
  premios: LojaPremio[];
  resgates: Array<{ id: number; codigo: string; pontos: number; status: string; premio_id: number; cupom_id?: number | null; validade_fim?: string | null; titulo?: string | null }>;
};

export type LojaRoletaLead = {
  id: number;
  token: string;
  nome: string;
  email: string;
  telefone: string;
  cidade?: string | null;
  estado?: string | null;
  status: string;
  codigo_premio?: string | null;
  premio_email_status?: string;
  premio?: LojaPremio | null;
  cliente_id?: number | null;
  created_at?: string;
};

export type LojaCupom = {
    id: number;
    codigo: string;
    titulo: string;
    tipo: 'percentual' | 'fixo';
    valor: number;
    validade_inicio?: string | null;
    validade_fim?: string | null;
    limite_uso?: number | null;
    usos: number;
    ativo: boolean;
    mensagem?: string | null;
};

export type LojaCupomCliente = Pick<LojaCliente, 'id' | 'nome' | 'email' | 'telefone'>;
export type LojaLoginResposta = { tipo?: 'CLIENTE_LOJA' | 'SISTEMA'; token?: string; cliente?: LojaCliente; mensagem?: string };

export type LojaPedido = {
    id: number;
    valor_total: number | string;
    forma_pagamento: string;
    forma_entrega?: 'entrega' | 'retirada' | string;
    endereco_entrega?: string | null;
    status_loja: string;
    status_loja_atualizado_em?: string | null;
    status_loja_historico?: Array<{ status: string; em: string; origem?: string }>;
    mercado_pago_payment_id?: string | null;
    mercado_pago_status?: string | null;
    mercado_pago_reembolso_id?: string | null;
    mercado_pago_reembolso_status?: string | null;
    mercado_pago_reembolsado_em?: string | null;
    data: string;
    createdAt?: string;
    cliente?: {
        nomeCompleto: string;
        telefone: string;
        email?: string | null;
        rua?: string | null;
        numero?: string | null;
        complemento?: string | null;
        cep?: string | null;
        cidade?: string | null;
        estado?: string | null;
    } | null;
    itens: Array<{
        id: number;
        nome_item?: string | null;
        quantidade: number | string;
        valor_unitario: number | string;
        valor_total: number | string;
        Product?: { name: string; currentQuantity: number | string; unidade_medida?: string | null } | null;
    }>;
};

export type LojaPedidoResposta = {
  pedido: number;
  status: string;
  valor_total?: number;
  desconto?: number;
  cupom?: string | null;
  mensagem: string;
  pagamento_online?: {
    provider: string;
    payment_id?: string | number;
    status?: string;
    status_detail?: string | null;
    pix?: {
      qr_code?: string | null;
      qr_code_base64?: string | null;
      ticket_url?: string | null;
    } | null;
  } | null;
};

export type LojaCupomValidado = {
  cupom_id?: number;
  codigo: string;
  tipo: 'percentual' | 'fixo';
  valor: number;
  valor_bruto: number;
  desconto: number;
  valor_total: number;
  mensagem: string;
};

function tokenCliente() {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(LOCAL_CUSTOMER_TOKEN_KEY) || '';
}

function publicConfig() {
    const token = tokenCliente();
    return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
}

function persistirCliente(resposta: { token: string; cliente: LojaCliente }) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LOCAL_CUSTOMER_TOKEN_KEY, resposta.token);
    window.localStorage.setItem(LOCAL_CUSTOMER_KEY, JSON.stringify(resposta.cliente));
}

function clienteLocal() {
    if (typeof window === 'undefined') return null;
    try {
        const salvo = window.localStorage.getItem(LOCAL_CUSTOMER_KEY);
        return salvo ? JSON.parse(salvo) as LojaCliente : null;
    } catch {
        return null;
    }
}

export const lojaOnlineService = {
    catalogoPublico: async (slug = 'saude-e-vida') => {
        if (ambienteLocal()) {
            try { return await api.get<LojaCatalogo>(`/loja/public/${slug}`); } catch { /* fallback local */ }
            const categoriasSalvas = lerLocal<LojaCategoria[]>(LOCAL_CATEGORIES_KEY, []);
            const categoriasCriadas = categoriasSalvas.length ? categoriasSalvas : LOCAL_CATEGORIES_SEED;
            const nomesCategorias = new Set(categoriasCriadas.filter((categoria) => categoria.ativo !== false).map((categoria) => categoria.nome));
            const produtos = lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED)
                .filter((produto) => produto.ativo && produto.estoque > 0)
                .map((produto) => {
                    const aGranel = Boolean(produto.a_granel) || produto.categoria === 'Granel';
                    const categoria = aGranel ? 'Granel' : produto.categoria;
                    return { id: produto.id, nome: produto.nome_loja || produto.nome, nome_original: produto.nome_original || produto.nome, nome_loja: produto.nome_loja || null, codigo: produto.codigo, categoria, fabricante: null, preco: Number(aGranel ? (produto.preco_kg ?? produto.preco) : produto.preco), estoque: Number(produto.estoque), unidade: produto.unidade, disponivel: true, descricao: produto.descricao, foto_url: produto.foto_url, secoes: produto.secoes, ordem: produto.ordem, destaque: produto.destaque, promocao: produto.promocao, preco_original: produto.preco_original, vendidos: produto.vendidos, a_granel: aGranel, preco_kg: aGranel ? produto.preco_kg ?? produto.preco : null };
                })
                .filter((produto) => produto.categoria === 'Granel' || nomesCategorias.has(produto.categoria || ''));
            const categorias = [{ id: 0, nome: 'Granel', slug: 'granel', ordem: -1, ativo: true, sistema: true }, ...categoriasCriadas.filter((categoria) => categoria.ativo !== false && categoria.nome !== 'Granel')];
            return respostaLocal<LojaCatalogo>({ empresa: { id: 1, nome: 'Saúde e Vida', slug }, categorias, produtos });
        }
        return api.get<LojaCatalogo>(`/loja/public/${slug}`);
    },
    clienteAtual: async (slug = 'saude-e-vida') => {
        const token = tokenCliente();
        if (!token) return respostaLocal<{ cliente: LojaCliente | null }>({ cliente: clienteLocal() });
        try {
            const resposta = await publicApi.get<{ cliente: LojaCliente }>(`/loja/public/${slug}/clientes/me`, publicConfig());
            persistirCliente({ token, cliente: resposta.data.cliente });
            return resposta;
        } catch (error: any) {
            if (error?.response?.status === 401 && typeof window !== 'undefined') {
                lojaOnlineService.sairCliente();
                return respostaLocal<{ cliente: LojaCliente | null }>({ cliente: null });
            }
            return respostaLocal<{ cliente: LojaCliente | null }>({ cliente: clienteLocal() });
        }
    },
    meusPedidos: async (slug = 'saude-e-vida') => {
        const cliente = clienteLocal();
        if (!cliente) return respostaLocal<LojaPedido[]>([]);
        if (!ambienteLocal()) return publicApi.get<LojaPedido[]>(`/loja/public/${slug}/clientes/me/pedidos`, publicConfig());
        try { return await publicApi.get<LojaPedido[]>(`/loja/public/${slug}/clientes/me/pedidos`, publicConfig()); } catch (error: any) {
            if (error?.response) throw error;
        }
        const pedidos = lerLocal<LojaPedido[]>(LOCAL_ORDERS_KEY, []);
        return respostaLocal(pedidos.filter((pedido) => pedido.cliente?.email === cliente.email));
    },
    cadastrarCliente: async (slug: string, dados: { nome: string; telefone: string; email: string; senha: string }) => {
        if (ambienteLocal()) {
            try {
                const resposta = await publicApi.post<{ token: string; cliente: LojaCliente }>(`/loja/public/${slug}/clientes/cadastro`, dados);
                persistirCliente(resposta.data);
                return resposta;
            } catch (error: any) {
                if (error?.response) throw error;
            }
            const clientes = lerLocal<Array<LojaCliente & { senha: string }>>(LOCAL_CUSTOMERS_KEY, []);
            const email = dados.email.trim().toLowerCase();
            if (clientes.some((cliente) => cliente.email === email)) throw new Error('Já existe uma conta com este e-mail. Faça login para continuar.');
            const cliente: LojaCliente = { id: Date.now(), nome: dados.nome.trim(), telefone: dados.telefone.trim(), email };
            salvarLocal(LOCAL_CUSTOMERS_KEY, [...clientes, { ...cliente, senha: dados.senha }]);
            persistirCliente({ token: 'local-client-token', cliente });
            return respostaLocal({ token: 'local-client-token', cliente });
        }
        const resposta = await publicApi.post<{ token: string; cliente: LojaCliente }>(`/loja/public/${slug}/clientes/cadastro`, dados);
        persistirCliente(resposta.data);
        return resposta;
    },
    loginCliente: async (slug: string, dados: { email: string; senha: string }) => {
        if (ambienteLocal()) {
            try {
                const resposta = await publicApi.post<LojaLoginResposta>(`/loja/public/${slug}/clientes/login`, dados);
                if (resposta.data.tipo === 'SISTEMA') throw new Error(resposta.data.mensagem || 'Esta é uma conta do sistema.');
                const tokenResposta = resposta.data.token;
                const clienteResposta = resposta.data.cliente;
                if (!tokenResposta || !clienteResposta) throw new Error('A resposta de acesso da loja está incompleta.');
                persistirCliente({ token: tokenResposta, cliente: clienteResposta });
                return resposta;
            } catch (error: any) {
                if (error?.response) throw error;
            }
            const email = dados.email.trim().toLowerCase();
            const clientes = lerLocal<Array<LojaCliente & { senha: string }>>(LOCAL_CUSTOMERS_KEY, []);
            const cliente = clientes.find((item) => item.email === email && item.senha === dados.senha);
            if (!cliente) throw new Error('E-mail ou senha inválidos.');
            const { senha: _senha, ...publico } = cliente;
            persistirCliente({ token: 'local-client-token', cliente: publico });
            return respostaLocal({ token: 'local-client-token', cliente: publico });
        }
        const resposta = await publicApi.post<LojaLoginResposta>(`/loja/public/${slug}/clientes/login`, dados);
        if (resposta.data.tipo === 'SISTEMA') throw new Error(resposta.data.mensagem || 'Esta é uma conta do sistema.');
        const tokenResposta = resposta.data.token;
        const clienteResposta = resposta.data.cliente;
        if (!tokenResposta || !clienteResposta) throw new Error('A resposta de acesso da loja está incompleta.');
        persistirCliente({ token: tokenResposta, cliente: clienteResposta });
        return resposta;
    },
    iniciarRoleta: async (slug: string, dados: Record<string, unknown>) => publicApi.post<{ token: string; lead: LojaRoletaLead; premios: LojaPremio[] }>(`/loja/public/${slug}/roleta/iniciar`, dados),
    girarRoleta: async (slug: string, token: string) => publicApi.post<{ premio: LojaPremio; premio_id: number; codigo: string; email_status: string }>(`/loja/public/${slug}/roleta/girar`, { token }),
    pontosCliente: async (slug: string) => publicApi.get<LojaPontosResumo>(`/loja/public/${slug}/pontos`, publicConfig()),
    resgatarPontos: async (slug: string, premio_id: number) => publicApi.post<{ codigo: string; premio: LojaPremio; pontos_restantes: number }>(`/loja/public/${slug}/pontos/resgatar`, { premio_id }, publicConfig()),
    validarCupomCaixa: async (payload: { codigo: string; cliente_id: number; valor_bruto: number; itens: Array<{ produto_id?: number | null; valor_total?: number; quantidade?: number; valor_unitario?: number }> }) => api.post<LojaCupomValidado>('/loja/cupons/validar-caixa', payload),
    listarRoletaLeads: async () => api.get<LojaRoletaLead[]>('/loja/roleta/leads'),
    decidirRoletaLead: async (id: number, cadastrar: boolean) => api.patch<LojaRoletaLead>(`/loja/roleta/leads/${id}/cadastro`, { cadastrar }),
    listarPremios: async () => api.get<LojaPremio[]>('/loja/roleta/premios'),
    listarProdutosPremios: async () => api.get<Array<{ id: number; name: string; price: number; currentQuantity: number }>>('/loja/roleta/premios/produtos'),
    criarPremio: async (payload: Partial<LojaPremio>) => api.post<LojaPremio>('/loja/roleta/premios', payload),
    atualizarPremio: async (id: number, payload: Partial<LojaPremio>) => api.put<LojaPremio>(`/loja/roleta/premios/${id}`, payload),
    excluirPremio: async (id: number) => api.delete<LojaPremio>(`/loja/roleta/premios/${id}`),
    sairCliente: () => {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(LOCAL_CUSTOMER_TOKEN_KEY);
        window.localStorage.removeItem(LOCAL_CUSTOMER_KEY);
    },
    listarCupons: async () => {
        if (!ambienteLocal()) return api.get<LojaCupom[]>('/loja/cupons');
        try { return await api.get<LojaCupom[]>('/loja/cupons'); } catch { /* fallback local */ }
        return respostaLocal(lerLocal<LojaCupom[]>(LOCAL_COUPONS_KEY, []));
    },
    listarClientesParaCupons: async () => {
        if (!ambienteLocal()) return api.get<LojaCupomCliente[]>('/loja/cupons/clientes');
        try { return await api.get<LojaCupomCliente[]>('/loja/cupons/clientes'); } catch { /* fallback local */ }
        return respostaLocal(lerLocal<Array<LojaCliente & { senha?: string }>>(LOCAL_CUSTOMERS_KEY, []).map(({ id, nome, email, telefone }) => ({ id, nome, email, telefone })));
    },
    criarCupom: async (payload: Partial<LojaCupom>) => {
        if (!ambienteLocal()) return api.post<LojaCupom>('/loja/cupons', payload);
        try { return await api.post<LojaCupom>('/loja/cupons', payload); } catch { /* fallback local */ }
        const cupons = lerLocal<LojaCupom[]>(LOCAL_COUPONS_KEY, []);
        const cupom: LojaCupom = { id: Date.now(), codigo: String(payload.codigo || '').toUpperCase(), titulo: String(payload.titulo || ''), tipo: payload.tipo === 'fixo' ? 'fixo' : 'percentual', valor: Number(payload.valor || 0), validade_inicio: payload.validade_inicio || null, validade_fim: payload.validade_fim || null, limite_uso: payload.limite_uso || null, usos: 0, ativo: payload.ativo !== false, mensagem: payload.mensagem || null };
        salvarLocal(LOCAL_COUPONS_KEY, [...cupons, cupom]);
        return respostaLocal(cupom);
    },
    enviarCupom: async (id: number, cliente_ids: number[]) => {
        if (!ambienteLocal()) return api.post(`/loja/cupons/${id}/enviar`, { cliente_ids });
        try { return await api.post(`/loja/cupons/${id}/enviar`, { cliente_ids }); } catch (error: any) {
            if (error?.response) throw error;
            throw new Error('Conecte o WhatsApp CRM para enviar cupons aos clientes.');
        }
    },
    criarPedido: async (slug: string, payload: any) => {
        const cliente = clienteLocal();
        if (!cliente) throw new Error('Faça login ou crie sua conta antes de finalizar o pedido.');
        if (String(payload?.forma_entrega || 'retirada').toLowerCase() === 'entrega' && !cidadePermiteEntregaLocal(payload?.cidade, payload?.estado)) {
            throw new Error('A entrega está disponível somente para Campina Grande e Esperança/PB.');
        }
        if (!ambienteLocal()) return publicApi.post(`/loja/public/${slug}/pedidos`, payload, publicConfig());
        try { return await publicApi.post(`/loja/public/${slug}/pedidos`, payload, publicConfig()); } catch (error: any) {
            if (error?.response) throw error;
        }
        const produtos = lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED);
        const itens = Array.isArray(payload?.itens) ? payload.itens : [];
        const itensPedido = itens.map((item: any) => {
            const produto = produtos.find((itemProduto) => itemProduto.id === Number(item.produto_id));
            const quantidade = Number(item.quantidade || 0);
            if (!produto || !produto.ativo || quantidade <= 0 || produto.estoque < quantidade) throw new Error('Produto sem estoque suficiente.');
            produto.estoque -= quantidade;
            produto.vendidos = Number(produto.vendidos || 0) + quantidade;
            return { id: Date.now() + produto.id, nome_item: produto.nome, quantidade, valor_unitario: Number(produto.preco), valor_total: Number(produto.preco) * quantidade, Product: { name: produto.nome, currentQuantity: produto.estoque, unidade_medida: produto.unidade } };
        });
        if (!itensPedido.length) throw new Error('Adicione pelo menos um produto ao carrinho.');
        const pedidos = lerLocal<LojaPedido[]>(LOCAL_ORDERS_KEY, []);
        const id = pedidos.reduce((maior, pedido) => Math.max(maior, Number(pedido.id)), 0) + 1;
        const agora = new Date().toISOString();
        const pedido: LojaPedido = { id, valor_total: itensPedido.reduce((total: number, item: any) => total + item.valor_total, 0), forma_pagamento: payload?.forma_pagamento || 'pix', forma_entrega: payload?.forma_entrega || 'retirada', status_loja: 'novo', status_loja_atualizado_em: agora, status_loja_historico: [{ status: 'novo', em: agora, origem: 'cliente' }], data: agora, createdAt: agora, cliente: { nomeCompleto: cliente.nome, telefone: cliente.telefone, email: cliente.email, cidade: payload?.cidade || null, estado: payload?.estado || null }, itens: itensPedido };
        salvarLocal(LOCAL_PRODUCTS_KEY, produtos);
        salvarLocal(LOCAL_ORDERS_KEY, [...pedidos, pedido]);
        return respostaLocal<LojaPedidoResposta>({ pedido: id, status: 'novo', mensagem: 'Pedido registrado no modo local. Ele aparecerá na gestão da lojinha.', pagamento_online: null });
    },
    validarCupom: async (slug: string, payload: { codigo: string; valor_bruto: number; produto_ids?: number[]; itens?: Array<{ produto_id: number; quantidade: number; valor_unitario: number }> }) => {
        return publicApi.post<LojaCupomValidado>(`/loja/public/${slug}/cupom/validar`, payload, publicConfig());
    },
    listarPedidos: async (status?: string) => {
        if (!ambienteLocal()) return api.get<LojaPedido[]>('/loja/pedidos', { params: status ? { status } : {} });
        try { return await api.get<LojaPedido[]>('/loja/pedidos', { params: status ? { status } : {} }); } catch { /* fallback local */ }
        const pedidos = lerLocal<LojaPedido[]>(LOCAL_ORDERS_KEY, []);
        return respostaLocal(status ? pedidos.filter((pedido) => pedido.status_loja === status) : pedidos);
    },
    atualizarStatus: async (id: number, status: string) => {
        if (!ambienteLocal()) return api.patch(`/loja/pedidos/${id}/status`, { status });
        try { return await api.patch(`/loja/pedidos/${id}/status`, { status }); } catch { /* fallback local */ }
        const pedidos = lerLocal<LojaPedido[]>(LOCAL_ORDERS_KEY, []);
        const pedido = pedidos.find((item) => item.id === id);
        if (!pedido) throw new Error('Pedido não encontrado.');
        if (pedido.status_loja === 'cancelado' && status !== 'cancelado') throw new Error('Pedido cancelado não pode voltar ao fluxo.');
        if (status === 'cancelado' && pedido.status_loja !== 'cancelado') {
            const produtos = lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED);
            pedido.itens.forEach((item) => { const produto = produtos.find((produtoAtual) => produtoAtual.nome === item.nome_item); if (produto) produto.estoque += Number(item.quantidade || 0); });
            salvarLocal(LOCAL_PRODUCTS_KEY, produtos);
        }
        pedido.status_loja = status;
        pedido.status_loja_atualizado_em = new Date().toISOString();
        pedido.status_loja_historico = [...(pedido.status_loja_historico || []), { status, em: pedido.status_loja_atualizado_em, origem: 'gestao' }];
        salvarLocal(LOCAL_ORDERS_KEY, pedidos);
        return respostaLocal(pedido);
    },
    cancelarPedido: async (id: number, payload: { reembolsar?: boolean; motivo?: string } = {}) => {
        if (!ambienteLocal()) return api.post(`/loja/pedidos/${id}/cancelar`, payload);
        try { return await api.post(`/loja/pedidos/${id}/cancelar`, payload); } catch (error: any) {
            if (error?.response) throw error;
        }
        const pedidos = lerLocal<LojaPedido[]>(LOCAL_ORDERS_KEY, []);
        const pedido = pedidos.find((item) => item.id === id);
        if (!pedido) throw new Error('Pedido não encontrado.');
        if (pedido.status_loja !== 'cancelado') {
            const produtos = lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED);
            pedido.itens.forEach((item) => { const produto = produtos.find((produtoAtual) => produtoAtual.nome === item.nome_item); if (produto) produto.estoque += Number(item.quantidade || 0); });
            salvarLocal(LOCAL_PRODUCTS_KEY, produtos);
            pedido.status_loja = 'cancelado';
            pedido.status_loja_atualizado_em = new Date().toISOString();
            pedido.status_loja_historico = [...(pedido.status_loja_historico || []), { status: 'cancelado', em: pedido.status_loja_atualizado_em, origem: 'gestao' }];
        }
        if (payload.reembolsar) pedido.mercado_pago_reembolso_status = 'nao_aplicavel';
        salvarLocal(LOCAL_ORDERS_KEY, pedidos);
        return respostaLocal({ pedido, cancelado: true, reembolso: { status: pedido.mercado_pago_reembolso_status || 'nao_solicitado' }, mensagem: payload.reembolsar ? 'Venda cancelada no modo local. O reembolso online exige o Mercado Pago conectado.' : 'Venda cancelada e estoque devolvido.' });
    },
    listarConfiguracao: async () => {
        if (!ambienteLocal()) return api.get<LojaProdutoConfiguracao[]>('/loja/configuracao');
        try { return await api.get<LojaProdutoConfiguracao[]>('/loja/configuracao'); } catch { /* fallback local */ }
        return respostaLocal(lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED).filter((produto) => produto.ativo || produto.configurado));
    },
    listarProdutosEstoque: async () => {
        if (!ambienteLocal()) return api.get<LojaProdutoConfiguracao[]>('/loja/configuracao/estoque');
        try { return await api.get<LojaProdutoConfiguracao[]>('/loja/configuracao/estoque'); } catch { /* fallback local */ }
        return respostaLocal(lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED));
    },
    listarCategorias: async () => {
        if (!ambienteLocal()) return api.get<LojaCategoria[]>('/loja/categorias');
        try { return await api.get<LojaCategoria[]>('/loja/categorias'); } catch { /* fallback local */ }
        const produtos = lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED);
        const categoriasSalvas = lerLocal<LojaCategoria[]>(LOCAL_CATEGORIES_KEY, []);
        const categorias = categoriasSalvas.length ? categoriasSalvas : LOCAL_CATEGORIES_SEED;
        const nomes = new Set([...categorias.map((categoria) => categoria.nome), ...produtos.map((produto) => produto.categoria), 'Granel'].filter(Boolean));
        return respostaLocal([...nomes].map((nome, indice) => categorias.find((categoria) => categoria.nome === nome) || { id: nome === 'Granel' ? 0 : -1 * (indice + 1), nome: String(nome), slug: String(nome).toLowerCase().replace(/\s+/g, '-'), ordem: indice, ativo: true, sistema: nome === 'Granel', em_uso: produtos.some((produto) => produto.categoria === nome) }));
    },
    criarCategoria: async (payload: { nome: string; ordem?: number }) => {
        if (!ambienteLocal()) return api.post<LojaCategoria>('/loja/categorias', payload);
        try { return await api.post<LojaCategoria>('/loja/categorias', payload); } catch { /* fallback local */ }
        const categorias = lerLocal<LojaCategoria[]>(LOCAL_CATEGORIES_KEY, []);
        if (categorias.some((categoria) => categoria.nome.toLowerCase() === payload.nome.trim().toLowerCase()) || payload.nome.trim().toLowerCase() === 'granel') throw new Error('Já existe uma categoria com esse nome.');
        const categoria: LojaCategoria = { id: Date.now(), nome: payload.nome.trim(), slug: payload.nome.trim().toLowerCase().replace(/\s+/g, '-'), ordem: payload.ordem || categorias.length, ativo: true };
        salvarLocal(LOCAL_CATEGORIES_KEY, [...categorias, categoria]);
        return respostaLocal(categoria);
    },
    atualizarCategoria: async (id: number, payload: { nome: string; ordem?: number; ativo?: boolean }) => {
        if (!ambienteLocal()) return api.put<LojaCategoria>(`/loja/categorias/${id}`, payload);
        try { return await api.put<LojaCategoria>(`/loja/categorias/${id}`, payload); } catch { /* fallback local */ }
        const categorias = lerLocal<LojaCategoria[]>(LOCAL_CATEGORIES_KEY, []);
        const anterior = categorias.find((categoria) => categoria.id === id);
        if (!anterior) throw new Error('Categoria não encontrada.');
        const categoria = { ...anterior, ...payload, nome: payload.nome.trim(), slug: payload.nome.trim().toLowerCase().replace(/\s+/g, '-') };
        salvarLocal(LOCAL_CATEGORIES_KEY, categorias.map((item) => item.id === id ? categoria : item));
        const produtos = lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED).map((produto) => produto.categoria === anterior.nome ? { ...produto, categoria: categoria.nome } : produto);
        salvarLocal(LOCAL_PRODUCTS_KEY, produtos);
        return respostaLocal(categoria);
    },
    excluirCategoria: async (id: number) => {
        if (!ambienteLocal()) return api.delete(`/loja/categorias/${id}`);
        try { return await api.delete(`/loja/categorias/${id}`); } catch { /* fallback local */ }
        const categorias = lerLocal<LojaCategoria[]>(LOCAL_CATEGORIES_KEY, []);
        const categoria = categorias.find((item) => item.id === id);
        if (!categoria || categoria.sistema) throw new Error('Esta categoria não pode ser excluída.');
        const produtos = lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED);
        if (produtos.some((produto) => produto.categoria === categoria.nome)) throw new Error('Remova esta categoria dos produtos antes de excluí-la.');
        salvarLocal(LOCAL_CATEGORIES_KEY, categorias.filter((item) => item.id !== id));
        return respostaLocal({ id, removida: true });
    },
    atualizarConfiguracao: async (id: number, payload: Partial<LojaProdutoConfiguracao>) => {
        if (!ambienteLocal()) return api.put<LojaProdutoConfiguracao[]>(`/loja/configuracao/${id}`, payload);
        try { return await api.put<LojaProdutoConfiguracao[]>(`/loja/configuracao/${id}`, payload); } catch { /* fallback local */ }
        const produtos = lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED).map((produto) => produto.id === id ? { ...produto, ...payload, configurado: true, nome: payload.nome_loja || produto.nome_original || produto.nome } : produto);
        salvarLocal(LOCAL_PRODUCTS_KEY, produtos);
        return respostaLocal(produtos);
    },
    atualizarFoto: async (id: number, arquivo: File) => {
        const imagem = await otimizarImagem(arquivo);
        const formData = new FormData();
        formData.append('arquivo', imagem, imagem.name);
        const salvarComoDataUrl = () => arquivoComoDataUrl(imagem).then((foto_url) => {
            const produtos = lerLocal<LojaProdutoConfiguracao[]>(LOCAL_PRODUCTS_KEY, LOCAL_PRODUCTS_SEED).map((produto) => produto.id === id ? { ...produto, foto_url } : produto);
            salvarLocal(LOCAL_PRODUCTS_KEY, produtos);
            return respostaLocal({ id, foto_url });
        });
        if (ambienteLocal()) {
            return api.post<{ id: number; foto_url: string }>(`/loja/configuracao/${id}/foto`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
                .catch(() => salvarComoDataUrl());
        }
        return api.post<{ id: number; foto_url: string }>(`/loja/configuracao/${id}/foto`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
};
