'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { lojaOnlineService, LojaCatalogo, LojaCliente, LojaCupomValidado, LojaPedido, LojaProduto } from '@/app/(main)/services/api/lojaOnlineService';
import styles from './Loja.module.scss';

type CarrinhoItem = LojaProduto & { quantidadeCarrinho: number };
type EscolhaGranel = { modo: 'peso' | 'valor'; quantidade: number };
type Formulario = { nome: string; telefone: string; email: string; rua: string; numero: string; complemento: string; cidade: string; estado: string; cep: string; cpf: string; cupom: string; forma_pagamento: string; forma_entrega: 'entrega' | 'retirada'; observacao: string };
type ContaForm = { nome: string; telefone: string; email: string; senha: string; confirmarSenha: string };
type Secao = { id: string; titulo: string; apoio: string };
type CardFormData = { token?: string; paymentMethodId?: string; issuerId?: string | number; installments?: string | number; cardholderName?: string; identificationType?: string; identificationNumber?: string };
type PixPagamento = { pedido: number; status?: string | null; pago?: boolean; qr_code?: string | null; qr_code_base64?: string | null; ticket_url?: string | null };

declare global {
    interface Window { MercadoPago?: any }
}

const initialForm: Formulario = { nome: '', telefone: '', email: '', rua: '', numero: '', complemento: '', cidade: '', estado: '', cep: '', cpf: '', cupom: '', forma_pagamento: 'cartao', forma_entrega: 'retirada', observacao: '' };
const PRIMEIRA_COMPRA_CUPOM = 'PRIMEIRACOMPRA10';
const LOCAL_CART_KEY = 'saude_e_vida_loja_carrinho';
const MERCADO_PAGO_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || 'APP_USR-a2ce4dfc-dc7e-42bc-968f-5091b4cc8c1c';
const dinheiro = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const calcularMaxParcelas = (valor: number) => {
    const centavos = Math.round(Math.max(0, Number(valor) || 0) * 100);
    if (centavos <= 4990) return 1;
    return Math.min(12, 2 + Math.floor((centavos - 4991) / 2500));
};
const dataHora = (valor?: string | null) => valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const normalizarTexto = (valor: unknown) => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const cidadesComEntrega = new Set(['campina grande', 'esperanca']);
const cidadeAceitaEntrega = (cidade: string, estado: string) => normalizarTexto(estado) === 'pb' && cidadesComEntrega.has(normalizarTexto(cidade));
const statusLabel: Record<string, string> = { novo: 'Recebido', separando: 'Em separação', enviado: 'Enviado', concluido: 'Concluído', cancelado: 'Cancelado' };
const pedidoConsumiuPrimeiraCompra = (pedido: LojaPedido) => {
    if (pedido.status_loja === 'aguardando_pagamento') return false;
    if (pedido.status_loja === 'cancelado') return Boolean(pedido.mercado_pago_payment_id || pedido.mercado_pago_status);
    return true;
};
const secoes: Secao[] = [
    { id: 'destaques', titulo: 'Destaques', apoio: 'Escolhas especiais para começar bem' },
    { id: 'promocoes', titulo: 'Promoções', apoio: 'Oportunidades para cuidar de você' },
    { id: 'mais-vendidos', titulo: 'Mais vendidos', apoio: 'Os queridinhos da nossa loja' },
];

