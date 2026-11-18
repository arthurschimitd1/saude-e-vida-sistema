'use client';

// Módulo de Pedidos de Compra — gera lista automática a partir do estoque mínimo, permite seleção, PDF e histórico
import React, { useState, useRef, useEffect } from 'react';
import { Button } from 'primereact/button';
import { InputNumber } from '@/app/(main)/components/MobileFriendlyInputNumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { AutoComplete } from 'primereact/autocomplete';
import { Calendar } from 'primereact/calendar';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { Divider } from 'primereact/divider';
import { Paginator } from 'primereact/paginator';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import api from '../../services/api/baseApi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtMoeda = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (v: any) => {
    if (!v) return '—';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [ano, mes, dia] = v.split('-').map(Number);
        return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR');
    }
    return new Date(v).toLocaleDateString('pt-BR');
};
const dataParaIso = (data: Date) =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;

const UNIDADES_INTEIRAS = ['UN', 'CX', 'PC', 'DZ', 'CT', 'PCT', ''];
const isUnidadeInteira = (un?: string | null) => UNIDADES_INTEIRAS.includes((un ?? '').toUpperCase().trim());
const fmtQtd = (v: number | string | undefined | null, unidade?: string | null) => {
    const n = Number(v ?? 0);
    if (isNaN(n)) return String(v ?? '');
    if (isUnidadeInteira(unidade)) return Math.round(n).toLocaleString('pt-BR');
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

const COR_ITEM = '#3b82f6';

// ── tipos ─────────────────────────────────────────────────────────────────────
type Status = 'pendente' | 'aprovado' | 'em_processamento' | 'recebido' | 'cancelado';
type StatusFinanceiro = 'nao_pago' | 'parcial' | 'quitado';

interface Produto {
    id: number;
    name: string;
    code?: string;
    currentQuantity: number;
    minQuantity: number;
    preco_compra: number;
    price: number;
    unidade_medida?: string;
    is_materia_prima?: boolean;
    fornecedor_id?: number | null;
}

interface Fornecedor {
    id: number;
    nomeCompleto: string;
    cpf?: string | null;
    cnpj?: string | null;
    email?: string | null;
    telefone?: string | null;
    rua?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
}

interface ItemLista {
    produto_id: number;
    fornecedor_id?: number | null;
    nome: string;
    codigo?: string;
    estoque_atual: number;
    estoque_minimo: number;
    quantidade: number;
    preco_compra: number;
    selecionado: boolean;
    unidade_medida?: string;
    tipo?: 'produto' | 'materia_prima';
}

interface Pedido {
    id?: number;
    numero?: string;
    fornecedor_id?: number | null;
    fornecedor: string;
    status: Status;
    data_pedido: any;
    data_previsao: any;
    valor_total?: number;
    controle_financeiro_ativo?: boolean | null;
    valor_pago?: number | null;
    saldo_pendente?: number | null;
    status_financeiro?: StatusFinanceiro | null;
    observacao: string;
    itens: any[];
}

interface PedidoPagamento {
    id: number;
    pedido_id: number;
    valor: number;
    data_pagamento: string;
    observacao?: string | null;
    created_at?: string;
}

// ── constantes ────────────────────────────────────────────────────────────────
const statusOptions = [
    { label: 'Pendente',         value: 'pendente' },
    { label: 'Aprovado',         value: 'aprovado' },
    { label: 'Em processamento', value: 'em_processamento' },
    { label: 'Recebido',         value: 'recebido' },
    { label: 'Cancelado',        value: 'cancelado' },
];

const statusSeverity: Record<Status, 'warning' | 'info' | 'success' | 'danger'> = {
    pendente: 'warning', aprovado: 'info', em_processamento: 'info',
    recebido: 'success', cancelado: 'danger',
};

const statusLabel: Record<Status, string> = {
    pendente: 'Pendente', aprovado: 'Aprovado', em_processamento: 'Em processamento',
    recebido: 'Recebido', cancelado: 'Cancelado',
};

const statusFinanceiroLabel: Record<StatusFinanceiro, string> = {
    nao_pago: 'Não pago',
    parcial: 'Parcial',
    quitado: 'Quitado',
};

const statusFinanceiroSeverity: Record<StatusFinanceiro, 'warning' | 'info' | 'success'> = {
    nao_pago: 'warning',
    parcial: 'info',
    quitado: 'success',
};

// ─────────────────────────────────────────────────────────────────────────────
const PedidosPage = () => {
    const toast = useRef<Toast>(null);

    // ── empresa (sem dropdown — master usa o do header) ──
    const [empresaId, setEmpresaId] = useState<number | null>(null);
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [fornecedorSelecionado, setFornecedorSelecionado] = useState<Fornecedor | null>(null);
    const [queryFornecedor, setQueryFornecedor] = useState('');
    const [sugestoesFornecedores, setSugestoesFornecedores] = useState<Fornecedor[]>([]);
    const [loadingFornecedores, setLoadingFornecedores] = useState(false);


    // ── lista de itens ──
    const [itenslista, setItensLista]       = useState<ItemLista[]>([]);
    const [todosProdutos, setTodosProdutos] = useState<Produto[]>([]);
    const [loadingProdutos, setLoadingProdutos] = useState(false);
    const [primeiroProduto, setPrimeiroProduto] = useState(0);
    const [produtosPorPagina, setProdutosPorPagina] = useState(10);
    const produtosRequestId = useRef(0);

    // autocomplete produto extra
    const [queryProduto, setQueryProduto] = useState('');
    const [sugestoes, setSugestoes]       = useState<Produto[]>([]);
    const [produtoExtra, setProdutoExtra] = useState<Produto | null>(null);
    const [qtdExtra, setQtdExtra]         = useState<number>(1);

    // ── histórico ──
    const [pedidos, setPedidos]               = useState<Pedido[]>([]);
    const [loadingPedidos, setLoadingPedidos] = useState(false);
    const [filtroStatus, setFiltroStatus]     = useState<string | null>(null);
    const [somentePendentes, setSomentePendentes] = useState(false);
    const [pedidosDividas, setPedidosDividas] = useState<Pedido[]>([]);
    const [loadingDividas, setLoadingDividas] = useState(false);
    const [abaHistorico, setAbaHistorico] = useState(0);

    // ── dialogs ──
    const [salvarDialog, setSalvarDialog]   = useState(false);
    const [detalheDialog, setDetalheDialog] = useState(false);
    const [pedidoDetalhe, setPedidoDetalhe] = useState<Pedido | null>(null);
    const [pagamentosDetalhe, setPagamentosDetalhe] = useState<PedidoPagamento[]>([]);
    const [loadingPagamentos, setLoadingPagamentos] = useState(false);
    const [pagamentoDialog, setPagamentoDialog] = useState(false);
    const [pedidoPagamento, setPedidoPagamento] = useState<Pedido | null>(null);
    const [salvandoPagamento, setSalvandoPagamento] = useState(false);
    const [formPagamento, setFormPagamento] = useState({
        valor: null as number | null,
        data_pagamento: new Date(),
        observacao: '',
    });
    const [formSalvar, setFormSalvar]       = useState({
        status: 'pendente' as Status, data_previsao: null as Date | null, observacao: '',
    });

    const showSuccess = (msg: string) => toast.current?.show({ severity: 'success', summary: 'Sucesso', detail: msg, life: 3000 });
    const showError   = (msg: string) => toast.current?.show({ severity: 'error',   summary: 'Erro',    detail: msg, life: 3000 });

    // ── inicialização ─────────────────────────────────────────────────────────
    useEffect(() => {
        try {
            const saved = localStorage.getItem('empresa_selecionada');
            const u     = JSON.parse(localStorage.getItem('user') ?? '{}');
            const eid   = saved && !isNaN(Number(saved)) ? Number(saved) : (u?.empresa_id ?? null);
            setEmpresaId(eid);
            fetchFornecedores();
            fetchProdutos();
            fetchPedidos(eid);
            fetchDividas();
        } catch {
            fetchFornecedores();
            fetchProdutos();
            fetchPedidos();
            fetchDividas();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const mountedStatus = useRef(false);
    useEffect(() => {
        if (!mountedStatus.current) { mountedStatus.current = true; return; }
        fetchPedidos(empresaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtroStatus, somentePendentes]);

    useEffect(() => {
        const ultimaPagina = Math.max(0, Math.floor((itenslista.length - 1) / produtosPorPagina) * produtosPorPagina);
        if (primeiroProduto > ultimaPagina) setPrimeiroProduto(ultimaPagina);
    }, [itenslista.length, primeiroProduto, produtosPorPagina]);

    const fetchFornecedores = async () => {
        setLoadingFornecedores(true);
        try {
            const res = await api.get('/fornecedores');
            const lista = res.data?.data ?? res.data ?? [];
            setFornecedores(Array.isArray(lista) ? lista : []);
        } catch {
            setFornecedores([]);
            showError('Erro ao carregar fornecedores');
        } finally {
            setLoadingFornecedores(false);
        }
    };

    const selecionarFornecedor = (fornecedorId: number | null) => {
        const selecionado = fornecedores.find(fornecedor => fornecedor.id === fornecedorId) ?? null;
        setFornecedorSelecionado(selecionado);
        setQueryFornecedor(selecionado?.nomeCompleto ?? '');
        setItensLista([]);
        setTodosProdutos([]);
        setPrimeiroProduto(0);
        setProdutoExtra(null);
        setQueryProduto('');
        fetchProdutos(selecionado?.id);
    };

    const buscarSugestoesFornecedores = (query: string) => {
        const termo = query.trim().toLowerCase();
        setSugestoesFornecedores(
            fornecedores.filter(fornecedor =>
                !termo
                || fornecedor.nomeCompleto.toLowerCase().includes(termo)
                || (fornecedor.cnpj ?? '').toLowerCase().includes(termo)
                || (fornecedor.cpf ?? '').toLowerCase().includes(termo)
            )
        );
    };

    // ── fetch produtos ────────────────────────────────────────────────────────
    const fetchProdutos = async (fornecedorId?: number | null) => {
        const requestId = ++produtosRequestId.current;
        setLoadingProdutos(true);
        try {
            const params = fornecedorId ? { fornecedor_id: fornecedorId } : {};
            const res = await api.get('/products', { params });
            const todos: Produto[] = res.data;
            if (requestId !== produtosRequestId.current) return;
            setTodosProdutos(todos);
            setPrimeiroProduto(0);

            const precisaReposicao = (produto: Produto) =>
                (
                    (Number(produto.minQuantity) > 0 && Number(produto.currentQuantity) <= Number(produto.minQuantity))
                    || Number(produto.currentQuantity) === 0
                );

            // Exibe todos; produtos que precisam de reposição começam selecionados.
            const itensProdutos: ItemLista[] = todos.map(p => ({
                produto_id:     p.id,
                fornecedor_id:  p.fornecedor_id,
                nome:           p.is_materia_prima ? `${p.name} (MP)` : p.name,
                codigo:         p.code,
                estoque_atual:  p.currentQuantity,
                estoque_minimo: p.minQuantity,
                quantidade:     (() => { const d = p.minQuantity > 0 ? p.minQuantity - p.currentQuantity : 0; const intUnit = ['UN','CX','PC','DZ','CT'].includes((p.unidade_medida||'').toUpperCase()); return d > 0 ? d : (intUnit ? 1 : 0.001); })(),
                preco_compra:   Number(p.preco_compra ?? p.price) || 0,
                selecionado:    !!fornecedorId && precisaReposicao(p),
                unidade_medida: p.unidade_medida,
                tipo:           'produto',
            }));
            setItensLista(itensProdutos);
        } catch {
            if (requestId === produtosRequestId.current) showError('Erro ao carregar produtos');
        } finally {
            if (requestId === produtosRequestId.current) setLoadingProdutos(false);
        }
    };

    // ── fetch pedidos ─────────────────────────────────────────────────────────
    const fetchPedidos = async (eid?: number | null) => {
        setLoadingPedidos(true);
        try {
            const params: Record<string, any> = eid ? { empresa_id: eid } : {};
            if (filtroStatus) params.status = filtroStatus;
            if (somentePendentes) params.somente_pendentes = true;
            const res = await api.get('/pedidos', { params });
            setPedidos(Array.isArray(res.data) ? res.data : []);
        } catch {
            showError('Erro ao carregar pedidos');
        } finally {
            setLoadingPedidos(false);
        }
    };

    const fetchDividas = async () => {
        setLoadingDividas(true);
        try {
            const res = await api.get('/pedidos', { params: { somente_pendentes: true } });
            setPedidosDividas(Array.isArray(res.data) ? res.data : []);
        } catch {
            showError('Erro ao carregar dívidas');
        } finally {
            setLoadingDividas(false);
        }
    };

    // ── manipulação da lista ──────────────────────────────────────────────────
    const toggleItem  = (idx: number) =>
        setItensLista(prev => prev.map((it, i) => i === idx ? { ...it, selecionado: !it.selecionado } : it));

    const alterarQtd  = (idx: number, qtd: number) =>
        setItensLista(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: qtd } : it));

    const removerItem = (idx: number) =>
        setItensLista(prev => prev.filter((_, i) => i !== idx));

    const selecionarTodos = () =>
        setItensLista(prev => prev.map(it => ({ ...it, selecionado: true })));

    const limparSelecao = () =>
        setItensLista(prev => prev.map(it => ({ ...it, selecionado: false })));

    // ── autocomplete ──────────────────────────────────────────────────────────
    const buscarSugestoes = (q: string) => {
        const lower = q.toLowerCase();
        setSugestoes(
            todosProdutos.filter(p =>
                p.name.toLowerCase().includes(lower) || (p.code ?? '').toLowerCase().includes(lower)
            ).slice(0, 20)
        );
    };

    const adicionarProdutoExtra = () => {
        if (!produtoExtra) return showError('Selecione um produto');
        if (qtdExtra <= 0)  return showError('Quantidade deve ser maior que zero');

        const indiceExistente = itenslista.findIndex(item => item.produto_id === produtoExtra.id);
        if (indiceExistente >= 0) {
            setItensLista(prev => prev.map((item, idx) =>
                idx === indiceExistente
                    ? { ...item, quantidade: qtdExtra, selecionado: true }
                    : item
            ));
            setPrimeiroProduto(Math.floor(indiceExistente / produtosPorPagina) * produtosPorPagina);
            showSuccess('Produto selecionado na lista');
        } else {
            setItensLista(prev => [...prev, {
                produto_id:     produtoExtra.id,
                fornecedor_id:  produtoExtra.fornecedor_id,
                nome:           produtoExtra.name,
                codigo:         produtoExtra.code,
                estoque_atual:  produtoExtra.currentQuantity,
                estoque_minimo: produtoExtra.minQuantity,
                quantidade:     qtdExtra,
                preco_compra:   Number(produtoExtra.preco_compra ?? produtoExtra.price) || 0,
                selecionado:    true,
                unidade_medida: produtoExtra.unidade_medida,
                tipo:           'produto',
            }]);
            setPrimeiroProduto(Math.floor(itenslista.length / produtosPorPagina) * produtosPorPagina);
            showSuccess('Produto adicionado à lista');
        }
        setProdutoExtra(null);
        setQueryProduto('');
        setQtdExtra(1);
    };

    // ── derivados ─────────────────────────────────────────────────────────────
    const itensSelecionados  = itenslista.filter(it => it.selecionado);
    const itensPaginados     = itenslista.slice(primeiroProduto, primeiroProduto + produtosPorPagina);
    const totalEstimado      = itensSelecionados.reduce((acc, it) => acc + it.quantidade * it.preco_compra, 0);
    const todosSelecionados  = itenslista.length > 0 && itenslista.every(it => it.selecionado);
    const totalDividas       = pedidosDividas.reduce((acc, pedido) => acc + Number(pedido.saldo_pendente || 0), 0);
    const possuiItemSemFornecedor = itensSelecionados.some(item => !item.fornecedor_id);
    const fornecedorIdsSelecionados = [...new Set(
        itensSelecionados
            .map(item => item.fornecedor_id)
            .filter((id): id is number => id != null)
    )];
    const fornecedorInferido = !fornecedorSelecionado
        && !possuiItemSemFornecedor
        && fornecedorIdsSelecionados.length === 1
        ? fornecedores.find(item => item.id === fornecedorIdsSelecionados[0]) ?? null
        : null;
    const fornecedorDoPedido = fornecedorSelecionado ?? fornecedorInferido;
    const selecaoFornecedorValida = itensSelecionados.length > 0
        && !!fornecedorDoPedido
        && itensSelecionados.every(item => item.fornecedor_id === fornecedorDoPedido.id);

    const mensagemFornecedorDaSelecao = () => {
        if (itensSelecionados.length === 0) return null;
        if (possuiItemSemFornecedor) {
            return 'Há produto sem fornecedor na seleção. Vincule um fornecedor ao produto antes de gerar o pedido.';
        }
        if (fornecedorIdsSelecionados.length > 1) {
            return 'Selecione produtos de apenas um fornecedor por pedido.';
        }
        if (!fornecedorDoPedido) {
            return 'Não foi possível identificar o fornecedor dos produtos selecionados.';
        }
        return null;
    };

    // ── PDF ───────────────────────────────────────────────────────────────────
    const gerarDocumentoPDF = (
        itens: Array<Partial<ItemLista> & { nome: string; quantidade: number; preco_compra: number }>,
        fornecedor: Pick<Fornecedor, 'nomeCompleto'> & Partial<Fornecedor>,
        numeroPedido?: string,
    ) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(numeroPedido ? `Pedido de Compra ${numeroPedido}` : 'Pedido de Compra', 14, 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
        doc.text(`Fornecedor: ${fornecedor.nomeCompleto}`, 14, 37);

        const documento = fornecedor.cnpj || fornecedor.cpf;
        const contato = [fornecedor.telefone, fornecedor.email].filter(Boolean).join(' | ');
        let proximaLinha = 44;
        if (documento || contato) {
            doc.text([documento ? `Documento: ${documento}` : '', contato].filter(Boolean).join(' | '), 14, proximaLinha);
            proximaLinha += 7;
        }

        const endereco = [
            [fornecedor.rua, fornecedor.numero].filter(Boolean).join(', '),
            fornecedor.bairro,
            [fornecedor.cidade, fornecedor.estado].filter(Boolean).join(' - '),
            fornecedor.cep,
        ].filter(Boolean).join(' | ');
        if (endereco) {
            doc.text(`Endereço: ${endereco}`, 14, proximaLinha);
            proximaLinha += 7;
        }

        const total = itens.reduce((acc, item) => acc + item.quantidade * item.preco_compra, 0);
        autoTable(doc, {
            startY: proximaLinha,
            head: [['Produto', 'Código', 'Quantidade', 'Unidade', 'Valor unitário', 'Subtotal']],
            body: itens.map(it => [
                it.nome, it.codigo || '—', fmtQtd(it.quantidade, it.unidade_medida), it.unidade_medida || '—',
                fmtMoeda(it.preco_compra), fmtMoeda(it.quantidade * it.preco_compra),
            ]),
            foot: [['', '', '', '', 'Total:', fmtMoeda(total)]],
            theme: 'grid',
            styles:     { fontSize: 8 },
            headStyles: { fillColor: [30, 136, 229], textColor: 255 },
            footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: [0, 0, 0] },
        });

        const identificador = numeroPedido || new Date().toISOString().split('T')[0];
        doc.save(`pedido-compra-${identificador}.pdf`);
        showSuccess('PDF gerado com sucesso');
    };

    const gerarPDF = () => {
        if (itensSelecionados.length === 0) return showError('Selecione pelo menos um produto');
        if (!selecaoFornecedorValida || !fornecedorDoPedido) {
            return showError(mensagemFornecedorDaSelecao() || 'Selecione um fornecedor válido');
        }
        gerarDocumentoPDF(itensSelecionados, fornecedorDoPedido);
    };

    const gerarPDFHistorico = (pedido: Pedido) => {
        const fornecedor = fornecedores.find(item => item.id === pedido.fornecedor_id) ?? {
            nomeCompleto: pedido.fornecedor || 'Fornecedor não informado',
        };
        const itens = (pedido.itens ?? []).map(item => ({
            nome: item.produto || item.nome || 'Produto',
            codigo: item.codigo,
            quantidade: Number(item.quantidade) || 0,
            preco_compra: Number(item.valor_unitario) || 0,
            unidade_medida: item.unidade_medida,
        }));
        if (itens.length === 0) return showError('Este pedido não possui produtos');
        gerarDocumentoPDF(itens, fornecedor, pedido.numero);
    };

    // ── salvar pedido ─────────────────────────────────────────────────────────
    const salvarPedido = async () => {
        if (itensSelecionados.length === 0) return showError('Selecione pelo menos um produto');
        if (!selecaoFornecedorValida || !fornecedorDoPedido) {
            return showError(mensagemFornecedorDaSelecao() || 'Selecione um fornecedor válido');
        }

        const payload = {
            fornecedor_id: fornecedorDoPedido.id,
            status:        formSalvar.status,
            data_pedido:   new Date().toISOString().split('T')[0],
            data_previsao: formSalvar.data_previsao
                ? formSalvar.data_previsao.toISOString().split('T')[0] : null,
            observacao:    formSalvar.observacao,
            itens: itensSelecionados.map(it => ({
                produto_id: it.produto_id, produto: it.nome, quantidade: it.quantidade, valor_unitario: it.preco_compra,
                tipo: it.tipo ?? 'produto',
            })),
        };

        try {
            await api.post('/pedidos', payload);
            showSuccess('Pedido salvo com sucesso');
            setSalvarDialog(false);
            setFormSalvar({ status: 'pendente', data_previsao: null, observacao: '' });
            fetchPedidos(empresaId);
            fetchDividas();
        } catch (err: any) {
            showError(err.message || 'Erro ao salvar pedido');
        }
    };

    // ── financeiro ────────────────────────────────────────────────────────────
    const podeRegistrarPagamento = (pedido: Pedido | null) =>
        !!pedido?.id &&
        pedido.controle_financeiro_ativo === true &&
        pedido.status !== 'cancelado' &&
        Number(pedido.saldo_pendente) > 0;

    const abrirPagamento = (pedido: Pedido) => {
        if (!podeRegistrarPagamento(pedido)) return;
        setPedidoPagamento(pedido);
        setFormPagamento({
            valor: null,
            data_pagamento: new Date(),
            observacao: '',
        });
        setPagamentoDialog(true);
    };

    const registrarPagamento = async () => {
        if (!pedidoPagamento?.id) return showError('Pedido inválido');
        const valor = Number(formPagamento.valor);
        const saldo = Number(pedidoPagamento.saldo_pendente);
        if (!Number.isFinite(valor) || valor <= 0) return showError('Informe um valor maior que zero');
        if (valor > saldo) return showError(`O pagamento não pode ultrapassar o saldo de ${fmtMoeda(saldo)}`);

        setSalvandoPagamento(true);
        try {
            await api.post(`/pedidos/${pedidoPagamento.id}/pagamentos`, {
                valor,
                data_pagamento: dataParaIso(formPagamento.data_pagamento),
                observacao: formPagamento.observacao,
            });
            showSuccess('Pagamento registrado com sucesso');
            setPagamentoDialog(false);
            setPedidoPagamento(null);
            await Promise.all([fetchPedidos(empresaId), fetchDividas()]);
            if (pedidoDetalhe?.id === pedidoPagamento.id) {
                await abrirDetalhes(pedidoPagamento);
            }
        } catch (err: any) {
            showError(err.message || 'Erro ao registrar pagamento');
        } finally {
            setSalvandoPagamento(false);
        }
    };

    const abrirDetalhes = async (pedido: Pedido) => {
        setPedidoDetalhe(pedido);
        setPagamentosDetalhe([]);
        setDetalheDialog(true);
        if (!pedido.id) return;

        try {
            const detalhe = await api.get(`/pedidos/${pedido.id}`);
            setPedidoDetalhe(detalhe.data);
        } catch {
            showError('Erro ao atualizar os detalhes do pedido');
        }

        if (pedido.controle_financeiro_ativo !== true) return;
        setLoadingPagamentos(true);
        try {
            const res = await api.get(`/pedidos/${pedido.id}/pagamentos`);
            setPagamentosDetalhe(Array.isArray(res.data?.pagamentos) ? res.data.pagamentos : []);
        } catch {
            showError('Erro ao carregar pagamentos do pedido');
        } finally {
            setLoadingPagamentos(false);
        }
    };

    // ── histórico ações ───────────────────────────────────────────────────────
    const isAtrasado = (row: any) => {
        if (!row.data_previsao) return false;
        if (row.status === 'recebido' || row.status === 'cancelado') return false;
        return new Date(row.data_previsao) < new Date();
    };

    const marcarEntregue = (pedido: any) => {
        confirmDialog({
            message: `Confirmar entrega do pedido ${pedido.numero || '#' + pedido.id}?`,
            header: 'Marcar como recebido',
            icon: 'pi pi-check-circle',
            acceptLabel: 'Sim, confirmar',
            rejectLabel: 'Cancelar',
            accept: async () => {
                try {
                    await api.put(`/pedidos/${pedido.id}`, { status: 'recebido' });
                    showSuccess('Pedido marcado como recebido');
                    fetchPedidos(empresaId);
                    fetchDividas();
                } catch { showError('Erro ao atualizar pedido'); }
            },
        });
    };

    const confirmarDelete = (pedido: any) => {
        confirmDialog({
            message: `Deseja remover o pedido ${pedido.numero || '#' + pedido.id}?`,
            header: 'Confirmar exclusão',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sim, remover', rejectLabel: 'Cancelar',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await api.delete(`/pedidos/${pedido.id}`);
                    showSuccess('Pedido removido');
                    fetchPedidos(empresaId);
                    fetchDividas();
                } catch (err: any) { showError(err.message || 'Erro ao remover pedido'); }
            },
        });
    };

    const statusTemplate = (row: any) => {
        const atrasado = isAtrasado(row);
        return (
            <div className="flex align-items-center gap-2 flex-wrap">
                <Tag value={statusLabel[row.status as Status]} severity={statusSeverity[row.status as Status]} />
                {atrasado && (
                    <Tag value="Atrasado" severity="danger" icon="pi pi-clock" />
                )}
            </div>
        );
    };

    const statusFinanceiroTemplate = (row: Pedido) => {
        if (row.controle_financeiro_ativo !== true || !row.status_financeiro) {
            return <Tag value="Não controlado" severity="secondary" />;
        }
        return (
            <Tag
                value={statusFinanceiroLabel[row.status_financeiro]}
                severity={statusFinanceiroSeverity[row.status_financeiro]}
            />
        );
    };

    const valorFinanceiroTemplate = (valor?: number | null) =>
        valor == null ? <span className="text-color-secondary">—</span> : fmtMoeda(valor);

    const acoesHistorico = (row: any) => (
        <div className="flex gap-2">
            <Button icon="pi pi-eye" rounded outlined severity="info"
                tooltip="Ver detalhes" tooltipOptions={{ position: 'top' }}
                onClick={() => abrirDetalhes(row)} />
            <Button icon="pi pi-file-pdf" rounded outlined severity="secondary"
                tooltip="Gerar PDF" tooltipOptions={{ position: 'top' }}
                onClick={() => gerarPDFHistorico(row)} />
            {podeRegistrarPagamento(row) && (
                <Button icon="pi pi-dollar" rounded outlined severity="warning"
                    tooltip="Registrar pagamento" tooltipOptions={{ position: 'top' }}
                    onClick={() => abrirPagamento(row)} />
            )}
            {row.status !== 'recebido' && row.status !== 'cancelado' && (
                <Button icon="pi pi-check" rounded outlined severity="success"
                    tooltip="Marcar como recebido" tooltipOptions={{ position: 'top' }}
                    onClick={() => marcarEntregue(row)} />
            )}
            <Button icon="pi pi-trash" rounded outlined severity="danger"
                tooltip={Number(row.valor_pago) > 0 ? 'Pedido com pagamentos não pode ser removido' : 'Remover'}
                tooltipOptions={{ position: 'top' }}
                disabled={Number(row.valor_pago) > 0}
                onClick={() => confirmarDelete(row)} />
        </div>
    );

    const tabelaPedidos = (lista: Pedido[], loading: boolean, emptyMessage: string) => (
        <DataTable
            value={lista}
            loading={loading}
            paginator rows={10}
            rowsPerPageOptions={[5, 10, 25, 50]}
            emptyMessage={emptyMessage}
            tableStyle={{ minWidth: '90rem' }}
            rowHover
        >
            <Column field="numero" header="Nº Pedido" sortable style={{ width: '9rem' }} />
            <Column field="fornecedor" header="Fornecedor" sortable />
            <Column header="Entrega" sortField="status" body={statusTemplate} sortable style={{ width: '11rem' }} />
            <Column header="Data" sortField="data_pedido" body={(row) => fmtData(row.data_pedido)} sortable style={{ width: '8rem' }} />
            <Column header="Previsão" sortField="data_previsao" body={(row) => fmtData(row.data_previsao)} sortable style={{ width: '8rem' }} />
            <Column header="Valor Total" sortField="valor_total" body={(row) => fmtMoeda(row.valor_total)} sortable style={{ width: '9rem' }} />
            <Column header="Valor Pago" sortField="valor_pago" body={(row) => valorFinanceiroTemplate(row.valor_pago)} sortable style={{ width: '9rem' }} />
            <Column header="Saldo" sortField="saldo_pendente" body={(row) => valorFinanceiroTemplate(row.saldo_pendente)} sortable style={{ width: '9rem' }} />
            <Column header="Financeiro" sortField="status_financeiro" body={statusFinanceiroTemplate} sortable style={{ width: '10rem' }} />
            <Column header="Ações" body={acoesHistorico} style={{ width: '13rem' }} />
        </DataTable>
    );

    // ── templates dos campos de busca e seleção ───────────────────────────────
    const itemTemplateFornecedor = (item: Fornecedor) => (
        <div>
            <div className="font-medium">{item.nomeCompleto}</div>
            {(item.cnpj || item.cpf) && (
                <div className="text-xs text-color-secondary mt-1">{item.cnpj || item.cpf}</div>
            )}
        </div>
    );

    const itemTemplateProduto = (item: Produto) => (
        <div className="flex justify-content-between align-items-center w-full gap-3">
            <div>
                <div className="font-medium">{item.name}</div>
                {item.code && <div className="text-xs text-color-secondary">{item.code}</div>}
            </div>
            <div className="flex align-items-center gap-2 flex-shrink-0">
                <Tag
                    value={`Estoque: ${item.currentQuantity}`}
                    severity={item.currentQuantity <= item.minQuantity ? 'warning' : 'success'}
                />
                {item.preco_compra > 0 && (
                    <span className="text-xs text-color-secondary">{fmtMoeda(item.preco_compra)}</span>
                )}
            </div>
        </div>
    );

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className="grid">
            <Toast ref={toast} />
            <ConfirmDialog />


            {/* ── Pedidos de Compra ── */}
            <div className="col-12">
                <div className="card">
                    <div className="flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                        <div>
                            <h5 className="m-0 mb-1">Pedidos de Compra</h5>
                            <span className="text-sm text-color-secondary">
                                Selecione os produtos que deseja incluir no próximo pedido.
                            </span>
                        </div>
                        <Button
                            icon="pi pi-refresh"
                            label="Recarregar"
                            severity="secondary"
                            outlined
                            loading={loadingProdutos}
                            onClick={() => fetchProdutos(fornecedorSelecionado?.id)}
                        />
                    </div>

                    <div
                        className="surface-50 border-round p-3 md:p-4 mb-3"
                        style={{ border: '1px solid var(--surface-border)' }}
                    >
                        <div className="flex align-items-center gap-3 mb-3">
                            <div
                                className="flex align-items-center justify-content-center border-circle flex-shrink-0"
                                style={{ width: 36, height: 36, backgroundColor: `${COR_ITEM}14`, color: COR_ITEM }}
                            >
                                <i className="pi pi-filter" />
                            </div>
                            <div>
                                <label className="block font-semibold mb-1">Filtrar por fornecedor</label>
                                <span className="text-xs text-color-secondary">
                                    Digite o nome ou documento, ou abra a lista de opções.
                                </span>
                            </div>
                        </div>
                        <AutoComplete
                            className="w-full"
                            inputClassName="w-full"
                            value={fornecedorSelecionado ?? queryFornecedor}
                            suggestions={sugestoesFornecedores}
                            completeMethod={e => buscarSugestoesFornecedores(e.query)}
                            field="nomeCompleto"
                            itemTemplate={itemTemplateFornecedor}
                            dropdown
                            forceSelection
                            delay={150}
                            disabled={loadingFornecedores}
                            placeholder={loadingFornecedores ? 'Carregando fornecedores...' : 'Todos os fornecedores'}
                            onChange={e => {
                                if (typeof e.value === 'string') {
                                    if (fornecedorSelecionado) selecionarFornecedor(null);
                                    setQueryFornecedor(e.value);
                                }
                            }}
                            onSelect={e => selecionarFornecedor(e.value.id)}
                            onClear={() => selecionarFornecedor(null)}
                        />
                        {fornecedorSelecionado && (
                            <div className="flex align-items-start gap-2 mt-3 text-sm">
                                <i className="pi pi-check-circle mt-1 text-green-600" />
                                <div>
                                    <div className="font-medium mb-1">{fornecedorSelecionado.nomeCompleto}</div>
                                    <span className="text-color-secondary">
                                        {[fornecedorSelecionado.cnpj || fornecedorSelecionado.cpf, fornecedorSelecionado.telefone, fornecedorSelecionado.email]
                                            .filter(Boolean).join(' · ') || 'Fornecedor selecionado'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <p className="text-color-secondary text-sm mt-0 mb-4 line-height-3">
                        <i className="pi pi-info-circle mr-2" />
                        Todos os produtos são exibidos; use o fornecedor como filtro quando desejar.
                        Produtos no estoque mínimo ou abaixo começam selecionados para reposição.
                        Sem filtro, selecione produtos de um mesmo fornecedor e ele será identificado automaticamente.
                    </p>

                    {/* Controles de seleção */}
                    {itenslista.length > 0 && (
                        <div className="flex justify-content-between align-items-center surface-50 border-round p-3 mb-3 flex-wrap gap-2">
                            <div>
                                <div className="font-medium">Produtos disponíveis</div>
                                <span className="text-xs text-color-secondary">
                                    {itensSelecionados.length} de {itenslista.length} selecionado(s)
                                </span>
                            </div>
                            <Button
                                label={todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
                                text
                                size="small"
                                onClick={todosSelecionados ? limparSelecao : selecionarTodos}
                            />
                        </div>
                    )}

                    {itensSelecionados.length > 0 && (
                        <div
                            className={`text-sm border-round p-3 mb-3 ${selecaoFornecedorValida ? 'text-green-700' : 'text-orange-700'}`}
                            style={{
                                backgroundColor: selecaoFornecedorValida ? '#f0fdf4' : '#fff7ed',
                                border: `1px solid ${selecaoFornecedorValida ? '#bbf7d0' : '#fed7aa'}`
                            }}
                        >
                            <i className={`pi ${selecaoFornecedorValida ? 'pi-check-circle' : 'pi-exclamation-triangle'} mr-2`} />
                            {selecaoFornecedorValida
                                ? `Fornecedor do pedido: ${fornecedorDoPedido?.nomeCompleto}`
                                : mensagemFornecedorDaSelecao()}
                        </div>
                    )}

                    {/* Lista de itens estilo gestão de acessos */}
                    {loadingProdutos ? (
                        <div className="flex justify-content-center align-items-center py-5">
                            <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem', color: COR_ITEM }} />
                            <span className="ml-3 text-color-secondary">Carregando produtos...</span>
                        </div>
                    ) : itenslista.length === 0 ? (
                        <div className="flex flex-column align-items-center justify-content-center py-5 text-color-secondary">
                            <i className="pi pi-check-circle mb-2" style={{ fontSize: '2rem', color: '#10b981' }} />
                            <span>
                                {fornecedorSelecionado
                                    ? 'Nenhum produto vinculado a este fornecedor'
                                    : 'Nenhum produto cadastrado'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-column gap-3 mb-4">
                            {itensPaginados.map((item, indiceNaPagina) => {
                                const idx = primeiroProduto + indiceNaPagina;
                                return (
                                    <div
                                    key={item.produto_id}
                                    className="flex flex-column md:flex-row md:align-items-center gap-3 p-3 md:p-4 border-round"
                                    style={{
                                        border: `1px solid ${item.selecionado ? COR_ITEM + '40' : '#dee2e6'}`,
                                        background: item.selecionado ? COR_ITEM + '08' : 'transparent',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => toggleItem(idx)}
                                >
                                    <div className="flex align-items-start gap-3 flex-1 min-w-0 w-full">
                                        {/* Checkbox estilizado */}
                                        <div style={{
                                            width: 20, height: 20, minWidth: 20,
                                            border: `2px solid ${item.selecionado ? COR_ITEM : '#ced4da'}`,
                                            borderRadius: 4,
                                            backgroundColor: item.selecionado ? COR_ITEM : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            flexShrink: 0,
                                            marginTop: 2,
                                        }}>
                                            {item.selecionado && (
                                                <i className="pi pi-check" style={{ color: 'white', fontSize: 10 }} />
                                            )}
                                        </div>

                                        {/* Info do produto */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold white-space-nowrap overflow-hidden text-overflow-ellipsis">
                                                {item.nome}
                                            </div>
                                            <div className="flex align-items-center gap-2 mt-1 flex-wrap">
                                                {item.codigo && (
                                                    <span className="text-xs text-color-secondary">{item.codigo}</span>
                                                )}
                                                {!item.fornecedor_id && (
                                                    <Tag value="Sem fornecedor" severity="secondary" />
                                                )}
                                                <Tag
                                                    value={`Atual: ${fmtQtd(item.estoque_atual, item.unidade_medida)}`}
                                                    severity={item.estoque_atual === 0 ? 'danger' : 'warning'}
                                                />
                                                <span className="text-xs text-color-secondary">
                                                    Mín: {fmtQtd(item.estoque_minimo, item.unidade_medida)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Qtd. a pedir */}
                                    <div
                                        className="flex align-items-center justify-content-between md:justify-content-start gap-3 flex-shrink-0 w-full md:w-auto"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <span className="text-sm text-color-secondary white-space-nowrap">Qtd. pedir:</span>
                                        <InputNumber
                                            value={item.quantidade}
                                            onValueChange={e => alterarQtd(idx, e.value ?? 0.001)}
                                            min={['UN','CX','PC','DZ','CT'].includes((item.unidade_medida||'').toUpperCase()) ? 1 : 0.001}
                                            step={['UN','CX','PC','DZ','CT'].includes((item.unidade_medida||'').toUpperCase()) ? 1 : 0.001}
                                            minFractionDigits={0}
                                            maxFractionDigits={['UN','CX','PC','DZ','CT'].includes((item.unidade_medida||'').toUpperCase()) ? 0 : 3}
                                            disabled={!item.selecionado}
                                            inputStyle={{ width: '74px' }}
                                        />
                                    </div>

                                    {/* Preço e subtotal */}
                                    <div
                                        className="text-left md:text-right flex-shrink-0 w-full md:w-auto"
                                        style={{ minWidth: '110px' }}
                                    >
                                        {item.preco_compra > 0 ? (
                                            <>
                                                <div className="text-xs text-color-secondary">
                                                    {fmtMoeda(item.preco_compra)}/un
                                                </div>
                                                <div className={`font-semibold ${item.selecionado ? '' : 'text-color-secondary'}`}>
                                                    {item.selecionado
                                                        ? fmtMoeda(item.quantidade * item.preco_compra)
                                                        : '—'}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-xs text-color-secondary">Sem preço</span>
                                        )}
                                    </div>

                                    {/* Remover */}
                                    <Button
                                        icon="pi pi-times"
                                        text
                                        severity="danger"
                                        size="small"
                                        tooltip="Remover da lista"
                                        tooltipOptions={{ position: 'top' }}
                                        onClick={e => { e.stopPropagation(); removerItem(idx); }}
                                        className="align-self-end md:align-self-center"
                                        style={{ flexShrink: 0 }}
                                    />
                                    </div>
                                );
                            })}
                            {itenslista.length > 5 && (
                                <Paginator
                                    first={primeiroProduto}
                                    rows={produtosPorPagina}
                                    totalRecords={itenslista.length}
                                    rowsPerPageOptions={[5, 10, 20]}
                                    onPageChange={e => {
                                        setPrimeiroProduto(e.first);
                                        setProdutosPorPagina(e.rows);
                                    }}
                                    template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
                                    className="surface-50 border-round mt-2"
                                />
                            )}
                        </div>
                    )}

                    {/* Busca rápida de produto */}
                    <Divider align="left">
                        <span className="text-sm font-medium text-color-secondary">Localizar e selecionar produto</span>
                    </Divider>

                    <div className="surface-50 border-round p-3 md:p-4 mb-4">
                        <div className="grid formgrid align-items-end">
                            <div className="col-12 lg:col-6 field mb-3 lg:mb-0">
                                <label className="block font-medium mb-2">Produto / Código do produto</label>
                                <AutoComplete
                                    value={produtoExtra ?? queryProduto}
                                    suggestions={sugestoes}
                                    completeMethod={e => buscarSugestoes(e.query)}
                                    field="name"
                                    itemTemplate={itemTemplateProduto}
                                    onChange={e => {
                                        if (typeof e.value === 'string') {
                                            setQueryProduto(e.value);
                                            setProdutoExtra(null);
                                        }
                                    }}
                                    onSelect={e => { setProdutoExtra(e.value); setQueryProduto(e.value.name); }}
                                    onClear={() => { setProdutoExtra(null); setQueryProduto(''); }}
                                    placeholder="Digite para buscar ou abra a lista"
                                    className="w-full"
                                    inputClassName="w-full"
                                    dropdown
                                    forceSelection
                                    delay={200}
                                />
                                <small className={`block mt-2 ${queryProduto && !produtoExtra ? 'text-orange-600' : 'text-color-secondary'}`}>
                                    {produtoExtra
                                        ? `Selecionado: ${produtoExtra.name}. Informe a quantidade e confirme.`
                                        : queryProduto
                                            ? 'Escolha uma opção da lista para habilitar o botão.'
                                            : 'Pesquise pelo nome ou pelo código e selecione uma opção.'}
                                </small>
                            </div>
                            <div className="col-12 sm:col-5 lg:col-2 field mb-3 lg:mb-0">
                                <label className="block font-medium mb-2">Quantidade</label>
                                <InputNumber
                                    className="w-full"
                                    inputClassName="w-full"
                                    inputStyle={{ minWidth: 0 }}
                                    value={qtdExtra}
                                    onValueChange={e => setQtdExtra(e.value || 1)}
                                    min={1}
                                />
                            </div>
                            <div className="col-12 sm:col-7 lg:col-4 field mb-0">
                                <Button
                                    label="Selecionar na lista"
                                    icon="pi pi-check"
                                    className="w-full"
                                    onClick={adicionarProdutoExtra}
                                    disabled={!produtoExtra}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Rodapé: total e ações */}
                    <div className="flex flex-column lg:flex-row justify-content-between lg:align-items-center p-3 md:p-4 border-round surface-100 gap-4">
                        <div className="flex align-items-center gap-3 md:gap-4 flex-wrap">
                            <div>
                                <div className="text-xs text-color-secondary mb-1">Itens selecionados</div>
                                <div className="text-2xl font-bold">{itensSelecionados.length}</div>
                            </div>
                            <Divider layout="vertical" className="hidden md:block" />
                            <div>
                                <div className="text-xs text-color-secondary mb-1">Total estimado de compra</div>
                                <div className="text-2xl font-bold" style={{ color: COR_ITEM }}>
                                    {fmtMoeda(totalEstimado)}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full lg:w-auto">
                            <Button
                                label="Gerar PDF"
                                icon="pi pi-file-pdf"
                                severity="secondary"
                                outlined
                                onClick={gerarPDF}
                                disabled={!selecaoFornecedorValida}
                                className="flex-1 lg:flex-none"
                            />
                            <Button
                                label="Salvar Pedido"
                                icon="pi pi-save"
                                disabled={!selecaoFornecedorValida}
                                className="flex-1 lg:flex-none"
                                onClick={() => {
                                    if (itensSelecionados.length === 0) return showError('Selecione pelo menos um produto');
                                    setSalvarDialog(true);
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Histórico de Pedidos ── */}
            <div className="col-12">
                <div className="card">
                    <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-3 mb-4">
                        <div>
                            <h5 className="m-0 mb-1">Acompanhamento de Pedidos</h5>
                            <span className="text-sm text-color-secondary">
                                Consulte todos os pedidos ou acompanhe somente os valores pendentes.
                            </span>
                        </div>
                        <div
                            className="flex gap-1 surface-100 border-round p-1 w-full md:w-auto"
                            role="tablist"
                            aria-label="Visualização dos pedidos"
                        >
                            <Button
                                label="Pedidos"
                                icon="pi pi-list"
                                size="small"
                                severity={abaHistorico === 0 ? undefined : 'secondary'}
                                text={abaHistorico !== 0}
                                className="flex-1 md:flex-none"
                                aria-pressed={abaHistorico === 0}
                                onClick={() => setAbaHistorico(0)}
                            />
                            <Button
                                label={`Dívidas (${pedidosDividas.length})`}
                                icon="pi pi-wallet"
                                size="small"
                                severity={abaHistorico === 1 ? 'warning' : 'secondary'}
                                text={abaHistorico !== 1}
                                className="flex-1 md:flex-none"
                                aria-pressed={abaHistorico === 1}
                                onClick={() => {
                                    setAbaHistorico(1);
                                    fetchDividas();
                                }}
                            />
                        </div>
                    </div>

                    {abaHistorico === 0 ? (
                        <div role="tabpanel" aria-label="Pedidos">
                            <div className="flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
                                <div className="flex gap-2 flex-wrap">
                                    {([null, ...statusOptions] as any[]).map((opt: any, i: number) => (
                                        <Button
                                            key={i}
                                            label={opt ? opt.label : 'Todos'}
                                            size="small"
                                            outlined={filtroStatus !== (opt ? opt.value : null)}
                                            onClick={() => setFiltroStatus(opt ? opt.value : null)}
                                        />
                                    ))}
                                </div>
                                <Button
                                    label={somentePendentes ? 'Exibindo somente com saldo' : 'Somente com saldo pendente'}
                                    icon={somentePendentes ? 'pi pi-filter-fill' : 'pi pi-filter'}
                                    severity="warning"
                                    outlined={!somentePendentes}
                                    size="small"
                                    onClick={() => setSomentePendentes(valor => !valor)}
                                />
                            </div>

                            {tabelaPedidos(
                                pedidos,
                                loadingPedidos,
                                somentePendentes ? 'Nenhum pedido com saldo pendente' : 'Nenhum pedido encontrado'
                            )}
                        </div>
                    ) : (
                        <div role="tabpanel" aria-label="Dívidas">
                            <div className="grid mb-2">
                                <div className="col-12 md:col-4">
                                    <div
                                        className="surface-50 border-round p-3 h-full"
                                        style={{ border: '1px solid var(--surface-border)' }}
                                    >
                                        <div className="flex align-items-center gap-2 mb-2">
                                            <i className="pi pi-file text-color-secondary" />
                                            <span className="text-sm text-color-secondary">Pedidos com saldo</span>
                                        </div>
                                        <div className="text-2xl font-bold">{pedidosDividas.length}</div>
                                    </div>
                                </div>
                                <div className="col-12 md:col-4">
                                    <div
                                        className="surface-50 border-round p-3 h-full"
                                        style={{ border: '1px solid var(--surface-border)' }}
                                    >
                                        <div className="flex align-items-center gap-2 mb-2">
                                            <i className="pi pi-wallet text-orange-600" />
                                            <span className="text-sm text-color-secondary">Total pendente</span>
                                        </div>
                                        <div className="text-2xl font-bold text-orange-600">{fmtMoeda(totalDividas)}</div>
                                    </div>
                                </div>
                                <div className="col-12 md:col-4">
                                    <div className="flex flex-column justify-content-center gap-2 h-full">
                                        <Button
                                            label="Voltar para pedidos"
                                            icon="pi pi-arrow-left"
                                            severity="secondary"
                                            outlined
                                            className="w-full"
                                            onClick={() => setAbaHistorico(0)}
                                        />
                                        <Button
                                            label="Atualizar dívidas"
                                            icon="pi pi-refresh"
                                            severity="secondary"
                                            outlined
                                            className="w-full"
                                            loading={loadingDividas}
                                            onClick={fetchDividas}
                                        />
                                    </div>
                                </div>
                            </div>

                            {tabelaPedidos(pedidosDividas, loadingDividas, 'Nenhuma dívida pendente')}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Dialog: Salvar Pedido ── */}
            <Dialog
                header="Salvar Pedido"
                visible={salvarDialog}
                style={{ width: '90vw', maxWidth: '520px' }}
                breakpoints={{ '640px': '95vw' }}
                modal
                onHide={() => setSalvarDialog(false)}
                footer={
                    <div className="flex gap-2 justify-content-end">
                        <Button label="Cancelar" icon="pi pi-times" className="p-button-text" onClick={() => setSalvarDialog(false)} />
                        <Button label="Salvar Pedido" icon="pi pi-check" onClick={salvarPedido} />
                    </div>
                }
            >
                <div className="grid formgrid">
                    <div className="col-12 field">
                        <label>Fornecedor</label>
                        <div className="surface-100 border-round p-3 font-semibold">
                            {fornecedorDoPedido?.nomeCompleto || '—'}
                        </div>
                    </div>
                    <div className="col-12 md:col-6 field">
                        <label>Status</label>
                        <Dropdown
                            className="w-full"
                            options={statusOptions}
                            value={formSalvar.status}
                            onChange={e => setFormSalvar(p => ({ ...p, status: e.value }))}
                        />
                    </div>
                    <div className="col-12 md:col-6 field">
                        <label>Previsão de Entrega</label>
                        <Calendar
                            className="w-full"
                            value={formSalvar.data_previsao}
                            onChange={e => setFormSalvar(p => ({ ...p, data_previsao: e.value as Date }))}
                            dateFormat="dd/mm/yy"
                            showIcon
                        />
                    </div>
                    <div className="col-12 field">
                        <label>Observação</label>
                        <InputTextarea
                            className="w-full"
                            rows={3}
                            value={formSalvar.observacao}
                            onChange={e => setFormSalvar(p => ({ ...p, observacao: e.target.value }))}
                            placeholder="Observações sobre o pedido..."
                        />
                    </div>
                    <div className="col-12">
                        <div className="surface-100 border-round p-3">
                            <p className="m-0 text-sm text-color-secondary">Resumo</p>
                            <p className="m-0 mt-1 font-medium">
                                {itensSelecionados.length} produto(s) &nbsp;·&nbsp; Total estimado: {fmtMoeda(totalEstimado)}
                            </p>
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* ── Dialog: Registrar Pagamento ── */}
            <Dialog
                header={`Registrar pagamento — ${pedidoPagamento?.numero ?? ''}`}
                visible={pagamentoDialog}
                style={{ width: '90vw', maxWidth: '540px' }}
                breakpoints={{ '640px': '95vw' }}
                modal
                closable={!salvandoPagamento}
                onHide={() => {
                    if (salvandoPagamento) return;
                    setPagamentoDialog(false);
                    setPedidoPagamento(null);
                }}
                footer={
                    <div className="flex gap-2 justify-content-end">
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            disabled={salvandoPagamento}
                            onClick={() => {
                                setPagamentoDialog(false);
                                setPedidoPagamento(null);
                            }}
                        />
                        <Button
                            label="Registrar Pagamento"
                            icon="pi pi-check"
                            severity="success"
                            loading={salvandoPagamento}
                            disabled={!formPagamento.valor || formPagamento.valor <= 0}
                            onClick={registrarPagamento}
                        />
                    </div>
                }
            >
                {pedidoPagamento && (
                    <div className="grid formgrid">
                        <div className="col-12">
                            <div className="surface-100 border-round p-3 mb-3">
                                <div className="font-semibold mb-2">{pedidoPagamento.fornecedor}</div>
                                <div className="grid">
                                    <div className="col-4">
                                        <div className="text-xs text-color-secondary">Total</div>
                                        <div className="font-semibold mt-1">{fmtMoeda(pedidoPagamento.valor_total || 0)}</div>
                                    </div>
                                    <div className="col-4">
                                        <div className="text-xs text-color-secondary">Pago</div>
                                        <div className="font-semibold mt-1">{fmtMoeda(pedidoPagamento.valor_pago || 0)}</div>
                                    </div>
                                    <div className="col-4">
                                        <div className="text-xs text-color-secondary">Saldo</div>
                                        <div className="font-semibold mt-1 text-orange-600">
                                            {fmtMoeda(pedidoPagamento.saldo_pendente || 0)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 md:col-6 field">
                            <label>Valor do pagamento <span style={{ color: 'red' }}>*</span></label>
                            <InputNumber
                                className="w-full"
                                value={formPagamento.valor}
                                onValueChange={e => setFormPagamento(form => ({ ...form, valor: e.value ?? null }))}
                                mode="currency"
                                currency="BRL"
                                locale="pt-BR"
                                min={0.01}
                                max={Number(pedidoPagamento.saldo_pendente) || undefined}
                                minFractionDigits={2}
                                maxFractionDigits={2}
                                placeholder="R$ 0,00"
                            />
                            <small className="text-color-secondary">
                                Máximo: {fmtMoeda(pedidoPagamento.saldo_pendente || 0)}
                            </small>
                        </div>
                        <div className="col-12 md:col-6 field">
                            <label>Data do pagamento <span style={{ color: 'red' }}>*</span></label>
                            <Calendar
                                className="w-full"
                                value={formPagamento.data_pagamento}
                                onChange={e => {
                                    if (e.value instanceof Date) {
                                        setFormPagamento(form => ({ ...form, data_pagamento: e.value as Date }));
                                    }
                                }}
                                dateFormat="dd/mm/yy"
                                showIcon
                            />
                        </div>
                        <div className="col-12 field">
                            <label>Observação</label>
                            <InputTextarea
                                className="w-full"
                                rows={3}
                                value={formPagamento.observacao}
                                onChange={e => setFormPagamento(form => ({ ...form, observacao: e.target.value }))}
                                placeholder="Informações opcionais sobre o pagamento..."
                            />
                        </div>
                    </div>
                )}
            </Dialog>

            {/* ── Dialog: Detalhes do Pedido ── */}
            <Dialog
                header={`Pedido ${pedidoDetalhe?.numero ?? ''}`}
                visible={detalheDialog}
                style={{ width: '90vw', maxWidth: '640px' }}
                breakpoints={{ '640px': '95vw' }}
                modal
                onHide={() => setDetalheDialog(false)}
                footer={
                    <div className="flex justify-content-end gap-2">
                        {podeRegistrarPagamento(pedidoDetalhe) && (
                            <Button
                                label="Registrar pagamento"
                                icon="pi pi-dollar"
                                severity="success"
                                onClick={() => abrirPagamento(pedidoDetalhe!)}
                            />
                        )}
                        <Button label="Fechar" icon="pi pi-times" className="p-button-text" onClick={() => setDetalheDialog(false)} />
                    </div>
                }
            >
                {pedidoDetalhe && (
                    <div className="grid">
                        <div className="col-12 md:col-6">
                            <span className="text-color-secondary text-sm">Fornecedor</span>
                            <div className="font-semibold mt-1">{pedidoDetalhe.fornecedor || '—'}</div>
                        </div>
                        <div className="col-12 md:col-6">
                            <span className="text-color-secondary text-sm">Status</span>
                            <div className="mt-1">
                                <Tag
                                    value={statusLabel[pedidoDetalhe.status as Status]}
                                    severity={statusSeverity[pedidoDetalhe.status as Status]}
                                />
                            </div>
                        </div>
                        <div className="col-12 md:col-6">
                            <span className="text-color-secondary text-sm">Data do Pedido</span>
                            <div className="font-semibold mt-1">{fmtData(pedidoDetalhe.data_pedido)}</div>
                        </div>
                        <div className="col-12 md:col-6">
                            <span className="text-color-secondary text-sm">Previsão de Entrega</span>
                            <div className="font-semibold mt-1">{fmtData(pedidoDetalhe.data_previsao)}</div>
                        </div>
                        <div className="col-12">
                            {pedidoDetalhe.controle_financeiro_ativo === true ? (
                                <div className="surface-100 border-round p-3 mt-2">
                                    <div className="flex justify-content-between align-items-center mb-3">
                                        <span className="font-semibold">Resumo financeiro</span>
                                        {statusFinanceiroTemplate(pedidoDetalhe)}
                                    </div>
                                    <div className="grid">
                                        <div className="col-12 md:col-4">
                                            <div className="text-xs text-color-secondary">Valor total</div>
                                            <div className="font-semibold mt-1">{fmtMoeda(pedidoDetalhe.valor_total || 0)}</div>
                                        </div>
                                        <div className="col-12 md:col-4">
                                            <div className="text-xs text-color-secondary">Valor pago</div>
                                            <div className="font-semibold mt-1">{fmtMoeda(pedidoDetalhe.valor_pago || 0)}</div>
                                        </div>
                                        <div className="col-12 md:col-4">
                                            <div className="text-xs text-color-secondary">Saldo pendente</div>
                                            <div className="font-semibold mt-1 text-orange-600">
                                                {fmtMoeda(pedidoDetalhe.saldo_pendente || 0)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="surface-100 border-round p-3 mt-2 text-color-secondary">
                                    <i className="pi pi-info-circle mr-2" />
                                    Pedido anterior ao controle financeiro. Nenhum saldo foi presumido.
                                </div>
                            )}
                        </div>
                        {pedidoDetalhe.observacao && (
                            <div className="col-12">
                                <span className="text-color-secondary text-sm">Observação</span>
                                <div className="mt-1">{pedidoDetalhe.observacao}</div>
                            </div>
                        )}
                        <Divider className="col-12" />
                        <div className="col-12">
                            <DataTable value={pedidoDetalhe.itens || []} size="small" tableStyle={{ minWidth: '30rem' }}>
                                <Column field="produto"    header="Produto" />
                                <Column field="quantidade" header="Qtd." style={{ width: '6rem' }} />
                                <Column header="Unit."    body={(row) => fmtMoeda(row.valor_unitario)}                  style={{ width: '9rem' }} />
                                <Column header="Subtotal" body={(row) => fmtMoeda(row.quantidade * row.valor_unitario)} style={{ width: '9rem' }} />
                            </DataTable>
                            <div className="flex justify-content-end mt-3">
                                <span className="text-lg font-bold">Total: {fmtMoeda(pedidoDetalhe.valor_total || 0)}</span>
                            </div>
                        </div>
                        {pedidoDetalhe.controle_financeiro_ativo === true && (
                            <>
                                <Divider className="col-12" />
                                <div className="col-12">
                                    <div className="flex justify-content-between align-items-center mb-3">
                                        <span className="font-semibold">Histórico de pagamentos</span>
                                        <span className="text-sm text-color-secondary">
                                            {pagamentosDetalhe.length} pagamento(s)
                                        </span>
                                    </div>
                                    <DataTable
                                        value={pagamentosDetalhe}
                                        loading={loadingPagamentos}
                                        size="small"
                                        emptyMessage="Nenhum pagamento registrado"
                                        tableStyle={{ minWidth: '30rem' }}
                                    >
                                        <Column
                                            field="data_pagamento"
                                            header="Data"
                                            body={(row) => fmtData(row.data_pagamento)}
                                            style={{ width: '8rem' }}
                                        />
                                        <Column
                                            field="valor"
                                            header="Valor"
                                            body={(row) => fmtMoeda(row.valor)}
                                            style={{ width: '9rem' }}
                                        />
                                        <Column
                                            field="observacao"
                                            header="Observação"
                                            body={(row) => row.observacao || '—'}
                                        />
                                    </DataTable>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default PedidosPage;