export default function LojaPage() {
    const [catalogo, setCatalogo] = useState<LojaCatalogo | null>(null);
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(true);
    const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
    const [aberto, setAberto] = useState(false);
    const [formulario, setFormulario] = useState<Formulario>(initialForm);
    const [cepLocalidade, setCepLocalidade] = useState<{ cidade: string; estado: string } | null>(null);
    const [cepConsultando, setCepConsultando] = useState(false);
    const [cepMensagem, setCepMensagem] = useState('');
    const [enviado, setEnviado] = useState<{ pedido: number; mensagem: string } | null>(null);
    const [pixPagamento, setPixPagamento] = useState<PixPagamento | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [busca, setBusca] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
    const [abaAtiva, setAbaAtiva] = useState<'inicio' | 'granel'>('inicio');
    const [escolhasGranel, setEscolhasGranel] = useState<Record<number, EscolhaGranel>>({});
    const [produtoParaAdicionar, setProdutoParaAdicionar] = useState<LojaProduto | null>(null);
    const [quantidadeAdicionar, setQuantidadeAdicionar] = useState(1);
    const [modoAdicionar, setModoAdicionar] = useState<'peso' | 'valor'>('valor');
    const [valorAdicionar, setValorAdicionar] = useState(5);
    const [gramasAdicionar, setGramasAdicionar] = useState(100);
    const [erroAdicionar, setErroAdicionar] = useState('');
    const [menuCategorias, setMenuCategorias] = useState(false);
    const [cliente, setCliente] = useState<LojaCliente | null>(null);
    const [contaModo, setContaModo] = useState<'login' | 'cadastro'>('login');
    const [contaForm, setContaForm] = useState<ContaForm>({ nome: '', telefone: '', email: '', senha: '', confirmarSenha: '' });
    const [contaCarregando, setContaCarregando] = useState(false);
    const [contaSistema, setContaSistema] = useState(false);
    const [perfilAba, setPerfilAba] = useState<'conta' | 'pedidos'>('conta');
    const [meusPedidos, setMeusPedidos] = useState<LojaPedido[]>([]);
    const [pedidosCarregando, setPedidosCarregando] = useState(false);
    const [pedidosErro, setPedidosErro] = useState('');
    const [newsletterEmail, setNewsletterEmail] = useState('');
    const [newsletterMessage, setNewsletterMessage] = useState('');
    const [primeiraCompraElegivel, setPrimeiraCompraElegivel] = useState<boolean | null>(null);
    const [primeiraCompraPopup, setPrimeiraCompraPopup] = useState(false);
    const [primeiraCompraFechado, setPrimeiraCompraFechado] = useState(false);
    const [cupomAplicado, setCupomAplicado] = useState<LojaCupomValidado | null>(null);
    const [cupomAplicando, setCupomAplicando] = useState(false);
    const referenceNavRef = useRef<HTMLElement | null>(null);
    const carrinhoHidratado = useRef(false);
    const cardFormRef = useRef<{ getCardFormData: () => CardFormData; unmount?: () => void } | null>(null);
    const envioPedidoRef = useRef(false);
    const total = useMemo(() => carrinho.reduce((soma, item) => soma + item.preco * item.quantidadeCarrinho, 0), [carrinho]);
    const totalComDesconto = useMemo(() => Math.max(0, total - (cupomAplicado?.desconto || 0)), [total, cupomAplicado]);
    const maxParcelasCartao = calcularMaxParcelas(totalComDesconto);

    useEffect(() => {
        lojaOnlineService.catalogoPublico().then((res) => setCatalogo(res.data)).catch(() => setErro('Não foi possível carregar a loja agora. Tente novamente em instantes.')).finally(() => setCarregando(false));
        lojaOnlineService.clienteAtual().then(async (res) => {
            const atual = res.data.cliente;
            if (atual) {
                setCliente(atual);
                setFormulario((form) => ({ ...form, nome: atual.nome, telefone: atual.telefone, email: atual.email, rua: atual.rua || '', numero: atual.numero || '', complemento: atual.complemento || '', cidade: atual.cidade || '', estado: atual.estado || '', cep: atual.cep || '' }));
                try {
                    const pedidos = await lojaOnlineService.meusPedidos();
                    setMeusPedidos(pedidos.data);
                    setPrimeiraCompraElegivel(!pedidos.data.some(pedidoConsumiuPrimeiraCompra));
                } catch {
                    setPrimeiraCompraElegivel(null);
                }
            } else {
                setPrimeiraCompraElegivel(true);
            }
        });
    }, []);

    useEffect(() => {
        const cep = formulario.cep.replace(/\D/g, '').slice(0, 8);
        if (cep.length !== 8) {
            setCepLocalidade(null);
            setCepMensagem(cep ? 'Digite os 8 números do CEP para verificar a entrega.' : '');
            setCepConsultando(false);
            return undefined;
        }
        const controller = new AbortController();
        setCepConsultando(true);
        setCepMensagem('Consultando o CEP…');
        fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal })
            .then((resposta) => resposta.ok ? resposta.json() : null)
            .then((dados) => {
                if (!dados || dados.erro) throw new Error('CEP não encontrado.');
                const cidade = String(dados.localidade || '').trim();
                const estado = String(dados.uf || '').trim().toUpperCase();
                setCepLocalidade({ cidade, estado });
                setFormulario((form) => ({ ...form, rua: form.rua || dados.logradouro || '', cidade, estado, forma_entrega: cidadeAceitaEntrega(cidade, estado) ? form.forma_entrega : 'retirada' }));
                setCepMensagem(cidadeAceitaEntrega(cidade, estado) ? `Entrega disponível para ${cidade}/${estado}.` : `Este CEP é de ${cidade}/${estado}. Para ele, a opção disponível é retirar na loja.`);
            })
            .catch((erro) => {
                if (erro?.name === 'AbortError') return;
                setCepLocalidade(null);
                setFormulario((form) => ({ ...form, forma_entrega: 'retirada' }));
                setCepMensagem(erro?.message || 'Não foi possível consultar este CEP.');
            })
            .finally(() => setCepConsultando(false));
        return () => controller.abort();
    }, [formulario.cep]);

    useEffect(() => {
        const pedidoId = pixPagamento?.pedido;
        if (!pedidoId || pixPagamento?.pago) return undefined;
        let ativo = true;
        const verificarPagamento = async () => {
            try {
                const resposta = await lojaOnlineService.meusPedidos();
                const pedido = resposta.data.find((item) => Number(item.id) === Number(pedidoId));
                const status = String(pedido?.mercado_pago_status || '').toLowerCase();
                if (ativo && status === 'approved') {
                    setPixPagamento((atual) => atual && atual.pedido === pedidoId ? { ...atual, status, pago: true } : atual);
                }
            } catch {
                // A próxima consulta tenta novamente enquanto o Pix estiver aberto.
            }
        };
        verificarPagamento();
        const intervalo = window.setInterval(verificarPagamento, 4000);
        return () => {
            ativo = false;
            window.clearInterval(intervalo);
        };
    }, [pixPagamento?.pedido, pixPagamento?.pago]);

    useEffect(() => {
        setCupomAplicado(null);
    }, [total]);

    useEffect(() => {
        try {
            const salvo = window.localStorage.getItem(LOCAL_CART_KEY);
            if (salvo) {
                const itens = JSON.parse(salvo) as CarrinhoItem[];
                if (Array.isArray(itens)) setCarrinho(itens);
            }
        } catch {
            // O carrinho começa vazio quando o navegador não permite o storage.
        } finally {
            carrinhoHidratado.current = true;
        }
    }, []);

    useEffect(() => {
        if (!carrinhoHidratado.current) return;
        try { window.localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(carrinho)); } catch { /* carrinho segue em memória */ }
    }, [carrinho]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onScroll = () => {
            if (window.scrollY < 260 || primeiraCompraElegivel !== true || primeiraCompraFechado) return;
            try {
                if (window.sessionStorage.getItem('saude-e-vida-primeira-compra-popup') === '1') return;
                window.sessionStorage.setItem('saude-e-vida-primeira-compra-popup', '1');
            } catch {
                // O popup continua funcionando mesmo quando o navegador bloqueia o storage.
            }
            setPrimeiraCompraPopup(true);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [primeiraCompraElegivel, primeiraCompraFechado]);

    useEffect(() => {
        const nav = referenceNavRef.current;
        if (!nav || typeof window === 'undefined') return undefined;

        let frame = 0;
        let ultimoQuadro = 0;
        let direcao = 1;
        let pausadoAte = 0;
        const mobile = window.matchMedia('(max-width: 760px)');
        const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
        const pausar = () => { pausadoAte = performance.now() + 3200; };

        const animar = (agora: number) => {
            const limite = nav.scrollWidth - nav.clientWidth;
            if (mobile.matches && !movimentoReduzido.matches && limite > 2 && agora >= pausadoAte && agora - ultimoQuadro > 28) {
                nav.scrollLeft += direcao * 0.55;
                if (nav.scrollLeft >= limite - 1) direcao = -1;
                if (nav.scrollLeft <= 1) direcao = 1;
                ultimoQuadro = agora;
            }
            frame = window.requestAnimationFrame(animar);
        };

        nav.addEventListener('pointerdown', pausar, { passive: true });
        nav.addEventListener('touchstart', pausar, { passive: true });
        nav.addEventListener('mouseenter', pausar, { passive: true });
        frame = window.requestAnimationFrame(animar);
        return () => {
            window.cancelAnimationFrame(frame);
            nav.removeEventListener('pointerdown', pausar);
            nav.removeEventListener('touchstart', pausar);
            nav.removeEventListener('mouseenter', pausar);
        };
    }, []);

    useEffect(() => {
        if (!aberto || !cliente || !carrinho.length || formulario.forma_pagamento !== 'cartao') {
            cardFormRef.current?.unmount?.();
            cardFormRef.current = null;
            return undefined;
        }

        let ativo = true;
        let observerParcelas: MutationObserver | null = null;
        const montarFormularioCartao = async () => {
            if (!document.querySelector('script[data-mercado-pago-sdk]')) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://sdk.mercadopago.com/js/v2';
                    script.async = true;
                    script.dataset.mercadoPagoSdk = 'true';
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error('Não foi possível carregar o pagamento seguro do cartão.'));
                    document.head.appendChild(script);
                });
            } else if (!window.MercadoPago) {
                await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
            }
            if (!ativo || !window.MercadoPago || !document.getElementById('form-checkout-card')) return;
            cardFormRef.current?.unmount?.();
            const mercadoPago = new window.MercadoPago(MERCADO_PAGO_PUBLIC_KEY, { locale: 'pt-BR' });
            const cardForm = mercadoPago.cardForm({
                amount: totalComDesconto.toFixed(2),
                iframe: true,
                form: {
                    id: 'form-checkout-card',
                    cardNumber: { id: 'form-checkout__cardNumber', placeholder: 'Número do cartão' },
                    expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/AA' },
                    securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV' },
                    cardholderName: { id: 'form-checkout__cardholderName', placeholder: 'Nome impresso no cartão' },
                    issuer: { id: 'form-checkout__issuer', placeholder: 'Banco emissor' },
                    installments: { id: 'form-checkout__installments', placeholder: 'Parcelas' },
                    identificationType: { id: 'form-checkout__identificationType', placeholder: 'Tipo de documento' },
                    identificationNumber: { id: 'form-checkout__identificationNumber', placeholder: 'CPF' },
                    cardholderEmail: { id: 'form-checkout__cardholderEmail', placeholder: 'E-mail' },
                },
                callbacks: {
                    onFormMounted: (error: unknown) => {
                        if (error && ativo) setErro('Não foi possível carregar os campos do cartão. Tente novamente.');
                    },
                    onSubmit: (event: Event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const dadosCartao = cardForm.getCardFormData();
                        void enviarPedido(event, dadosCartao);
                    },
                },
            });
            const campoParcelas = document.getElementById('form-checkout__installments') as HTMLSelectElement | null;
            if (campoParcelas) {
                const limitarParcelas = () => {
                    const selecionada = Number(campoParcelas.value);
                    Array.from(campoParcelas.options).forEach((opcao) => {
                        const valor = Number(opcao.value);
                        if (Number.isFinite(valor) && valor > maxParcelasCartao) opcao.remove();
                    });
                    if (campoParcelas.options.length <= 1) {
                        for (let parcela = 1; parcela <= maxParcelasCartao; parcela += 1) {
                            campoParcelas.add(new Option(`${parcela}x`, String(parcela)));
                        }
                    }
                    if (selecionada > maxParcelasCartao) campoParcelas.value = '';
                };
                limitarParcelas();
                observerParcelas = new MutationObserver(limitarParcelas);
                observerParcelas.observe(campoParcelas, { childList: true });
            }
            if (ativo) cardFormRef.current = cardForm;
        };

        montarFormularioCartao().catch((error: Error) => {
            if (ativo) setErro(error.message);
        });
        return () => {
            ativo = false;
            observerParcelas?.disconnect();
            cardFormRef.current?.unmount?.();
            cardFormRef.current = null;
        };
    }, [aberto, cliente?.id, carrinho.length, formulario.forma_pagamento, totalComDesconto, maxParcelasCartao]);

    const produtos = useMemo(() => (catalogo?.produtos ?? []).filter((produto) => produto.disponivel), [catalogo]);
    const categorias = useMemo(() => ['Todos', 'Granel', ...Array.from(new Set((catalogo?.categorias || []).map((categoria) => categoria.nome).filter((categoria) => categoria !== 'Granel'))).sort((a, b) => a.localeCompare(b))], [catalogo]);
    const ordenados = useMemo(() => [...produtos].sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999)), [produtos]);
    const produtosGranel = useMemo(() => ordenados.filter((produto) => produto.a_granel), [ordenados]);
    const filtrados = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        return ordenados.filter((produto) => {
            const categoria = produto.categoria || 'Saúde e bem-estar';
            return (abaAtiva === 'granel' || categoriaAtiva === 'Granel' ? Boolean(produto.a_granel) : true) && (categoriaAtiva === 'Todos' || categoriaAtiva === 'Granel' || categoria === categoriaAtiva) && (!termo || `${produto.nome} ${categoria} ${produto.descricao || ''}`.toLowerCase().includes(termo));
        });
    }, [ordenados, busca, categoriaAtiva, abaAtiva]);
    const produtosPorPagina = 10;
    const totalPaginasCatalogo = Math.ceil(filtrados.length / produtosPorPagina);
    const [paginaCatalogo, setPaginaCatalogo] = useState(1);
    const paginaCatalogoAtual = Math.min(paginaCatalogo, Math.max(totalPaginasCatalogo, 1));
    const produtosDaPagina = filtrados.slice((paginaCatalogoAtual - 1) * produtosPorPagina, paginaCatalogoAtual * produtosPorPagina);

    useEffect(() => {
        setPaginaCatalogo(1);
    }, [busca, categoriaAtiva, abaAtiva]);
    const produtosDaSecao = (id: string) => {
        const selecionados = ordenados.filter((produto) => {
            const secoesProduto = produto.secoes || [];
            if (id === 'destaques') return produto.destaque || secoesProduto.includes(id);
            if (id === 'promocoes') return produto.promocao || secoesProduto.includes(id) || Number(produto.preco_original || 0) > Number(produto.preco || 0);
            return secoesProduto.includes(id);
        });
        if (id === 'mais-vendidos') return [...selecionados].sort((a, b) => (b.vendidos ?? 0) - (a.vendidos ?? 0));
        return selecionados.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
    };
    const categoriasComProdutos = useMemo(() => categorias.filter((categoria) => categoria !== 'Todos' && ordenados.some((produto) => categoria === 'Granel' ? Boolean(produto.a_granel) : (produto.categoria || 'Saúde e bem-estar') === categoria)), [categorias, ordenados]);
    const categoriasVisuais = useMemo(() => categorias.filter((categoria) => categoria !== 'Todos'), [categorias]);
    const ofertas = useMemo(() => {
        const selecionados = ordenados.filter((produto) => produto.promocao || Number(produto.preco_original || 0) > Number(produto.preco || 0));
        return (selecionados.length ? selecionados : ordenados).slice(0, 5);
    }, [ordenados]);
    const maisVendidos = useMemo(() => [...ordenados].sort((a, b) => (b.vendidos ?? 0) - (a.vendidos ?? 0)).slice(0, 5), [ordenados]);
    const selecaoRotina = useMemo(() => ordenados.filter((produto) => produto.destaque || (produto.secoes || []).includes('destaques')).slice(0, 5), [ordenados]);
    const escolhaAtual = (produto: LojaProduto): EscolhaGranel => escolhasGranel[produto.id] || { modo: 'peso', quantidade: 0.5 };
    const quantidadeGranel = (produto: LojaProduto) => {
        const escolha = escolhaAtual(produto);
        return escolha.modo === 'valor' ? escolha.quantidade / Math.max(Number(produto.preco_kg || produto.preco), 0.01) : escolha.quantidade;
    };
    const atualizarEscolhaGranel = (produto: LojaProduto, campo: keyof EscolhaGranel, valor: string | number) => setEscolhasGranel((atual) => ({ ...atual, [produto.id]: { ...escolhaAtual(produto), [campo]: valor } }));
    const adicionarQuantidade = (produto: LojaProduto, quantidade: number) => setCarrinho((atual) => {
        if (!Number.isFinite(quantidade) || quantidade <= 0) return atual;
        const existente = atual.find((item) => item.id === produto.id);
        if (!existente) return quantidade > produto.estoque ? atual : [...atual, { ...produto, quantidadeCarrinho: quantidade }];
        if (existente.quantidadeCarrinho + quantidade > produto.estoque) return atual;
        return atual.map((item) => item.id === produto.id ? { ...item, quantidadeCarrinho: item.quantidadeCarrinho + quantidade } : item);
    });
    const abrirAdicionar = (produto: LojaProduto) => {
        setErroAdicionar('');
        if (produto.a_granel) {
            const escolha = escolhaAtual(produto);
            setModoAdicionar(escolha.modo);
            if (escolha.modo === 'valor') setValorAdicionar(Number(escolha.quantidade) || 5);
            else setGramasAdicionar(Math.max(1, Number(escolha.quantidade) * 1000 || 100));
        } else {
            setQuantidadeAdicionar(1);
        }
        setProdutoParaAdicionar(produto);
    };
    const confirmarAdicao = () => {
        if (!produtoParaAdicionar) return;
        const precoKg = Number(produtoParaAdicionar.preco_kg || produtoParaAdicionar.preco || 0);
        const quantidade = produtoParaAdicionar.a_granel
            ? modoAdicionar === 'valor' ? Number(valorAdicionar) / Math.max(precoKg, 0.01) : Number(gramasAdicionar) / 1000
            : Number(quantidadeAdicionar);
        if (!Number.isFinite(quantidade) || quantidade <= 0) {
            setErroAdicionar(produtoParaAdicionar.a_granel ? 'Informe um valor ou peso maior que zero.' : 'Informe uma quantidade válida.');
            return;
        }
        if (quantidade > Number(produtoParaAdicionar.estoque)) {
            setErroAdicionar(produtoParaAdicionar.a_granel ? 'A quantidade escolhida ultrapassa o estoque disponível.' : 'A quantidade escolhida ultrapassa o estoque disponível.');
            return;
        }
        if (produtoParaAdicionar.a_granel) {
            setEscolhasGranel((atual) => ({ ...atual, [produtoParaAdicionar.id]: { modo: modoAdicionar, quantidade: modoAdicionar === 'valor' ? Number(valorAdicionar) : Number(gramasAdicionar) / 1000 } }));
        }
        adicionarQuantidade(produtoParaAdicionar, quantidade);
        setProdutoParaAdicionar(null);
    };
    const alterarQuantidade = (id: number, delta: number) => setCarrinho((atual) => atual.map((item) => item.id !== id ? item : { ...item, quantidadeCarrinho: Math.min(item.estoque, item.quantidadeCarrinho + (item.a_granel ? delta / 10 : delta)) }).filter((item) => item.quantidadeCarrinho > 0));
    const atualizarFormulario = (campo: keyof Formulario, valor: string) => {
        if (campo === 'cupom') setCupomAplicado(null);
        if (campo === 'cep') {
            setCepLocalidade(null);
            setCepMensagem('');
        }
        setFormulario((atual) => ({ ...atual, [campo]: valor, ...(campo === 'cep' ? { forma_entrega: 'retirada' } : {}) }));
    };
    const aplicarCupom = async () => {
        const codigo = formulario.cupom.trim().toUpperCase();
        setErro('');
        if (!codigo) { setCupomAplicado(null); setErro('Informe o código do cupom.'); return; }
        if (!cliente) { setErro('Faça login para aplicar o cupom.'); return; }
        setCupomAplicando(true);
        try {
            const resposta = await lojaOnlineService.validarCupom('saude-e-vida', {
                codigo,
                valor_bruto: total,
                produto_ids: carrinho.map((item) => item.id),
                itens: carrinho.map((item) => ({ produto_id: item.id, quantidade: item.quantidadeCarrinho, valor_unitario: Number(item.preco || 0) })),
            });
            setCupomAplicado(resposta.data);
        } catch (e: any) {
            setCupomAplicado(null);
            setErro(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Não foi possível aplicar este cupom.');
        } finally {
            setCupomAplicando(false);
        }
    };
    const atualizarConta = (campo: keyof ContaForm, valor: string) => setContaForm((atual) => ({ ...atual, [campo]: valor }));
    const abrirCarrinho = () => { setAberto(true); setEnviado(null); setPixPagamento(null); setPerfilAba('conta'); };
    const atualizarElegibilidadePrimeiraCompra = async () => {
        try {
            const resposta = await lojaOnlineService.meusPedidos();
            setMeusPedidos(resposta.data);
            const elegivel = !resposta.data.some(pedidoConsumiuPrimeiraCompra);
            setPrimeiraCompraElegivel(elegivel);
            if (!elegivel) setFormulario((form) => form.cupom === PRIMEIRA_COMPRA_CUPOM ? { ...form, cupom: '' } : form);
        } catch {
            setPrimeiraCompraElegivel(null);
        }
    };
    const aproveitarPrimeiraCompra = () => {
        setFormulario((form) => ({ ...form, cupom: PRIMEIRA_COMPRA_CUPOM }));
        setPrimeiraCompraPopup(false);
        setAberto(true);
        setEnviado(null);
        setPixPagamento(null);
        setPerfilAba('conta');
    };
    const fecharPrimeiraCompra = () => { setPrimeiraCompraPopup(false); setPrimeiraCompraFechado(true); };
    const buscarProdutos = () => {
        setCategoriaAtiva('Todos');
        setAbaAtiva('inicio');
        setMenuCategorias(false);
        requestAnimationFrame(() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    const entrarCliente = async (event: FormEvent) => {
        event.preventDefault(); setErro(''); setContaSistema(false); setContaCarregando(true);
        try {
            if (contaModo === 'cadastro') {
                if (contaForm.senha !== contaForm.confirmarSenha) throw new Error('As senhas precisam ser iguais.');
                const resposta = await lojaOnlineService.cadastrarCliente('saude-e-vida', contaForm);
                setCliente(resposta.data.cliente);
                setFormulario((form) => ({ ...form, nome: resposta.data.cliente.nome, telefone: resposta.data.cliente.telefone, email: resposta.data.cliente.email }));
                await atualizarElegibilidadePrimeiraCompra();
            } else {
                const resposta = await lojaOnlineService.loginCliente('saude-e-vida', { email: contaForm.email, senha: contaForm.senha });
                const clienteResposta = resposta.data.cliente;
                if (!clienteResposta) throw new Error('A resposta de acesso da loja está incompleta.');
                setCliente(clienteResposta);
                setFormulario((form) => ({ ...form, nome: clienteResposta.nome, telefone: clienteResposta.telefone, email: clienteResposta.email }));
                await atualizarElegibilidadePrimeiraCompra();
            }
            setPerfilAba('conta');
        } catch (e: any) { const mensagem = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Não foi possível acessar sua conta.'; setContaSistema(mensagem.toLowerCase().includes('conta do sistema')); setErro(mensagem); } finally { setContaCarregando(false); }
    };
    const sairCliente = () => { lojaOnlineService.sairCliente(); setCliente(null); setMeusPedidos([]); setFormulario((form) => ({ ...form, nome: '', telefone: '', email: '' })); };
    const abrirMeusPedidos = async () => {
        setPerfilAba('pedidos'); setPedidosErro(''); setPedidosCarregando(true);
        try { const resposta = await lojaOnlineService.meusPedidos(); setMeusPedidos(resposta.data); } catch (e: any) { setPedidosErro(e?.response?.data?.message || e?.message || 'Não foi possível carregar seus pedidos.'); } finally { setPedidosCarregando(false); }
    };
    const abrirPedidosCliente = () => {
        setAberto(true); setEnviado(null); setPixPagamento(null);
        if (cliente) abrirMeusPedidos();
        else setPerfilAba('conta');
    };
    const enviarPedido = async (event: { preventDefault: () => void }, dadosCartaoInformados?: CardFormData) => {
        event.preventDefault(); setErro('');
        if (!cliente) { setErro('Faça login ou crie sua conta antes de finalizar o pedido.'); return; }
        if (formulario.cep.replace(/\D/g, '').length !== 8) { setErro('Informe um CEP válido para continuar.'); return; }
        if (formulario.forma_entrega === 'entrega' && (!cepLocalidade || !cidadeAceitaEntrega(cepLocalidade.cidade, cepLocalidade.estado))) { setErro('A entrega está disponível somente para Campina Grande e Esperança/PB.'); return; }
        if (envioPedidoRef.current) return;
        envioPedidoRef.current = true;
        setEnviando(true);
        try {
            let pagamento: Record<string, string | number | undefined>;
            if (formulario.forma_pagamento === 'cartao') {
                // O CardForm só gera um CardToken válido dentro do callback onSubmit.
                // Usar um token fora desse momento pode enviar um token vazio, antigo
                // ou já consumido e resultar em "Invalid card_token_id".
                const dadosCartao = dadosCartaoInformados;
                if (!dadosCartao?.token || !dadosCartao.paymentMethodId) throw new Error('Preencha os dados do cartão para continuar.');
                const identificacao = String(dadosCartao.identificationNumber || '').replace(/\D/g, '');
                const tipoIdentificacao = String(dadosCartao.identificationType || 'CPF').toUpperCase();
                const tamanhoIdentificacao = tipoIdentificacao === 'CNPJ' ? 14 : 11;
                if (identificacao.length !== tamanhoIdentificacao) {
                    throw new Error(`Informe um ${tipoIdentificacao === 'CNPJ' ? 'CNPJ' : 'CPF'} válido com ${tamanhoIdentificacao} dígitos.`);
                }
                pagamento = {
                    tipo: 'cartao', token: dadosCartao.token, payment_method_id: dadosCartao.paymentMethodId,
                    issuer_id: dadosCartao.issuerId, installments: dadosCartao.installments,
                    cardholder_name: dadosCartao.cardholderName,
                    identification_type: dadosCartao.identificationType, identification_number: dadosCartao.identificationNumber,
                    cpf: dadosCartao.identificationNumber,
                };
            } else {
                const cpf = formulario.cpf.replace(/\D/g, '');
                if (cpf.length < 11) throw new Error('Informe um CPF válido para gerar o Pix.');
                pagamento = { tipo: 'pix', cpf, identification_type: 'CPF' };
            }
            const res = await lojaOnlineService.criarPedido('saude-e-vida', { ...formulario, pagamento, nome: cliente.nome, telefone: cliente.telefone, email: cliente.email, itens: carrinho.map((item) => ({ produto_id: item.id, quantidade: item.quantidadeCarrinho })) });
            if (res.data.pagamento_online?.pix) {
                setPixPagamento({ pedido: res.data.pedido, status: res.data.pagamento_online.status, pago: res.data.pagamento_online.status === 'approved', ...res.data.pagamento_online.pix });
                setCarrinho([]);
            } else {
                setEnviado(res.data);
                setCarrinho([]);
            }
        } catch (e: any) {
            const mensagem = e?.response?.data?.message || e?.response?.data?.error || e?.message || '';
            setErro(mensagem || 'Não foi possível processar o pagamento. Confira os dados e tente novamente.');
        } finally { envioPedidoRef.current = false; setEnviando(false); }
    };
    const inscreverNewsletter = (event: FormEvent) => {
        event.preventDefault();
        if (!newsletterEmail.trim()) return;
        setNewsletterMessage('Cadastro realizado. Você receberá nossas novidades por e-mail.');
        setNewsletterEmail('');
    };
    const produtoCard = (produto: LojaProduto) => {
        const temPromocao = Number(produto.preco_original || 0) > Number(produto.preco || 0) || produto.promocao;
        const icone = (produto.categoria || '').toLowerCase().includes('chá') ? 'pi pi-sun' : (produto.categoria || '').toLowerCase().includes('cáps') ? 'pi pi-circle' : 'pi pi-heart';
        const escolha = escolhaAtual(produto);
        const quantidadeKg = quantidadeGranel(produto);
        const precoKg = Number(produto.preco_kg || produto.preco);
        return <article className={`${styles.card} ${styles.productCard}`} key={produto.id}>{produto.foto_url ? <img className={styles.productImage} src={produto.foto_url} alt={produto.nome} /> : <div className={styles.productIcon}><i className={icone} /></div>}<div className={styles.cardCategory}>{produto.a_granel ? 'Venda a granel' : (produto.categoria || 'Saúde e bem-estar')}</div><h3>{produto.nome}</h3>{produto.descricao && <p className={styles.productDescription}>{produto.descricao}</p>}{produto.a_granel ? <div className={styles.bulkBox}><strong>{dinheiro(precoKg)} <small>/ kg</small></strong><div className={styles.bulkModes}><button className={escolha.modo === 'peso' ? styles.bulkModeActive : ''} onClick={() => atualizarEscolhaGranel(produto, 'modo', 'peso')}>Por peso</button><button className={escolha.modo === 'valor' ? styles.bulkModeActive : ''} onClick={() => atualizarEscolhaGranel(produto, 'modo', 'valor')}>Por valor</button></div><label>{escolha.modo === 'peso' ? 'Quanto você quer? (kg)' : 'Quanto quer gastar? (R$)'}<input type="number" min={escolha.modo === 'peso' ? '0.001' : '0.01'} max={escolha.modo === 'peso' ? produto.estoque : produto.estoque * precoKg} step={escolha.modo === 'peso' ? '0.001' : '0.01'} value={escolha.quantidade} onChange={(event) => atualizarEscolhaGranel(produto, 'quantidade', Number(event.target.value))} /></label><span className={styles.bulkResult}>{escolha.modo === 'peso' ? `Você vai pagar ${dinheiro(quantidadeKg * precoKg)}` : `Você vai receber ${quantidadeKg.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`}</span></div> : null}<div className={styles.priceRow}><div><span className={styles.price}>{produto.a_granel ? dinheiro(precoKg) : dinheiro(Number(produto.preco))}</span>{produto.a_granel ? <small>/ kg · {produto.estoque.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg disponíveis</small> : temPromocao && produto.preco_original && <del>{dinheiro(Number(produto.preco_original))}</del>}</div><button className={styles.button} onClick={() => abrirAdicionar(produto)}>Adicionar</button></div><Link className={styles.mobileProductLink} href={`/loja/produto/${produto.id}`} aria-label={`Ver produto ${produto.nome}`} /></article>;
    };

    const contaFormView = <form className={styles.form} onSubmit={entrarCliente}><div className={styles.accountIntro}><strong>{contaModo === 'login' ? 'Entre para continuar' : 'Crie sua conta'}</strong><p>{contaModo === 'login' ? 'Você continua na loja. Seu cadastro fica vinculado aos pedidos no sistema.' : 'Seus dados viram um cadastro de cliente e ficam vinculados aos seus pedidos.'}</p></div>{contaModo === 'cadastro' && <><input required placeholder="Nome completo" value={contaForm.nome} onChange={(e) => atualizarConta('nome', e.target.value)} /><input required placeholder="Telefone / WhatsApp" value={contaForm.telefone} onChange={(e) => atualizarConta('telefone', e.target.value)} /></>}<input required type="email" placeholder="E-mail" value={contaForm.email} onChange={(e) => atualizarConta('email', e.target.value)} /><input required type="password" minLength={6} placeholder="Senha" value={contaForm.senha} onChange={(e) => atualizarConta('senha', e.target.value)} />{contaModo === 'cadastro' && <input required type="password" minLength={6} placeholder="Confirme sua senha" value={contaForm.confirmarSenha} onChange={(e) => atualizarConta('confirmarSenha', e.target.value)} />}{erro && <span className={styles.error}>{erro}</span>}{contaSistema && <Link className={styles.accountSystemLink} href="/auth/login">Entrar no sistema administrativo <i className="pi pi-arrow-right" /></Link>}<button className={styles.button} disabled={contaCarregando}>{contaCarregando ? 'Aguarde…' : contaModo === 'login' ? 'Entrar e continuar' : 'Criar conta e continuar'}</button><button type="button" className={styles.accountToggle} onClick={() => { setContaModo(contaModo === 'login' ? 'cadastro' : 'login'); setErro(''); setContaSistema(false); }}>{contaModo === 'login' ? 'Ainda não tenho conta' : 'Já tenho uma conta'}</button></form>;
    const perfilView = <div className={styles.profilePanel}><div className={styles.profileHeader}><span className={styles.profileIcon}><i className="pi pi-user" /></span><div><strong>{cliente?.nome}</strong><small>{cliente?.email}</small></div></div><p>Seus dados ficam vinculados aos pedidos e ao cadastro de cliente da Saúde e Vida.</p><div className={styles.profileActions}><button className={styles.button} onClick={abrirMeusPedidos}><i className="pi pi-list" /> Meus pedidos</button><button className={styles.accountToggle} onClick={sairCliente}>Sair da conta</button></div></div>;
    const pedidosView = <div className={styles.ordersPanel}><button className={styles.backAccount} onClick={() => setPerfilAba('conta')}><i className="pi pi-arrow-left" /> Minha conta</button><h3>Meus pedidos</h3>{pedidosCarregando ? <p>Carregando seus pedidos…</p> : pedidosErro ? <span className={styles.error}>{pedidosErro}</span> : meusPedidos.length === 0 ? <div className={styles.orderEmpty}>Você ainda não fez pedidos na loja.</div> : <div className={styles.orderList}>{meusPedidos.map((pedido) => <article className={styles.orderCard} key={pedido.id}><div><strong>Pedido #{pedido.id}</strong><small>{dataHora(pedido.createdAt || pedido.data)} · {pedido.itens.length} item(ns)</small></div><span className={`${styles.orderStatus} ${styles[`orderStatus${pedido.status_loja}`] || ''}`}>{statusLabel[pedido.status_loja] || pedido.status_loja}</span><b>{dinheiro(Number(pedido.valor_total))}</b></article>)}</div>}</div>;
    const opcoesEntregaView = <div className={styles.deliveryBox}><div className={styles.deliveryHeading}><strong>Como deseja receber?</strong><small>{cepConsultando ? 'Consultando o CEP…' : cepMensagem || 'Informe o CEP para verificar a disponibilidade de entrega.'}</small></div>{cepLocalidade && cidadeAceitaEntrega(cepLocalidade.cidade, cepLocalidade.estado) ? <div className={styles.deliveryChoices}><button type="button" className={formulario.forma_entrega === 'entrega' ? styles.deliveryChoiceActive : ''} onClick={() => atualizarFormulario('forma_entrega', 'entrega')}><i className="pi pi-truck" /><span><strong>Receber por entrega</strong><small>{cepLocalidade.cidade}/{cepLocalidade.estado}</small></span></button><button type="button" className={formulario.forma_entrega === 'retirada' ? styles.deliveryChoiceActive : ''} onClick={() => atualizarFormulario('forma_entrega', 'retirada')}><i className="pi pi-shop" /><span><strong>Retirar na loja</strong><small>Saúde e Vida</small></span></button></div> : <button type="button" className={`${styles.deliveryChoice} ${styles.deliveryChoiceActive}`} onClick={() => atualizarFormulario('forma_entrega', 'retirada')}><i className="pi pi-shop" /><span><strong>Retirar na loja</strong><small>{cepLocalidade ? 'Entrega não disponível para este CEP' : 'A entrega será liberada após consultar um CEP elegível'}</small></span></button>}</div>;
    const cardPaymentFields = <>{opcoesEntregaView}<div className={styles.cardPaymentFields}><strong>Dados do cartão</strong><div id="form-checkout__cardNumber" className={styles.cardField} /><div className={styles.formGrid}><div id="form-checkout__expirationDate" className={styles.cardField} /><div id="form-checkout__securityCode" className={styles.cardField} /></div><input id="form-checkout__cardholderName" placeholder="Nome impresso no cartão" /><div className={styles.formGrid}><select id="form-checkout__issuer" defaultValue=""><option value="">Banco emissor</option></select><select id="form-checkout__installments" defaultValue=""><option value="">Parcelas</option>{Array.from({ length: maxParcelasCartao }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}x</option>)}</select></div><div className={styles.formGrid}><select id="form-checkout__identificationType" defaultValue=""><option value="">Documento</option></select><input id="form-checkout__identificationNumber" placeholder="CPF" /></div><input id="form-checkout__cardholderEmail" type="email" value={cliente?.email || ''} readOnly placeholder="E-mail" /><small className={styles.secureNote}><i className="pi pi-lock" /> Seus dados são enviados diretamente ao Mercado Pago.</small></div></>;
    const pixPaymentFields = <>{opcoesEntregaView}<div className={styles.pixPaymentFields}><input required placeholder="CPF para gerar o Pix" value={formulario.cpf} onChange={(e) => atualizarFormulario('cpf', e.target.value)} inputMode="numeric" /><small>O QR Code será gerado assim que você confirmar o pedido.</small></div></>;
    const checkoutView = <form id="form-checkout-card" className={styles.form} onSubmit={(event) => { if (formulario.forma_pagamento === 'pix') void enviarPedido(event); else event.preventDefault(); }}><div className={styles.accountSummary}><span><i className="pi pi-user" /> Pedido para <strong>{cliente?.nome}</strong></span><button type="button" onClick={sairCliente}>Sair</button></div><div className={styles.formGrid}><input placeholder="Rua" value={formulario.rua} onChange={(e) => atualizarFormulario('rua', e.target.value)} /><input placeholder="Número" value={formulario.numero} onChange={(e) => atualizarFormulario('numero', e.target.value)} /></div><input placeholder="Complemento (apto, bloco, sala...)" value={formulario.complemento} onChange={(e) => atualizarFormulario('complemento', e.target.value)} /><div className={styles.formGrid}><input placeholder="Cidade" value={formulario.cidade} onChange={(e) => atualizarFormulario('cidade', e.target.value)} /><input placeholder="Estado" maxLength={2} value={formulario.estado} onChange={(e) => atualizarFormulario('estado', e.target.value)} /></div><input placeholder="CEP" value={formulario.cep} onChange={(e) => atualizarFormulario('cep', e.target.value)} /><div className={styles.couponInput}><i className="pi pi-tag" /><input placeholder="Cupom de desconto" value={formulario.cupom} onChange={(e) => atualizarFormulario('cupom', e.target.value.toUpperCase())} /><button type="button" onClick={aplicarCupom} disabled={cupomAplicando}>{cupomAplicando ? 'Aplicando…' : 'Aplicar'}</button></div><div className={styles.paymentOptions}><button type="button" className={`${styles.paymentMethod} ${formulario.forma_pagamento === 'cartao' ? styles.paymentMethodActive : ''}`} onClick={() => { setErro(''); atualizarFormulario('forma_pagamento', 'cartao'); }}><i className="pi pi-credit-card" /><span><strong>Cartão de crédito/débito</strong><small>Pagamento online seguro</small></span><i className="pi pi-check" /></button><button type="button" className={`${styles.paymentMethod} ${formulario.forma_pagamento === 'pix' ? styles.paymentMethodActive : ''}`} onClick={() => { setErro(''); atualizarFormulario('forma_pagamento', 'pix'); }}><i className="pi pi-qrcode" /><span><strong>Pix</strong><small>Pagamento instantâneo e seguro</small></span><i className="pi pi-check" /></button></div>{formulario.forma_pagamento === 'cartao' ? cardPaymentFields : pixPaymentFields}<textarea placeholder="Observação do pedido (opcional)" value={formulario.observacao} onChange={(e) => atualizarFormulario('observacao', e.target.value)} />{erro && <span className={styles.error}>{erro}</span>}<div className={styles.total}>{cupomAplicado && <span className={styles.discountApplied}>Desconto ({cupomAplicado.codigo}) <b>-{dinheiro(cupomAplicado.desconto)}</b></span>}<span>Total</span><span>{dinheiro(totalComDesconto)}</span></div><button className={styles.button} disabled={enviando}>{enviando ? 'Processando pagamento…' : formulario.forma_pagamento === 'pix' ? 'Gerar Pix e finalizar pedido' : 'Pagar com cartão'}</button></form>;
const pixView = pixPagamento ? <div className={styles.pixView}><strong>Pedido #{pixPagamento.pedido} criado</strong>{pixPagamento.pago ? <div className={styles.pixSuccess}><i className="pi pi-check-circle" /><strong>Pagamento aprovado!</strong><p>Recebemos o pagamento do seu pedido. Obrigado!</p></div> : <><p>Escaneie o QR Code no aplicativo do seu banco ou copie o código Pix para concluir o pagamento.</p>{pixPagamento.qr_code_base64 && <img className={styles.pixQrCode} src={`data:image/png;base64,${pixPagamento.qr_code_base64}`} alt="QR Code Pix" />}{pixPagamento.qr_code && <div className={styles.pixCode}><code className={styles.pixCodeValue} aria-label="Código Pix copia e cola">{pixPagamento.qr_code}</code><button className={styles.button} type="button" onClick={() => navigator.clipboard?.writeText(pixPagamento.qr_code || '')}>Copiar código Pix</button></div>}{pixPagamento.ticket_url && <a className={styles.accountSystemLink} href={pixPagamento.ticket_url} target="_blank" rel="noreferrer">Abrir pagamento <i className="pi pi-external-link" /></a>}</>}<button className={styles.button} onClick={() => { setPixPagamento(null); setAberto(false); }}>{pixPagamento.pago ? 'Fechar' : 'Continuar navegando'}</button></div> : null;
    const rail = (id: string, titulo: string, apoio: string, itens: LojaProduto[]) => itens.length > 0 && <section className={styles.railSection} id={id}><div className={styles.railHeading}><div><span className={styles.eyebrow}>Seleção Saúde e Vida</span><h2>{titulo}</h2><p>{apoio}</p></div><button onClick={() => { setCategoriaAtiva('Todos'); setAbaAtiva('inicio'); document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' }); }}>Ver todos <i className="pi pi-arrow-right" /></button></div><div className={styles.railGrid}>{itens.map(produtoCard)}</div></section>;
    const produtoVitrine = (produto: LojaProduto) => {
        const promocao = Number(produto.preco_original || 0) > Number(produto.preco || 0) || produto.promocao;
        const icone = (produto.categoria || '').toLowerCase().includes('chá') ? 'pi pi-sun' : (produto.categoria || '').toLowerCase().includes('cáps') ? 'pi pi-circle' : 'pi pi-leaf';
        const preco = Number(produto.a_granel ? (produto.preco_kg || produto.preco) : produto.preco);
        return <article className={styles.catalogCard} key={produto.id}><div className={styles.catalogVisual}>{produto.foto_url ? <img src={produto.foto_url} alt={produto.nome} /> : <div className={styles.catalogPlaceholder}><i className={icone} /></div>}{promocao && <span className={styles.catalogBadge}>Oferta</span>}{produto.destaque && !promocao && <span className={styles.catalogBadge}>Destaque</span>}</div><div className={styles.catalogInfo}><small>{produto.a_granel ? 'Granel · preço por kg' : (produto.categoria || 'Saúde e Vida')}</small><h3>{produto.nome}</h3><div className={styles.catalogPrice}><span>{dinheiro(preco)}</span>{produto.a_granel ? <em>/ kg</em> : produto.preco_original ? <del>{dinheiro(Number(produto.preco_original))}</del> : null}</div><div className={styles.catalogActions}><Link className={styles.catalogButton} href={`/loja/produto/${produto.id}`}>Ver produto <i className="pi pi-arrow-right" /></Link><button type="button" className={styles.catalogButtonSecondary} onClick={() => abrirAdicionar(produto)}><i className="pi pi-shopping-cart" /> Adicionar ao carrinho</button></div></div><Link className={styles.mobileCatalogLink} href={`/loja/produto/${produto.id}`} aria-label={`Ver produto ${produto.nome}`} /></article>;
    };
    const ofertasPublicas = ordenados.filter((produto) => produto.promocao || Number(produto.preco_original || 0) > Number(produto.preco || 0)).slice(0, 4);
    const idsOfertas = new Set(ofertasPublicas.map((produto) => produto.id));
    const campeoesPublicos = [...ordenados].filter((produto) => !idsOfertas.has(produto.id)).sort((a, b) => (b.vendidos ?? 0) - (a.vendidos ?? 0)).slice(0, 4);
    const novidadesPublicas = ordenados.filter((produto) => !idsOfertas.has(produto.id) && !campeoesPublicos.some((item) => item.id === produto.id) && (produto.destaque || (produto.secoes || []).includes('destaques'))).slice(0, 4);
    const combosPublicos = ordenados.filter((produto) => /kit|combo|seleção/i.test(produto.nome)).slice(0, 4);
    const trilho = (id: string, titulo: string, apoio: string, itens: LojaProduto[]) => itens.length >= 2 && <section className={styles.referenceRail} id={id}><div className={styles.referenceRailHeading}><div><span className={styles.referenceEyebrow}>Saúde e Vida</span><h2>{titulo}</h2><p>{apoio}</p></div><button onClick={() => { setAbaAtiva('inicio'); setCategoriaAtiva('Todos'); document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }); }}>Ver todos <i className="pi pi-arrow-right" /></button></div><div className={styles.referenceProductGrid}>{itens.map(produtoVitrine)}</div></section>;
    const iconeCategoria = (categoria: string) => {
        const nome = categoria.toLowerCase();
        if (nome.includes('chá')) return 'pi pi-sun';
        if (nome.includes('cáps') || nome.includes('suplement')) return 'pi pi-heart';
        if (nome.includes('granel') || nome.includes('grão') || nome.includes('semente')) return 'pi pi-box';
        if (nome.includes('farinha')) return 'pi pi-circle';
        if (nome.includes('snack') || nome.includes('frut')) return 'pi pi-star';
        return 'pi pi-leaf';
    };
    const imagemCategoria = (categoria: string) => {
        const nome = categoria.toLowerCase();
        if (nome.includes('alimentação saudável')) return '/images/loja/categorias/alimentacao-saudavel.png';
        if (nome === 'alimentos' || nome.includes('alimento')) return '/images/loja/categorias/alimentos.png';
        if (nome.includes('autocuidado')) return '/images/loja/categorias/autocuidado.png';
        if (nome.includes('cáps') || nome.includes('suplement')) return '/images/loja/categorias/capsulas-suplementos.png';
        if (nome.includes('chá') || nome.includes('infus')) return '/images/loja/categorias/chas-infusoes.png';
        if (nome.includes('granel')) return '/images/loja/categorias/granel.png';
        return '/images/loja/categorias/alimentos.png';
    };

    return (
        <main className={styles.referencePage}>
            <div className={styles.referenceTopbar}><span>COMPRE E RECEBA COM PRATICIDADE</span><button onClick={() => document.getElementById('beneficios')?.scrollIntoView({ behavior: 'smooth' })}>SAIBA MAIS</button></div>
            <header className={styles.referenceHeader}>
                <div className={styles.referenceBrand}><span className={styles.referenceMark}><i className="pi pi-leaf" /></span><strong>Saúde <em>e Vida</em></strong></div>
                <div className={styles.referenceSearch}><i className="pi pi-search" /><input value={busca} onChange={(event) => setBusca(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); buscarProdutos(); } }} placeholder="O que deseja procurar?" aria-label="O que deseja procurar" /><button type="button" onClick={buscarProdutos}>Buscar</button></div>
                <div className={styles.referenceActions}><a href="#atendimento"><i className="pi pi-question-circle" /><span>Atendimento</span></a><button onClick={abrirPedidosCliente}><i className="pi pi-list" /><span>Meus pedidos</span></button><button onClick={() => { setAberto(true); setEnviado(null); setPerfilAba('conta'); }}><i className="pi pi-user" /><span>Minha conta</span></button><button onClick={abrirCarrinho}><i className="pi pi-shopping-cart" /><span>Carrinho <b>{carrinho.length}</b></span></button></div>
            </header>
            <nav ref={referenceNavRef} className={styles.referenceNav} aria-label="Categorias da loja"><button onClick={() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })}>Ofertas exclusivas</button>{categoriasVisuais.slice(0, 7).map((categoria) => <button key={categoria} onClick={() => { setCategoriaAtiva(categoria); setAbaAtiva(categoria === 'Granel' ? 'granel' : 'inicio'); document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }); }}>{categoria}</button>)}<button onClick={() => document.getElementById('categorias')?.scrollIntoView({ behavior: 'smooth' })}>Todas as categorias</button><Link href="/loja/pontos" className={styles.referenceOffers}>Troque seus pontos</Link><button className={styles.referenceOffers} onClick={() => document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' })}><i className="pi pi-sparkles" /> Melhores ofertas <i className="pi pi-chevron-down" /></button></nav>

            <section className={styles.referenceHero}><div className={styles.referenceHeroCopy}><span>NOVIDADE NA SAÚDE E VIDA</span><h1>Escolhas naturais para uma vida mais leve.</h1><p>Produtos selecionados para a sua rotina, com compra segura e estoque integrado.</p><a href="#catalogo">Aproveite agora <i className="pi pi-arrow-right" /></a></div><div className={styles.referenceHeroDots}><i className="pi pi-circle-fill" /><i className="pi pi-circle" /><i className="pi pi-circle" /></div></section>

            <section className={styles.referenceBenefits} id="beneficios"><div><i className="pi pi-percentage" /><span><strong>5% OFF</strong><small>pagando no PIX</small></span></div><div><i className="pi pi-credit-card" /><span><strong>PARCELAMOS</strong><small>nas compras a partir de R$ 99,90</small></span></div><div><i className="pi pi-box" /><span><strong>GRANEL</strong><small>na medida certa para você</small></span></div><div><i className="pi pi-truck" /><span><strong>ENTREGAMOS</strong><small>com cuidado e praticidade</small></span></div><div><i className="pi pi-shield" /><span><strong>SEGURANÇA</strong><small>compra protegida</small></span></div></section>

            <section className={styles.referencePromoGrid}><a className={`${styles.referencePromo} ${styles.referencePromoGreen}`} href="#ofertas"><span>OFERTAS EXCLUSIVAS</span><strong>Mais cuidado por menos.</strong><small>Ver ofertas <i className="pi pi-arrow-right" /></small></a><a className={`${styles.referencePromo} ${styles.referencePromoSand}`} href="#catalogo"><span>COMPRE DO SEU JEITO</span><strong>Granel na medida certa.</strong><small>Conhecer granel <i className="pi pi-arrow-right" /></small></a><a className={`${styles.referencePromo} ${styles.referencePromoRose}`} href="#campeoes"><span>SELEÇÃO DA SEMANA</span><strong>Pequenos hábitos, grandes escolhas.</strong><small>Ver seleção <i className="pi pi-arrow-right" /></small></a><a className={`${styles.referencePromo} ${styles.referencePromoDark}`} href="#atendimento"><span>SAÚDE E VIDA</span><strong>Atendimento próximo para você.</strong><small>Falar com a equipe <i className="pi pi-arrow-right" /></small></a></section>

            <section className={styles.referenceCategories} id="categorias"><div className={styles.referenceCenteredHeading}><span>EXPLORE A LOJA</span><h2>Escolha por categoria</h2></div><div className={styles.referenceCategoryGrid}>{categoriasVisuais.slice(0, 8).map((categoria, index) => <button key={categoria} onClick={() => { setCategoriaAtiva(categoria); setAbaAtiva(categoria === 'Granel' ? 'granel' : 'inicio'); document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }); }}><span className={`${styles.referenceCategoryImage} ${styles[`referenceCategoryTone${index % 6}`]} ${categoria.toLowerCase().includes('chá') ? styles.referenceCategoryTeaImage : ''}`}><img src={imagemCategoria(categoria)} alt={`Categoria ${categoria}`} /><i className={iconeCategoria(categoria)} /></span><strong>{categoria}</strong></button>)}</div></section>

            {trilho('ofertas', 'Ofertas imperdíveis', 'Escolhas especiais para aproveitar agora.', ofertasPublicas)}
            {trilho('campeoes', 'Nossos campeões de vendas', 'Os favoritos de quem compra na Saúde e Vida.', campeoesPublicos)}
            {trilho('novidades', 'Novidades para a sua rotina', 'Produtos recém-selecionados para a loja.', novidadesPublicas)}
            {trilho('combos', 'Leve mais, pague menos', 'Seleções para montar uma cesta completa.', combosPublicos)}

            <section className={styles.referenceCatalog} id="catalogo"><div className={styles.referenceCatalogHeading}><div><span>CATÁLOGO SAÚDE E VIDA</span><h2>{busca.trim() ? `Resultados para “${busca.trim()}”` : abaAtiva === 'granel' ? 'Produtos a granel' : 'Encontre seus produtos'}</h2></div><small>{filtrados.length} produto(s) disponível(is)</small></div><div className={styles.referenceCatalogSearch}><i className="pi pi-search" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar produto no catálogo" aria-label="Buscar produto no catálogo" />{busca && <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca">×</button>}</div><div className={styles.referenceCatalogLayout}><aside className={styles.referenceSidebar}><strong>Comprar por categoria</strong>{categorias.map((categoria) => <button className={categoriaAtiva === categoria ? styles.referenceSidebarActive : ''} key={categoria} onClick={() => { setCategoriaAtiva(categoria); setAbaAtiva(categoria === 'Granel' ? 'granel' : 'inicio'); }}>{categoria}<span>{categoria === 'Todos' ? produtos.length : categoria === 'Granel' ? produtosGranel.length : produtos.filter((produto) => (produto.categoria || 'Saúde e bem-estar') === categoria).length}</span></button>)}</aside><div className={styles.referenceCatalogGrid}>{erro && !aberto ? <div className={styles.empty}>{erro}</div> : carregando ? <div className={styles.empty}>Carregando produtos…</div> : filtrados.length ? produtosDaPagina.map((produto) => produto.a_granel ? produtoCard(produto) : produtoVitrine(produto)) : <div className={styles.empty}>Nenhum produto encontrado para essa busca.</div>}</div></div>{totalPaginasCatalogo > 1 && <nav className={styles.catalogPagination} aria-label="Paginação do catálogo"><button type="button" disabled={paginaCatalogoAtual === 1} onClick={() => setPaginaCatalogo((pagina) => Math.max(1, pagina - 1))} aria-label="Página anterior"><i className="pi pi-arrow-left" /></button>{Array.from({ length: totalPaginasCatalogo }, (_, index) => index + 1).map((pagina) => <button type="button" key={pagina} className={pagina === paginaCatalogoAtual ? styles.catalogPaginationActive : ''} onClick={() => setPaginaCatalogo(pagina)} aria-current={pagina === paginaCatalogoAtual ? 'page' : undefined}>{pagina}</button>)}<button type="button" disabled={paginaCatalogoAtual === totalPaginasCatalogo} onClick={() => setPaginaCatalogo((pagina) => Math.min(totalPaginasCatalogo, pagina + 1))} aria-label="Próxima página"><i className="pi pi-arrow-right" /></button></nav>}</section>

            <section className={styles.referenceServiceBand} id="atendimento"><div><i className="pi pi-comments" /><strong>Atendimento próximo</strong><span>Fale com a equipe Saúde e Vida.</span></div><div><i className="pi pi-lock" /><strong>Pagamento seguro</strong><span>Pix, cartão e Mercado Pago.</span></div><div><i className="pi pi-refresh" /><strong>Compra acompanhada</strong><span>Veja o status em Minha conta.</span></div></section>
            <section className={styles.referenceNewsletter}><div><span>FIQUE POR DENTRO</span><h2>Novidades e ofertas para uma rotina mais leve.</h2><p>Receba novidades da Saúde e Vida no seu e-mail.</p></div><form onSubmit={inscreverNewsletter}><input type="email" required value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} placeholder="Seu melhor e-mail" aria-label="Seu melhor e-mail" /><button className={styles.referenceButton}>Cadastrar</button>{newsletterMessage && <small>{newsletterMessage}</small>}</form></section>
            <footer className={styles.referenceFooter}><div><div className={styles.referenceBrand}><span className={styles.referenceMark}><i className="pi pi-leaf" /></span><strong>Saúde <em>e Vida</em></strong></div><p>Produtos naturais e escolhas simples para cuidar de você.</p></div><div><strong>Institucional</strong><a href="#catalogo">Nossa loja</a><a href="#categorias">Categorias</a><a href="#atendimento">Atendimento</a></div><div><strong>Ajuda e segurança</strong><span>Mercado Pago</span><span>Pix e cartão</span><span>Dados protegidos</span></div><div><strong>Minha conta</strong><button onClick={() => { setAberto(true); setEnviado(null); setPerfilAba('conta'); }}>Entrar ou criar conta</button><button onClick={abrirPedidosCliente}>Meus pedidos</button><span>Estoque integrado</span></div><div className={styles.referenceFooterBottom}><span>© Saúde e Vida · Loja online</span><span>Compra segura · Atendimento próximo</span></div></footer>

            {carrinho.length > 0 && <button className={styles.cartButton} onClick={abrirCarrinho}><i className="pi pi-shopping-bag" /> Ver carrinho · {dinheiro(total)}</button>}
            {aberto && <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setAberto(false); }}><aside className={styles.drawer}><div className={styles.drawerHeader}><h2>{enviado ? 'Pedido recebido' : cliente && carrinho.length === 0 ? perfilAba === 'pedidos' ? 'Meus pedidos' : 'Minha conta' : cliente ? 'Finalizar pedido' : 'Minha conta'}</h2><button className={styles.close} onClick={() => setAberto(false)} aria-label="Fechar">×</button></div>{enviado ? <div className={styles.success}><strong>Pedido #{enviado.pedido} recebido.</strong><p>{enviado.mensagem}</p><button className={styles.button} onClick={() => setAberto(false)}>Continuar navegando</button></div> : <>{carrinho.length > 0 && <div>{carrinho.map((item) => <div className={styles.cartItem} key={item.id}><div><strong>{item.nome}</strong><span>{item.a_granel ? `${dinheiro(item.preco)} / kg` : `${dinheiro(item.preco)} cada`}</span></div><div className={styles.quantity}><button onClick={() => alterarQuantidade(item.id, -1)}>−</button><b>{item.quantidadeCarrinho.toLocaleString('pt-BR', { maximumFractionDigits: item.a_granel ? 3 : 0 })}{item.a_granel ? ' kg' : ''}</b><button onClick={() => alterarQuantidade(item.id, 1)}>+</button></div></div>)}</div>}{!cliente ? contaFormView : carrinho.length === 0 ? perfilAba === 'pedidos' ? pedidosView : perfilView : checkoutView}</>}</aside></div>}
            {primeiraCompraPopup && <aside className={styles.firstPurchasePopup} role="dialog" aria-labelledby="first-purchase-title"><button type="button" className={styles.firstPurchaseClose} onClick={fecharPrimeiraCompra} aria-label="Fechar oferta">×</button><span className={styles.firstPurchaseBadge}>BEM-VINDO À SAÚDE E VIDA</span><div className={styles.firstPurchaseIcon}><i className="pi pi-percentage" /></div><h2 id="first-purchase-title">10% OFF na sua primeira compra</h2><p>Seu primeiro cuidado começa com um desconto especial.</p><strong className={styles.firstPurchaseCode}>{PRIMEIRA_COMPRA_CUPOM}</strong><button type="button" className={styles.firstPurchaseButton} onClick={aproveitarPrimeiraCompra}>Aproveitar desconto <i className="pi pi-arrow-right" /></button><small>Válido uma única vez por cliente.</small></aside>}
            {pixPagamento && <div className={`${styles.overlay} ${styles.pixOverlay}`} onMouseDown={(event) => { if (event.target === event.currentTarget) { setPixPagamento(null); setAberto(false); } }}><aside className={styles.drawer}><div className={styles.drawerHeader}><h2>Pagamento Pix</h2><button className={styles.close} onClick={() => { setPixPagamento(null); setAberto(false); }} aria-label="Fechar">×</button></div>{pixView}</aside></div>}
            {produtoParaAdicionar && <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setProdutoParaAdicionar(null); }}><aside className={styles.addModal} role="dialog" aria-modal="true" aria-labelledby="add-product-title"><div className={styles.drawerHeader}><h2 id="add-product-title">Adicionar ao carrinho</h2><button className={styles.close} onClick={() => setProdutoParaAdicionar(null)} aria-label="Fechar">×</button></div><div className={styles.addModalProduct}>{produtoParaAdicionar.foto_url ? <img src={produtoParaAdicionar.foto_url} alt="" /> : <i className="pi pi-leaf" />}<div><strong>{produtoParaAdicionar.nome}</strong><small>{produtoParaAdicionar.a_granel ? `Venda a granel · ${dinheiro(Number(produtoParaAdicionar.preco_kg || produtoParaAdicionar.preco))} por kg` : `${dinheiro(Number(produtoParaAdicionar.preco))} por unidade`}</small></div></div>{produtoParaAdicionar.a_granel ? <div className={styles.bulkModalRule}><strong>Como funciona o granel</strong><p>O preço informado é por kg. Escolha quanto quer comprar por peso ou quanto quer gastar por valor.</p><div className={styles.bulkModes}><button type="button" className={modoAdicionar === 'peso' ? styles.bulkModeActive : ''} onClick={() => setModoAdicionar('peso')}>Por peso</button><button type="button" className={modoAdicionar === 'valor' ? styles.bulkModeActive : ''} onClick={() => setModoAdicionar('valor')}>Por valor</button></div>{modoAdicionar === 'valor' ? <label>Quanto quer gastar?<div className={styles.inputWithPrefix}><span>R$</span><input type="number" min="0.01" max={Number((produtoParaAdicionar.estoque * Number(produtoParaAdicionar.preco_kg || produtoParaAdicionar.preco)).toFixed(2))} step="0.01" value={valorAdicionar} onChange={(event) => setValorAdicionar(Math.max(0, Number(event.target.value)))} /></div></label> : <label>Quanto quer comprar?<div className={styles.inputWithSuffix}><input type="number" min="1" max={Math.floor(Number(produtoParaAdicionar.estoque) * 1000)} step="1" value={gramasAdicionar} onChange={(event) => setGramasAdicionar(Math.max(0, Number(event.target.value)))} /><span>g</span></div></label>}<span className={styles.bulkModalResult}>{modoAdicionar === 'valor' ? `${dinheiro(Number(valorAdicionar) || 0)} = ${(Number(valorAdicionar || 0) / Math.max(Number(produtoParaAdicionar.preco_kg || produtoParaAdicionar.preco), 0.01)).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : `${(Number(gramasAdicionar) || 0).toLocaleString('pt-BR')} g = ${dinheiro((Number(gramasAdicionar || 0) / 1000) * Number(produtoParaAdicionar.preco_kg || produtoParaAdicionar.preco))}`}</span></div> : <div className={styles.unitModalRule}><strong>Quantas unidades deseja adicionar?</strong><small>Estoque disponível: {Number(produtoParaAdicionar.estoque).toLocaleString('pt-BR')} unidade(s)</small><div className={styles.modalQuantity}><button type="button" onClick={() => setQuantidadeAdicionar((atual) => Math.max(1, atual - 1))} aria-label="Diminuir quantidade">−</button><b>{quantidadeAdicionar}</b><button type="button" onClick={() => setQuantidadeAdicionar((atual) => Math.min(Number(produtoParaAdicionar.estoque), atual + 1))} aria-label="Aumentar quantidade">+</button></div></div>}{erroAdicionar && <span className={styles.error}>{erroAdicionar}</span>}<div className={styles.addModalActions}><button type="button" className={styles.accountToggle} onClick={() => setProdutoParaAdicionar(null)}>Cancelar</button><button type="button" className={styles.button} onClick={confirmarAdicao}><i className="pi pi-shopping-cart" /> Confirmar adição</button></div></aside></div>}
        </main>
    );

    return (
        <main className={styles.page}>
            <div className={styles.shell}>
                <div className={styles.topBar}>
                    <span>FRETE GRÁTIS A PARTIR DE R$ 199</span><span>5% DE DESCONTO NO PIX</span><span>PARCELE A PARTIR DE R$ 99,90</span><span>ATENDIMENTO PELO WHATSAPP</span><span>COMPRA SEGURA</span>
                </div>
                <header className={styles.header}>
                    <div className={styles.brand}><span className={styles.mark}><i className="pi pi-leaf" /></span><strong>Saúde <em>e Vida</em></strong></div>
                    <div className={styles.headerSearch}><i className="pi pi-search" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="O que você está procurando?" aria-label="O que você está procurando" /><button onClick={() => document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' })}>Buscar</button></div>
            <div className={styles.headerActions}><a className={styles.headerLink} href="#atendimento"><i className="pi pi-whatsapp" /> Atendimento</a><button onClick={() => { setAberto(true); setEnviado(null); setPerfilAba('conta'); }}><i className="pi pi-user" /><span>{cliente?.nome?.split(' ')[0] || 'Minha conta'}</span></button><button onClick={abrirCarrinho}><i className="pi pi-shopping-bag" /><span>Carrinho {carrinho.length > 0 && `(${carrinho.length})`}</span></button></div>
                </header>
                <nav className={styles.nav}>
                    <button className={abaAtiva === 'inicio' && categoriaAtiva === 'Todos' ? styles.navActive : ''} onClick={() => { setAbaAtiva('inicio'); setCategoriaAtiva('Todos'); document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' }); }}>INÍCIO</button>
                    <button onClick={() => document.getElementById('categorias')?.scrollIntoView({ behavior: 'smooth' })}>CATEGORIAS</button>
                    {categoriasComProdutos.filter((categoria) => categoria !== 'Granel').slice(0, 6).map((categoria) => <button key={categoria} onClick={() => { setAbaAtiva('inicio'); setCategoriaAtiva(categoria); document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' }); }}>{categoria.toUpperCase()}</button>)}
                    <button className={categoriaAtiva === 'Granel' ? styles.navActive : ''} onClick={() => { setAbaAtiva('granel'); setCategoriaAtiva('Granel'); document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' }); }}>GRANEL <span className={styles.navCount}>{produtosGranel.length}</span></button>
                    <button className={styles.navOffer} onClick={() => document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' })}>MELHORES OFERTAS</button>
                    <Link className={styles.navOffer} href="/loja/pontos">TROQUE SEUS PONTOS</Link>
                </nav>

                <section className={styles.hero}>
                    <div><span className={styles.eyebrow}>Cuidado que chega até você</span><h1>Escolhas simples para uma vida mais saudável.</h1><p>Uma curadoria de produtos naturais, granel e pequenos cuidados para deixar sua rotina mais leve.</p><a className={styles.heroButton} href="#vitrine">Comprar agora <i className="pi pi-arrow-right" /></a></div>
                    <div className={styles.heroCard}><span>SELEÇÃO DA SEMANA</span><strong>Seu bem-estar começa nos pequenos hábitos.</strong><p>Produtos selecionados e estoque atualizado em tempo real.</p><div className={styles.heroProduct}><i className="pi pi-sparkles" /><span>Mais leveza para sua rotina</span></div><div className={styles.heroOrb}><i className="pi pi-leaf" /></div></div>
                </section>

                <section className={styles.benefits}><div><i className="pi pi-truck" /><span><strong>FRETE GRÁTIS</strong><small>Nas compras acima de R$ 199</small></span></div><div><i className="pi pi-percentage" /><span><strong>5% NO PIX</strong><small>Economize no pagamento</small></span></div><div><i className="pi pi-credit-card" /><span><strong>PARCELAMENTO</strong><small>Nas compras a partir de R$ 99,90</small></span></div><div><i className="pi pi-shield" /><span><strong>COMPRA SEGURA</strong><small>Seus dados protegidos</small></span></div></section>

                <section className={styles.miniBannerGrid} id="destaques">
                    <a className={`${styles.miniBanner} ${styles.miniBannerGreen}`} href="#vitrine"><span>ROTINA MAIS LEVE</span><strong>Cuide de você todos os dias.</strong><small>Ver destaques <i className="pi pi-arrow-right" /></small></a>
                    <a className={`${styles.miniBanner} ${styles.miniBannerSand}`} href="#granel"><span>DO SEU JEITO</span><strong>Compre a granel na medida certa.</strong><small>Conhecer granel <i className="pi pi-arrow-right" /></small></a>
                    <a className={`${styles.miniBanner} ${styles.miniBannerDark}`} href="#ofertas"><span>OFERTAS DA SEMANA</span><strong>Mais cuidado por menos.</strong><small>Ver promoções <i className="pi pi-arrow-right" /></small></a>
                </section>

                <section className={styles.categoryChooser} id="categorias"><div className={styles.sectionLead}><span className={styles.eyebrow}>Encontre do seu jeito</span><h2>Escolha por categoria</h2><p>Explore a loja por tipo de produto e encontre o que combina com a sua rotina.</p></div><div className={styles.categoryChooserGrid}>{categoriasComProdutos.slice(0, 8).map((categoria, index) => <button key={categoria} onClick={() => { setCategoriaAtiva(categoria); setAbaAtiva(categoria === 'Granel' ? 'granel' : 'inicio'); document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' }); }}><span className={styles.categoryTileIcon}><i className={['pi pi-heart', 'pi pi-sun', 'pi pi-box', 'pi pi-circle', 'pi pi-leaf', 'pi pi-star', 'pi pi-refresh', 'pi pi-shopping-bag'][index % 8]} /></span><strong>{categoria}</strong><small>{categoria === 'Granel' ? `${produtosGranel.length} opções` : 'Ver produtos'} <i className="pi pi-arrow-right" /></small></button>)}</div></section>

                {rail('ofertas', 'Ofertas imperdíveis', 'Produtos selecionados com preço especial por tempo limitado.', ofertas)}
                {rail('campeoes', 'Nossos campeões de vendas', 'Os favoritos de quem já escolheu cuidar melhor da rotina.', maisVendidos)}

                <section className={styles.categoryRows}>{categoriasComProdutos.map((categoria) => { const itens = ordenados.filter((produto) => categoria === 'Granel' ? Boolean(produto.a_granel) : (produto.categoria || 'Saúde e bem-estar') === categoria).slice(0, 3); return <section className={styles.categoryRow} key={categoria}><div className={styles.categoryRowHeading}><div><span className={styles.eyebrow}>Explore por categoria</span><h2>{categoria}</h2></div><button onClick={() => { setAbaAtiva(categoria === 'Granel' ? 'granel' : 'inicio'); setCategoriaAtiva(categoria); document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' }); }}>Ver todos <i className="pi pi-arrow-right" /></button></div><div className={styles.grid}>{itens.map(produtoCard)}</div></section>; })}</section>

                <section className={styles.editorial}><div className={styles.editorialHeading}><div><span className={styles.eyebrow}>Conteúdo Saúde e Vida</span><h2>Últimas notícias</h2><p>Ideias simples para aproveitar melhor os produtos da sua rotina.</p></div><a href="#atendimento">Ver conteúdos <i className="pi pi-arrow-right" /></a></div><div className={styles.editorialGrid}><article><span className="pi pi-sun" /><small>ROTINA</small><h3>Como montar uma rotina de cuidados mais leve</h3><p>Pequenas escolhas, organizadas do seu jeito, fazem parte de uma vida em equilíbrio.</p></article><article><span className="pi pi-box" /><small>GRANEL</small><h3>Compre na medida certa para você</h3><p>Escolha o produto, informe o peso ou o valor e veja o cálculo atualizado na hora.</p></article><article><span className="pi pi-heart" /><small>SAÚDE E VIDA</small><h3>Seleções pensadas para o dia a dia</h3><p>Conheça a curadoria da loja e encontre produtos que acompanham os seus hábitos.</p></article></div></section>

                {rail('combos', 'Seleções para levar mais', 'Monte uma cesta com produtos que combinam com a sua rotina.', selecaoRotina.length ? selecaoRotina : ordenados.slice(0, 5))}

                <section className={styles.store} id="vitrine"><div className={styles.storeTop}><div><span className={styles.eyebrow}>Nossa vitrine</span><h2>{abaAtiva === 'granel' ? 'Produtos a granel' : 'Encontre seus produtos'}</h2></div><span className={styles.storeCount}>{filtrados.length} produtos disponíveis</span></div><div className={styles.catalogSearch}><i className="pi pi-search" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar produto no catálogo" aria-label="Buscar produto no catálogo" />{busca && <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca">×</button>}</div><div className={styles.mobileCategoryToggle}><button onClick={() => setMenuCategorias(!menuCategorias)}><i className="pi pi-list" /> Categorias <i className="pi pi-chevron-down" /></button></div><div className={styles.storeLayout}><aside className={`${styles.sidebar} ${menuCategorias ? styles.sidebarOpen : ''}`}><strong>Comprar por categoria</strong>{categorias.map((categoria) => <button className={categoriaAtiva === categoria ? styles.categoryActive : ''} key={categoria} onClick={() => { setCategoriaAtiva(categoria); setAbaAtiva(categoria === 'Granel' ? 'granel' : 'inicio'); setMenuCategorias(false); }}>{categoria}<span>{categoria === 'Todos' ? produtos.length : categoria === 'Granel' ? produtosGranel.length : produtos.filter((produto) => (produto.categoria || 'Saúde e bem-estar') === categoria).length}</span></button>)}</aside><div className={styles.sections}>{erro && !aberto && <div className={styles.empty}>{erro}</div>}{carregando ? <div className={styles.empty}>Carregando produtos…</div> : <>{!produtos.length && !erro && <div className={styles.empty}><strong>Nenhum produto publicado ainda.</strong><p>Os produtos do estoque só aparecem aqui depois de serem marcados como “Na loja”, categorizados e salvos na configuração.</p><Link href="/loja/configuracao">Configurar produtos</Link></div>}{secoes.map((secao) => { const itens = produtosDaSecao(secao.id); return itens.length > 0 && <section className={styles.productSection} id={secao.id} key={secao.id}><div className={styles.sectionTitle}><div><h2>{secao.titulo}</h2><p>{secao.apoio}</p></div><span>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span></div><div className={styles.grid}>{itens.map(produtoCard)}</div></section>; })}<section className={`${styles.promoBanner} ${styles.promoBannerInline}`}><div><span>ESCOLHAS SAUDÁVEIS</span><h2>Seu próximo hábito começa aqui.</h2><p>Monte seu carrinho com praticidade e receba tudo em um só pedido.</p></div><i className="pi pi-heart" /></section><section className={styles.productSection} id="todos"><div className={styles.sectionTitle}><div><h2>{categoriaAtiva === 'Todos' ? 'Todos os produtos' : categoriaAtiva}</h2><p>Veja todos os itens disponíveis nesta categoria</p></div><span>{filtrados.length} itens</span></div>{filtrados.length ? <div className={styles.grid}>{filtrados.map(produtoCard)}</div> : <div className={styles.empty}>Nenhum produto encontrado para essa busca.</div>}</section></>}</div></div></section>

                <section className={styles.reassurance}><div><i className="pi pi-truck" /><strong>Envio cuidadoso</strong><span>Seu pedido preparado com atenção.</span></div><div><i className="pi pi-lock" /><strong>Pagamento seguro</strong><span>Checkout protegido pelo Mercado Pago.</span></div><div><i className="pi pi-comments" /><strong>Atendimento próximo</strong><span>Fale com a equipe Saúde e Vida.</span></div></section>
                <section className={styles.newsletter} id="atendimento"><div><span className={styles.eyebrow}>Fique por dentro</span><h2>Novidades para uma rotina mais leve.</h2><p>Receba lançamentos, ofertas e conteúdos da Saúde e Vida.</p></div><form onSubmit={inscreverNewsletter}><input type="email" required value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} placeholder="Seu melhor e-mail" aria-label="Seu melhor e-mail" /><button className={styles.button}>Quero receber</button>{newsletterMessage && <small>{newsletterMessage}</small>}</form></section>
                <footer className={styles.footer}><div className={styles.footerBrand}><div className={styles.brand}><span className={styles.mark}><i className="pi pi-leaf" /></span><strong>Saúde <em>e Vida</em></strong></div><p>Produtos naturais e escolhas simples para cuidar de você.</p></div><div><strong>Institucional</strong><a href="#vitrine">Nossa loja</a><a href="#categorias">Categorias</a><a href="#atendimento">Atendimento</a></div><div><strong>Compra segura</strong><span>Mercado Pago</span><span>Pix e cartão</span><span>Dados protegidos</span></div><div><strong>Atendimento</strong><span>Fale com a nossa equipe</span><span>Pedidos acompanhados na sua conta</span><Link href="/auth/login">Acesso ao sistema</Link></div><div className={styles.footerBottom}><span>© Saúde e Vida · Loja online</span><span>Estoque integrado ao sistema</span></div></footer>
            </div>
            {carrinho.length > 0 && <button className={styles.cartButton} onClick={abrirCarrinho}><i className="pi pi-shopping-bag" /> Ver carrinho · {dinheiro(total)}</button>}
            {aberto && <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setAberto(false); }}><aside className={styles.drawer}><div className={styles.drawerHeader}><h2>{enviado ? 'Pedido recebido' : cliente && carrinho.length === 0 ? perfilAba === 'pedidos' ? 'Meus pedidos' : 'Minha conta' : cliente ? 'Finalizar pedido' : 'Minha conta'}</h2><button className={styles.close} onClick={() => setAberto(false)} aria-label="Fechar">×</button></div>{enviado ? <div className={styles.success}><strong>Pedido #{enviado.pedido} recebido.</strong><p>{enviado.mensagem}</p><button className={styles.button} onClick={() => setAberto(false)}>Continuar navegando</button></div> : <>{carrinho.length > 0 && <div>{carrinho.map((item) => <div className={styles.cartItem} key={item.id}><div><strong>{item.nome}</strong><span>{item.a_granel ? `${dinheiro(item.preco)} / kg` : `${dinheiro(item.preco)} cada`}</span></div><div className={styles.quantity}><button onClick={() => alterarQuantidade(item.id, -1)}>−</button><b>{item.quantidadeCarrinho.toLocaleString('pt-BR', { maximumFractionDigits: item.a_granel ? 3 : 0 })}{item.a_granel ? ' kg' : ''}</b><button onClick={() => alterarQuantidade(item.id, 1)}>+</button></div></div>)}</div>}{!cliente ? contaFormView : carrinho.length === 0 ? perfilAba === 'pedidos' ? pedidosView : perfilView : checkoutView}</>}</aside></div>}
        </main>
    );

    return <main className={styles.page}><div className={styles.shell}><div className={styles.topBar}><span>FRETE GRÁTIS A PARTIR DE R$ 199</span><span>COMPRA 100% SEGURA</span><span>ATENDIMENTO PELO WHATSAPP</span><span>ESTOQUE ATUALIZADO</span></div><header className={styles.header}><div className={styles.brand}><span className={styles.mark}><i className="pi pi-leaf" /></span><strong>Saúde <em>e Vida</em></strong></div><div className={styles.headerSearch}><i className="pi pi-search" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="O que você está procurando?" aria-label="O que você está procurando" /><button onClick={() => document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' })}>Buscar</button></div><div className={styles.headerActions}><button onClick={() => { setAberto(true); setEnviado(null); setPerfilAba('conta'); }}><i className="pi pi-user" /><span>{cliente ? cliente.nome.split(' ')[0] : 'Minha conta'}</span></button><button onClick={abrirCarrinho}><i className="pi pi-shopping-bag" /><span>Carrinho {carrinho.length > 0 && `(${carrinho.length})`}</span></button></div></header><nav className={styles.nav}><button className={abaAtiva === 'inicio' ? styles.navActive : ''} onClick={() => { setAbaAtiva('inicio'); setCategoriaAtiva('Todos'); document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' }); }}>INÍCIO</button>{categorias.filter((categoria) => categoria !== 'Todos' && categoria !== 'Granel').slice(0, 7).map((categoria) => <button key={categoria} onClick={() => { setAbaAtiva('inicio'); setCategoriaAtiva(categoria); document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' }); }}>{categoria.toUpperCase()}</button>)}<button className={categoriaAtiva === 'Granel' ? styles.navActive : ''} onClick={() => { setAbaAtiva('granel'); setCategoriaAtiva('Granel'); document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' }); }}>GRANEL <span className={styles.navCount}>{produtosGranel.length}</span></button><button onClick={() => { setAbaAtiva('inicio'); setCategoriaAtiva('Todos'); document.getElementById('promocoes')?.scrollIntoView({ behavior: 'smooth' }); }}>OFERTAS</button></nav><section className={styles.hero}><div><span className={styles.eyebrow}>Cuidado que chega até você</span><h1>Escolhas simples para uma vida mais saudável.</h1><p>Conheça os produtos selecionados da Saúde e Vida e receba seu pedido com praticidade.</p><a className={styles.heroButton} href="#vitrine">Comprar agora <i className="pi pi-arrow-right" /></a></div><div className={styles.heroCard}><span>SELEÇÃO DA SEMANA</span><strong>Seu bem-estar começa nos pequenos hábitos.</strong><p>Produtos selecionados e estoque atualizado em tempo real.</p><div className={styles.heroProduct}><i className="pi pi-sparkles" /><span>Mais leveza para sua rotina</span></div><div className={styles.heroOrb}><i className="pi pi-leaf" /></div></div></section><section className={styles.benefits}><div><i className="pi pi-truck" /><span><strong>FRETE GRÁTIS</strong><small>Nas compras acima de R$ 199</small></span></div><div><i className="pi pi-shield" /><span><strong>COMPRA SEGURA</strong><small>Seus dados protegidos</small></span></div><div><i className="pi pi-refresh" /><span><strong>TROCA FACILITADA</strong><small>Fale com nossa equipe</small></span></div><div><i className="pi pi-credit-card" /><span><strong>PARCELAMENTO</strong><small>Parcelamento nas compras a partir de R$ 99,90</small></span></div></section><section className={styles.categoryTiles}><div className={styles.categoryIntro}><span className={styles.eyebrow}>Explore a loja</span><h2>Encontre seu cuidado</h2><p>Escolha uma categoria para descobrir os produtos ideais para sua rotina.</p></div>{categorias.filter((categoria) => categoria !== 'Todos').slice(0, 4).map((categoria, index) => <button key={categoria} onClick={() => { setCategoriaAtiva(categoria); document.getElementById('todos')?.scrollIntoView({ behavior: 'smooth' }); }}><span className={styles.categoryTileIcon}><i className={['pi pi-heart', 'pi pi-refresh', 'pi pi-box', 'pi pi-sun'][index % 4]} /></span><strong>{categoria}</strong><small>Ver produtos <i className="pi pi-arrow-right" /></small></button>)}</section><section className={styles.categoryRows}>{categorias.filter((categoria) => categoria !== 'Todos' && ordenados.some((produto) => categoria === 'Granel' ? Boolean(produto.a_granel) : (produto.categoria || 'Saúde e bem-estar') === categoria)).map((categoria) => { const itens = ordenados.filter((produto) => categoria === 'Granel' ? Boolean(produto.a_granel) : (produto.categoria || 'Saúde e bem-estar') === categoria).slice(0, 3); return <section className={styles.categoryRow} key={categoria}><div className={styles.categoryRowHeading}><div><span className={styles.eyebrow}>Explore por categoria</span><h2>{categoria}</h2></div><button onClick={() => { setAbaAtiva(categoria === 'Granel' ? 'granel' : 'inicio'); setCategoriaAtiva(categoria); document.getElementById('todos')?.scrollIntoView({ behavior: 'smooth' }); }}>Ver todos <i className="pi pi-arrow-right" /></button></div><div className={styles.grid}>{itens.map(produtoCard)}</div></section>; })}</section><section className={styles.promoBanners}><article className={styles.promoBanner}><div><span>ROTINA MAIS LEVE</span><h2>Cuide de você todos os dias.</h2><p>Produtos selecionados para acompanhar seus pequenos hábitos.</p><a href="#destaques">Ver destaques <i className="pi pi-arrow-right" /></a></div><i className="pi pi-leaf" /></article><article className={`${styles.promoBanner} ${styles.promoBannerWarm}`}><div><span>OFERTAS DA SEMANA</span><h2>Mais cuidado por menos.</h2><p>Confira os produtos com preço especial na loja.</p><a href="#promocoes">Ver promoções <i className="pi pi-arrow-right" /></a></div><i className="pi pi-sparkles" /></article></section><section className={styles.store} id="vitrine"><div className={styles.storeTop}><div><span className={styles.eyebrow}>Nossa vitrine</span><h2>{abaAtiva === 'granel' ? 'Produtos a granel' : 'Encontre o que faz bem'}</h2></div><span className={styles.storeCount}>{filtrados.length} produtos disponíveis</span></div><div className={styles.mobileCategoryToggle}><button onClick={() => setMenuCategorias(!menuCategorias)}><i className="pi pi-list" /> Categorias <i className="pi pi-chevron-down" /></button></div><div className={styles.storeLayout}><aside className={`${styles.sidebar} ${menuCategorias ? styles.sidebarOpen : ''}`}><strong>Comprar por categoria</strong>{categorias.map((categoria) => <button className={categoriaAtiva === categoria ? styles.categoryActive : ''} key={categoria} onClick={() => { setCategoriaAtiva(categoria); setMenuCategorias(false); }}>{categoria}<span>{categoria === 'Todos' ? produtos.length : categoria === 'Granel' ? produtosGranel.length : produtos.filter((produto) => (produto.categoria || 'Saúde e bem-estar') === categoria).length}</span></button>)}</aside><div className={styles.sections}>{erro && !aberto && <div className={styles.empty}>{erro}</div>}{carregando ? <div className={styles.empty}>Carregando produtos…</div> : <>{!produtos.length && !erro && <div className={styles.empty}><strong>Nenhum produto publicado ainda.</strong><p>Os produtos do estoque só aparecem aqui depois de serem marcados como “Na loja”, categorizados e salvos na configuração.</p><Link href="/loja/configuracao">Configurar produtos</Link></div>}{secoes.map((secao) => { const itens = produtosDaSecao(secao.id); return itens.length > 0 && <section className={styles.productSection} id={secao.id} key={secao.id}><div className={styles.sectionTitle}><div><h2>{secao.titulo}</h2><p>{secao.apoio}</p></div><span>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span></div><div className={styles.grid}>{itens.map(produtoCard)}</div></section>; })}<section className={`${styles.promoBanner} ${styles.promoBannerInline}`}><div><span>ESCOLHAS SAUDÁVEIS</span><h2>Seu próximo hábito começa aqui.</h2><p>Monte seu carrinho com praticidade e receba tudo em um só pedido.</p></div><i className="pi pi-heart" /></section><section className={styles.productSection} id="todos"><div className={styles.sectionTitle}><div><h2>{categoriaAtiva === 'Todos' ? 'Todos os produtos' : categoriaAtiva}</h2><p>Veja todos os itens disponíveis nesta categoria</p></div><span>{filtrados.length} itens</span></div>{filtrados.length ? <div className={styles.grid}>{filtrados.map(produtoCard)}</div> : <div className={styles.empty}>Nenhum produto encontrado para essa busca.</div>}</section></>}</div></div></section></div>{carrinho.length > 0 && <button className={styles.cartButton} onClick={abrirCarrinho}><i className="pi pi-shopping-bag" /> Ver carrinho · {dinheiro(total)}</button>}{aberto && <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setAberto(false); }}><aside className={styles.drawer}><div className={styles.drawerHeader}><h2>{enviado ? 'Pedido recebido' : cliente && carrinho.length === 0 ? perfilAba === 'pedidos' ? 'Meus pedidos' : 'Minha conta' : cliente ? 'Finalizar pedido' : 'Minha conta'}</h2><button className={styles.close} onClick={() => setAberto(false)} aria-label="Fechar">×</button></div>{enviado ? <div className={styles.success}><strong>Pedido #{enviado.pedido} recebido.</strong><p>{enviado.mensagem}</p><button className={styles.button} onClick={() => setAberto(false)}>Continuar navegando</button></div> : <>{carrinho.length > 0 && <div>{carrinho.map((item) => <div className={styles.cartItem} key={item.id}><div><strong>{item.nome}</strong><span>{item.a_granel ? `${dinheiro(item.preco)} / kg` : `${dinheiro(item.preco)} cada`}</span></div><div className={styles.quantity}><button onClick={() => alterarQuantidade(item.id, -1)}>−</button><b>{item.quantidadeCarrinho.toLocaleString('pt-BR', { maximumFractionDigits: item.a_granel ? 3 : 0 })}{item.a_granel ? ' kg' : ''}</b><button onClick={() => alterarQuantidade(item.id, 1)}>+</button></div></div>)}</div>}{!cliente ? contaFormView : carrinho.length === 0 ? perfilAba === 'pedidos' ? pedidosView : perfilView : checkoutView}</>}</aside></div>}</main>;
}
