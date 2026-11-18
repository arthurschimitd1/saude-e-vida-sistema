'use client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const navigator: Navigator & { serial: any };
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from '@/app/(main)/components/MobileFriendlyInputNumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { Password } from 'primereact/password';
import { Checkbox } from 'primereact/checkbox';
import { SelectButton } from 'primereact/selectbutton';
import { Divider } from 'primereact/divider';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { useRef, useState, useEffect } from 'react';
import { focusFiscalService } from '../../services/api/focusFiscalService';
import { financeiroService } from '../../services/api/financeiroService';
import { useRouter } from 'next/navigation';
import api from '../../services/api/baseApi';
import { lojaOnlineService } from '../../services/api/lojaOnlineService';
import { criarCodigoEtiquetaRoupa, lerCodigoEtiquetaRoupa } from '../estoque-roupas/codigoEtiquetaRoupa';
import { prepararHistorico, normalizarSaidasServidor } from './historicoCaixa';
import { encontrarFuncionarioLogado, normalizarFuncionariosCaixa, precisaAutenticarFuncionario } from './funcionarioCaixa';
import { obterFotoRoupaCaixa } from './fotoRoupaCaixa';
import { limitesQuantidadeRoupa } from './quantidadeRoupa';
import MiniaturaRoupaCaixa from './MiniaturaRoupaCaixa';
import ResumoSaidasTurno from './ResumoSaidasTurno';

// ===========================================
// INTERFACES
// ===========================================
interface Funcionario {
    id: number;
    nome: string;
    email: string;
    comissao_tipo?: 'percent' | 'valor' | null;
    comissao_valor?: number | null;
}
interface Produto {
    id: number;
    nome: string;
    valor: number;
    unit_type?: 'kg' | 'unit' | string;
    price_per_kg?: number;
    unit?: string;
    sku?: string;
    codigo_barras?: string;
    currentQuantity?: number | string;
    estoque?: number | string;
}
interface ServicoAgenda {
    id: string;
    nome: string;
    preco: number;
    duracaoMin?: number;
}
interface ServicoCaixa {
    key: string;
    id: number | string;
    name: string;
    value: number;
    origem: 'fiscal' | 'agenda' | 'manual';
}
interface VariacaoRoupaCaixa {
    id: number;
    cor?: string | null;
    tamanho: string;
    quantidade_atual: number;
    estoque_infinito: boolean;
}
interface RoupaCaixa {
    id: number;
    nome: string;
    preco_venda: number;
    codigo?: string | null;
    foto_url?: string | null;
    variacoes: VariacaoRoupaCaixa[];
}
interface ItemVenda {
    id: number;
    nome: string;
    valor: number;
    quantidade: number;
    is_weight_product?: boolean;
    weight_kg?: number;
    unit?: string;
    unit_type?: string;
    currentQuantity?: number;
    editablePrice?: boolean;
    valorTotalFixo?: number;
    tipo?: 'produto' | 'servico' | 'roupa';
    roupa_id?: number;
    variacao_id?: number;
    agendamentoId?: number;
    servicoId?: string;
    servicoAgendaCatalogoId?: string;
    catalogoServicoId?: number;
    origemServico?: 'caixa';
    recorrenciaInclusa?: boolean;
}
interface Cliente { id: number; nomeCompleto: string; telefone?: string; cpf?: string; cnpj?: string; rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; cep?: string; }

interface PagamentoItem {
    uid: number;
    forma: 'PIX' | 'DINHEIRO' | 'CARTAO';
    valor: number;
    tipoCartao?: 'credito' | 'debito';
    bandeira?: 'mastercard' | 'visa' | 'elo' | 'amex' | 'hipercard';
    parcelas?: number;
    valorRecebido?: number;
}

interface ItemNotaFiscal {
    id: number;
    produto_id: number | null;
    nome: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
}

interface Venda {
    id?: number;
    funcionario: Funcionario | null;
    cliente: Cliente | null;
    produtos: ItemVenda[];
    dataVenda: Date | null;
    desconto: number | null;
    tipoDesconto: 'valor' | 'percent';
    cupomCodigo: string;
    cupomId: number | null;
    temEntrega: boolean;
    taxaEntrega: number | null;
    enderecoEntrega: string;
    observacao: string;
    cfop: string;
    cstCsosn: string;
    pagamentos: PagamentoItem[];
    comNota: boolean;
    valorTotal: number;
}

interface Saida {
    id?: number;
    tipo: string;
    cliente: Cliente | null;
    descricao: string;
    data: Date | null;
    valor: number | null;
    forma_pagamento: string | null;
    turno_id: number | null;
}

type HistoricoItem =
    | (Venda & { _kind: 'venda'; criadoEm: string })
    | (Saida & { _kind: 'saida'; criadoEm: string });

type FormatoRecibo = 'pdf' | '80mm' | '58mm' | '120mm';

const formatosRecibo: { label: string; value: FormatoRecibo }[] = [
    { label: 'PDF A4', value: 'pdf' },
    { label: 'Bobina 80 mm (40 m de comprimento)', value: '80mm' },
    { label: 'Epson 58 × 297 mm', value: '58mm' },
    { label: '120 mm', value: '120mm' },
];

const SAIDAS_KEY = 'saudevida_caixa_saidas';
const arredondarMoeda = (valor: number | null | undefined) => {
    const numero = Number(valor ?? 0);
    if (!Number.isFinite(numero)) return 0;
    return Math.round((numero + Math.sign(numero) * Number.EPSILON) * 100) / 100;
};

const calcularTotalItem = (item: ItemVenda) => {
    if (item.valorTotalFixo != null) return arredondarMoeda(item.valorTotalFixo);
    return Number(item.valor) * Number(item.quantidade);
};

type TurnoCaixa = {
    id: number;
    func_abertura_nome: string;
    func_abertura_id: number;
    valor_abertura: number;
    data_abertura: string;
    func_fechamento_nome?: string;
    func_fechamento_id?: number;
    valor_fechamento?: number;
    data_fechamento?: string;
    status: 'aberto' | 'fechado';
    empresa_id?: number | null;
};

const formaPagamentoOptions = [
    { label: 'PIX', value: 'PIX' },
    { label: 'Dinheiro', value: 'DINHEIRO' },
    { label: 'Cartão', value: 'CARTAO' },
];
const tipoDescontoOptions = [
    { label: 'R$', value: 'valor' },
    { label: '%', value: 'percent' },
];
const tipoCartaoOptions = [
    { label: 'Crédito', value: 'credito' },
    { label: 'Débito', value: 'debito' },
];
const bandeiraCartaoOptions = [
    { label: 'Mastercard', value: 'mastercard' },
    { label: 'Visa', value: 'visa' },
    { label: 'Elo', value: 'elo' },
    { label: 'American Express', value: 'amex' },
    { label: 'Hipercard', value: 'hipercard' },
];

const normalizarPagamentosVenda = (venda: any): PagamentoItem[] => {
    const pagamentos = Array.isArray(venda?.pagamentos) ? venda.pagamentos : [];
    if (pagamentos.length > 0) {
        return pagamentos.map((pagamento: any, indice: number) => ({
            ...pagamento,
            uid: Number(pagamento.uid) || Number(venda?.id || Date.now()) * 100 + indice,
        }));
    }
    if (!venda?.forma_pagamento) return [];
    return [{
        uid: Number(venda?.id || Date.now()) * 100,
        forma: venda.forma_pagamento,
        valor: Number(venda.valor_total || 0),
        tipoCartao: venda.tipo_cartao ?? undefined,
        parcelas: Number(venda.parcelas || 1),
    }];
};

const initialVenda = (): Venda => ({
    funcionario: null, cliente: null, produtos: [], dataVenda: new Date(),
    desconto: null, tipoDesconto: 'valor', cupomCodigo: '', cupomId: null, temEntrega: false, taxaEntrega: null, enderecoEntrega: '', observacao: '', cfop: '', cstCsosn: '',
    pagamentos: [], comNota: false, valorTotal: 0,
});
const initialSaida = (): Saida => ({
    tipo: '', cliente: null, descricao: '', data: new Date(), valor: null,
    forma_pagamento: null, turno_id: null,
});

const carregarDadosEmpresaRecibo = async (empresaId: number) => {
    const [cadastroDetalhado, empresaAcesso] = await Promise.allSettled([
        api.get('/minha-empresa', { params: { empresa_id: empresaId } }),
        api.get(`/empresas/${empresaId}`),
    ]);
    const respostaDetalhada = cadastroDetalhado.status === 'fulfilled' ? cadastroDetalhado.value.data : null;
    const detalhes = (Array.isArray(respostaDetalhada) ? respostaDetalhada[0] : respostaDetalhada) ?? {};
    const empresa = empresaAcesso.status === 'fulfilled' ? empresaAcesso.value.data : null;
    const nomeGenerico = (nome?: string | null) => !nome?.trim() || ['minha empresa', 'empresa'].includes(nome.trim().toLowerCase());
    const nomeDetalhado = !nomeGenerico(detalhes.nome_fantasia)
        ? detalhes.nome_fantasia
        : (!nomeGenerico(detalhes.razao_social) ? detalhes.razao_social : null);
    const cnpjDigitos = String(empresa?.cnpj || detalhes.cnpj || '').replace(/\D/g, '').slice(0, 14);
    const cnpjFormatado = cnpjDigitos.length === 14
        ? cnpjDigitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
        : cnpjDigitos;

    return {
        ...detalhes,
        nome_exibicao: nomeDetalhado || empresa?.nome || detalhes.nome_fantasia || detalhes.razao_social || '',
        cnpj: cnpjFormatado,
        logradouro: detalhes.logradouro || empresa?.endereco?.rua || '',
        numero: detalhes.numero || empresa?.endereco?.numero || '',
        bairro: detalhes.bairro || empresa?.endereco?.bairro || '',
        municipio: detalhes.municipio || empresa?.endereco?.cidade || '',
        uf: detalhes.uf || empresa?.endereco?.estado || '',
        cep: detalhes.cep || empresa?.endereco?.cep || '',
        complemento: detalhes.complemento || empresa?.endereco?.pontoReferencia || '',
    };
};

// ===========================================
// COMPONENTE PRINCIPAL
// ===========================================
const CaixaPage = () => {
    const toast = useRef<Toast>(null);
    const router = useRouter();

    // Estados principais
    const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
    const [produtosDisponiveis, setProdutosDisponiveis] = useState<Produto[]>([]);
    const [roupasDisponiveis, setRoupasDisponiveis] = useState<RoupaCaixa[]>([]);
    const [carregandoRoupasCaixa, setCarregandoRoupasCaixa] = useState(true);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [clientesCarregados, setClientesCarregados] = useState(false);
    const [funcionariosCarregados, setFuncionariosCarregados] = useState(false);

    const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
    const [roupaSelecionada, setRoupaSelecionada] = useState<RoupaCaixa | null>(null);
    const [variacaoRoupaSelecionada, setVariacaoRoupaSelecionada] = useState<VariacaoRoupaCaixa | null>(null);
    const [roupaVariacaoDialog, setRoupaVariacaoDialog] = useState(false);
    const [qtdRoupaSelecionada, setQtdRoupaSelecionada] = useState(1);
    const [servicosDisponiveis, setServicosDisponiveis] = useState<ServicoAgenda[]>([]);
    const [servicoSelecionado, setServicoSelecionado] = useState<ServicoAgenda | null>(null);
    const [servicosCaixa, setServicosCaixa] = useState<ServicoCaixa[]>([]);
    const [servicoCaixaSelecionado, setServicoCaixaSelecionado] = useState<ServicoCaixa | null>(null);
    const [carregandoServicosCaixa, setCarregandoServicosCaixa] = useState(false);
    const [agendamentoEdicaoId, setAgendamentoEdicaoId] = useState<number | null>(null);
    const [carregandoServicos, setCarregandoServicos] = useState(false);
    const [filtroProdutoDropdown, setFiltroProdutoDropdown] = useState<string>('');
    const [qtdSelecionada, setQtdSelecionada] = useState<number>(1);
    const [skuInput, setSkuInput] = useState<string>('');
    const skuInputRef = useRef<HTMLInputElement>(null);
    const codigoEtiquetaPendenteRef = useRef<string | null>(null);
    const qtdInputRef = useRef<HTMLInputElement>(null);

    const [venda, setVenda] = useState<Venda>(initialVenda);
    const [editingVendaId, setEditingVendaId] = useState<number | null>(null);
    const originalProdutosRef = useRef<ItemVenda[]>([]);

    const [senhaDialog, setSenhaDialog] = useState(false);
    const [senhaInput, setSenhaInput] = useState('');
    const [senhaCarregando, setSenhaCarregando] = useState(false);
    const [funcionarioPendente, setFuncionarioPendente] = useState<Funcionario | null>(null);
    // O caixa não exige mais a senha do funcionário para selecionar/vincular
    // o atendente ou concluir a venda.
    const podePularSenha = true;
    const [usuarioLogado, setUsuarioLogado] = useState<{ id?: number; email?: string } | null>(null);
    const [funcionarioAutenticadoId, setFuncionarioAutenticadoId] = useState<number | null>(null);

    const [showReciboDialog, setShowReciboDialog] = useState(false);
    const [confirmandoVenda, setConfirmandoVenda] = useState(false);
    const [aplicandoCupom, setAplicandoCupom] = useState(false);
    const [reciboContent, setReciboContent] = useState('');
    const [vendaConfirmadaId, setVendaConfirmadaId] = useState<number | null>(null);

    const [saidaDialog, setSaidaDialog] = useState(false);
    const [saida, setSaida] = useState<Saida>(initialSaida);
    const [editingSaidaId, setEditingSaidaId] = useState<number | null>(null);
    const [salvandoSaida, setSalvandoSaida] = useState(false);
    const salvandoSaidaRef = useRef(false);

    const [comissaoDialog, setComissaoDialog] = useState(false);
    const [comissaoFuncionarioId, setComissaoFuncionarioId] = useState<number | null>(null);
    const [comissaoTipo, setComissaoTipo] = useState<'percent' | 'valor'>('percent');
    const [comissaoValor, setComissaoValor] = useState<number>(0);
    const [comissaoSalvando, setComissaoSalvando] = useState(false);

    const [historico, setHistorico] = useState<HistoricoItem[]>([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [historicoErro, setHistoricoErro] = useState('');
    const [temSaidasLegadas, setTemSaidasLegadas] = useState(false);
    const historicoRequestRef = useRef(0);
    const [filtroBusca, setFiltroBusca] = useState('');
    const [filtroPeriodo, setFiltroPeriodo] = useState<'hoje' | 'semana' | 'mes' | 'custom' | ''>('');
    const [filtroDataInicio, setFiltroDataInicio] = useState<Date | null>(null);
    const [filtroDataFim, setFiltroDataFim] = useState<Date | null>(null);
    const [empresaId, setEmpresaId] = useState<number | null>(null);
    const [viewItem, setViewItem] = useState<HistoricoItem | null>(null);
    const [viewDialog, setViewDialog] = useState(false);

    const [pendingTransfer, setPendingTransfer] = useState<any>(null);

    const [turnos, setTurnos] = useState<TurnoCaixa[]>([]);
    const turnosAbertos = turnos.filter(t => t.status === 'aberto');
    const caixaAberto = turnosAbertos.length > 0;

    const [aberturaCaixaDialog, setAberturaCaixaDialog] = useState(false);
    const [fechamentoCaixaDialog, setFechamentoCaixaDialog] = useState(false);
    const [turnosDialog, setTurnosDialog] = useState(false);
    const [funcAberturaId, setFuncAberturaId] = useState<number | null>(null);
    const [valAberturaInput, setValAberturaInput] = useState<number | null>(null);
    const [turnoFechamentoId, setTurnoFechamentoId] = useState<number | null>(null);
    const [funcFechamentoId, setFuncFechamentoId] = useState<number | null>(null);
    const [valFechamentoInput, setValFechamentoInput] = useState<number | null>(null);
    const [turnoDetalhe, setTurnoDetalhe] = useState<TurnoCaixa | null>(null);
    const [turnoMovimentos, setTurnoMovimentos] = useState<any>(null);
    const [carregandoMovimentos, setCarregandoMovimentos] = useState(false);

    const [bairros, setBairros] = useState<{ id: number; nome: string; taxa: number }[]>([]);
    const [bairroDialog, setBairroDialog] = useState(false);
    const [novoBairroNome, setNovoBairroNome] = useState('');
    const [novoBairroTaxa, setNovoBairroTaxa] = useState<number | null>(null);
    const [salvandoBairro, setSalvandoBairro] = useState(false);
    const [bairroSelecionado, setBairroSelecionado] = useState<number | null>(null);

    const [configFiscal, setConfigFiscal] = useState<any>(null);
    const [empresaInfo, setEmpresaInfo] = useState<any>(null);
    const [tipoCupom, setTipoCupom] = useState<FormatoRecibo>('58mm');
    const [tipoCupomHistorico, setTipoCupomHistorico] = useState<FormatoRecibo>('58mm');
    const [vendaHistoricoParaImprimir, setVendaHistoricoParaImprimir] = useState<HistoricoItem | null>(null);
    const [carregandoConfigFiscal, setCarregandoConfigFiscal] = useState(true);
    const [tipoNotaFiscal, setTipoNotaFiscal] = useState<'nfce' | 'nfe'>('nfce');
    const [resumoFiscalDialog, setResumoFiscalDialog] = useState(false);
    const [resumoFiscalContent, setResumoFiscalContent] = useState('');

    const [showEmitirNotaDialog, setShowEmitirNotaDialog] = useState(false);
    const [vendaIdParaNota, setVendaIdParaNota] = useState<number | null>(null);
    const [dataVencimentoNota, setDataVencimentoNota] = useState('');
    const [destinatarioIsentoIE, setDestinatarioIsentoIE] = useState(false);
    const [emitindoNota, setEmitindoNota] = useState(false);
    const [itensNotaFiscal, setItensNotaFiscal] = useState<ItemNotaFiscal[]>([]);
    const [modoItensNota, setModoItensNota] = useState<'todos' | 'selecionar'>('todos');
    const [itemIdsNotaSelecionados, setItemIdsNotaSelecionados] = useState<number[]>([]);

    // ===========================================
    // ESTADOS DA BALANÇA
    // ===========================================
    const [scaleConnected, setScaleConnected] = useState(false);
    const [scaleReading, setScaleReading] = useState<number | null>(null);
    const [scalePort, setScalePort] = useState<any>(null);
    const [isReadingScale, setIsReadingScale] = useState(false);
    const [scaleSupported, setScaleSupported] = useState(true);
    const [scaleError, setScaleError] = useState<string | null>(null);
    const [showScaleModal, setShowScaleModal] = useState(false);
    const [pendingWeightProduct, setPendingWeightProduct] = useState<Produto | null>(null);
    const scaleReaderRef = useRef<any>(null);
    const [scaleInputValue, setScaleInputValue] = useState<number | null>(null);
    const [scaleInputByValue, setScaleInputByValue] = useState(true);
    const [scaleValueInput, setScaleValueInput] = useState<number | null>(null);
    const [isWaitingForWeight, setIsWaitingForWeight] = useState(false);
    const continuousReadingRef = useRef<boolean>(false);

    // ===========================================
    // FUNÇÕES DA BALANÇA — PROTOCOLO ENQ (0x05)
    // ===========================================
    const formatarMoeda = (valor: number) => {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const checkWebSerialSupport = () => {
        const supported = 'serial' in navigator;
        setScaleSupported(supported);
        if (!supported) console.warn('Web Serial API não suportada neste navegador');
        return supported;
    };

    const decodeScaleWeight = (data: Uint8Array): number | null => {
        try {
            let startIndex = -1;
            let endIndex   = -1;
            for (let i = 0; i < data.length; i++) {
                if (data[i] === 0x02) startIndex = i;
                if (data[i] === 0x03 && startIndex !== -1) { endIndex = i; break; }
            }
            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex + 1) {
                const weightBytes = data.slice(startIndex + 1, endIndex);
                const weightStr   = new TextDecoder().decode(weightBytes);
                const numericStr  = weightStr.replace(/[^0-9]/g, '');
                if (numericStr.length >= 3) {
                    return parseInt(numericStr) / Math.pow(10, 3);
                }
            }
            return null;
        } catch { return null; }
    };

    const readScaleWeight = async (port: any): Promise<number | null> => {
        try {
            const writer = port.writable.getWriter();
            await writer.write(new Uint8Array([0x05]));
            writer.releaseLock();
            await new Promise(r => setTimeout(r, 300));
            const reader = port.readable.getReader();
            const { value } = await reader.read();
            reader.releaseLock();
            if (value && value.length > 0) {
                const w = decodeScaleWeight(value);
                if (w !== null && w > 0) return w;
            }
            return null;
        } catch { return null; }
    };

    const startContinuousReading = async (port: any) => {
        continuousReadingRef.current = true;
        try {
            const reader = port.readable.getReader();
            scaleReaderRef.current = reader;
            while (continuousReadingRef.current) {
                try {
                    const writer = port.writable.getWriter();
                    await writer.write(new Uint8Array([0x05]));
                    writer.releaseLock();
                    await new Promise(r => setTimeout(r, 200));
                    const { value } = await reader.read();
                    if (value && value.length > 0) {
                        const w = decodeScaleWeight(value);
                        if (w !== null && w > 0) {
                            setScaleReading(w);
                            setScaleInputValue(w);
                        }
                    }
                    await new Promise(r => setTimeout(r, 1000));
                } catch { break; }
            }
        } catch { }
        finally {
            if (scaleReaderRef.current) { scaleReaderRef.current.releaseLock(); scaleReaderRef.current = null; }
        }
    };

    const connectToScale = async () => {
        if (!checkWebSerialSupport()) {
            setScaleError('Seu navegador não suporta conexão direta com balança. Use Chrome/Edge versão 89 ou superior.');
            toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Navegador não suporta conexão com balança', life: 5000 });
            return false;
        }
        try {
            setIsReadingScale(true);
            setScaleError(null);
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
            setScalePort(port);
            setScaleConnected(true);
            startContinuousReading(port);
            const testWeight = await readScaleWeight(port);
            if (testWeight && testWeight > 0) {
                setScaleReading(testWeight);
                setScaleInputValue(testWeight);
                toast.current?.show({ severity: 'success', summary: 'Conectado', detail: `Balança conectada! Peso: ${testWeight.toFixed(3)} kg`, life: 3000 });
            } else {
                toast.current?.show({ severity: 'success', summary: 'Conectado', detail: 'Balança conectada com sucesso!', life: 3000 });
            }
            return true;
        } catch (error: any) {
            console.error('Erro ao conectar balança:', error);
            let msg = 'Erro ao conectar com a balança. ';
            if (error.name === 'NotFoundError') msg += 'Nenhuma balança encontrada. Verifique a conexão USB.';
            else if (error.name === 'SecurityError') msg += 'Permissão negada pelo usuário.';
            else msg += error.message;
            setScaleError(msg);
            toast.current?.show({ severity: 'error', summary: 'Erro', detail: msg, life: 5000 });
            return false;
        } finally {
            setIsReadingScale(false);
        }
    };

    const readScaleOnce = async () => {
        if (!scaleConnected || !scalePort) { await connectToScale(); return; }
        try {
            setIsReadingScale(true);
            setScaleError(null);
            const w = await readScaleWeight(scalePort);
            if (w !== null && w > 0) {
                setScaleReading(w);
                setScaleInputValue(w);
                if (produtoSelecionado && isWeightProduct(produtoSelecionado)) {
                    setQtdSelecionada(w);
                    toast.current?.show({ severity: 'success', summary: 'Peso lido', detail: `${produtoSelecionado.nome}: ${w.toFixed(3)} kg`, life: 3000 });
                } else {
                    toast.current?.show({ severity: 'info', summary: 'Leitura', detail: `Peso: ${w.toFixed(3)} kg`, life: 2000 });
                }
            } else {
                toast.current?.show({ severity: 'warn', summary: 'Atenção', detail: 'Nenhum peso detectado. Verifique se há produto na balança.', life: 3000 });
            }
        } catch (error: any) {
            setScaleError('Erro na leitura: ' + error.message);
        } finally {
            setIsReadingScale(false);
        }
    };

    const disconnectFromScale = async () => {
        continuousReadingRef.current = false;
        if (scalePort) {
            try {
                if (scaleReaderRef.current) { await scaleReaderRef.current.cancel(); scaleReaderRef.current = null; }
                await scalePort.close();
                setScalePort(null);
                setScaleConnected(false);
                setScaleReading(null);
                setScaleInputValue(null);
                setScaleError(null);
                toast.current?.show({ severity: 'info', summary: 'Desconectado', detail: 'Balança desconectada.', life: 3000 });
            } catch (error: any) {
                setScaleError('Erro ao desconectar: ' + error.message);
            }
        }
    };

    const clearScaleReading = () => {
        setScaleReading(null);
        setScaleInputValue(null);
    };

    // ===========================================
    // FUNÇÕES DE PRODUTO COM PESO
    // ===========================================
    const isWeightProduct = (produto: Produto | null): boolean => {
        if (!produto) return false;
        if (produto.unit_type && produto.unit_type.toLowerCase() === 'kg') return true;
        if (produto.unit && produto.unit.toLowerCase() === 'kg') return true;
        if (produto.price_per_kg !== undefined && produto.price_per_kg > 0) return true;
        if ((produto as any).is_weight_product === true) return true;
        return false;
    };

    const getUnitInfo = (produto: Produto | null): {
        suffix: string;
        step: number;
        fractionDigits: number;
        isScaleLinked: boolean;
        scaleFactor: number;
        label: string;
    } => {
        if (!produto) return { suffix: '', step: 1, fractionDigits: 0, isScaleLinked: false, scaleFactor: 1, label: 'Quantidade' };
        const unit = (produto.unit_type || produto.unit || '').toLowerCase().trim();
        if (['kg'].includes(unit)) return { suffix: ' kg', step: 0.001, fractionDigits: 3, isScaleLinked: true, scaleFactor: 1, label: 'Quantidade (kg)' };
        if (['g', 'grama', 'gramas', 'gr'].includes(unit)) return { suffix: ' g', step: 1, fractionDigits: 0, isScaleLinked: true, scaleFactor: 1000, label: 'Quantidade (g)' };
        if (['l', 'lt', 'litro', 'litros'].includes(unit)) return { suffix: ' L', step: 0.001, fractionDigits: 3, isScaleLinked: true, scaleFactor: 1, label: 'Quantidade (L)' };
        if (['ml', 'mililitro', 'mililitros'].includes(unit)) return { suffix: ' ml', step: 0.001, fractionDigits: 3, isScaleLinked: false, scaleFactor: 1, label: 'Quantidade (ml)' };
        if (['ton', 'tonelada', 'toneladas'].includes(unit)) return { suffix: ' ton', step: 0.001, fractionDigits: 3, isScaleLinked: true, scaleFactor: 0.001, label: 'Quantidade (ton)' };
        if (['mt', 'm', 'metro', 'metros'].includes(unit)) return { suffix: ' m', step: 0.01, fractionDigits: 2, isScaleLinked: false, scaleFactor: 1, label: 'Quantidade (m)' };
        if (['gl', 'galao', 'galões', 'galoes'].includes(unit)) return { suffix: ' gal', step: 0.001, fractionDigits: 3, isScaleLinked: false, scaleFactor: 1, label: 'Quantidade (gal)' };
        if (['cx', 'caixa', 'caixas'].includes(unit)) return { suffix: ' cx', step: 1, fractionDigits: 0, isScaleLinked: false, scaleFactor: 1, label: 'Quantidade (cx)' };
        if (['pc', 'peca', 'pecas', 'peça', 'peças'].includes(unit)) return { suffix: ' pc', step: 1, fractionDigits: 0, isScaleLinked: false, scaleFactor: 1, label: 'Quantidade (pc)' };
        if (['dz', 'duzia', 'dúzia', 'dúzias'].includes(unit)) return { suffix: ' dz', step: 1, fractionDigits: 0, isScaleLinked: false, scaleFactor: 1, label: 'Quantidade (dz)' };
        return { suffix: '', step: 1, fractionDigits: 0, isScaleLinked: false, scaleFactor: 1, label: 'Quantidade' };
    };

    const buscarPorSku = (valor: string) => {
        const termo = valor.trim().toLowerCase();
        if (!termo) return;
        // Alguns leitores enviam o identificador AIM "]C0/"]C1 antes do Code 128.
        const termoBarras = termo.replace(/^\]c\d/i, '').replace(/\s+/g, '');
        const codigoVariacaoRoupa = lerCodigoEtiquetaRoupa(termoBarras);
        if (codigoVariacaoRoupa) {
            if (carregandoRoupasCaixa) {
                codigoEtiquetaPendenteRef.current = termoBarras;
                setSkuInput('');
                toast.current?.show({
                    severity: 'info', summary: 'Leitura recebida',
                    detail: 'Aguardando o estoque de roupas terminar de carregar.', life: 3000,
                });
                return;
            }
            const { roupaId, variacaoId, codigoEstavel } = codigoVariacaoRoupa;
            let roupa: RoupaCaixa | undefined;
            let variacao: VariacaoRoupaCaixa | undefined;
            if (codigoEstavel) {
                for (const roupaItem of roupasDisponiveis) {
                    const variacaoItem = roupaItem.variacoes.find(item => criarCodigoEtiquetaRoupa(
                        roupaItem.id,
                        item.id,
                        { codigo: roupaItem.codigo, tamanho: item.tamanho, cor: item.cor },
                    ) === codigoEstavel);
                    if (variacaoItem) {
                        roupa = roupaItem;
                        variacao = variacaoItem;
                        break;
                    }
                }
            } else if (variacaoId) {
                roupa = roupaId
                    ? roupasDisponiveis.find(item => item.id === roupaId)
                    : roupasDisponiveis.find(item => item.variacoes.some(variacaoItem => variacaoItem.id === variacaoId));
                variacao = roupa?.variacoes.find(item => item.id === variacaoId);
            }
            if (roupa && variacao) {
                setRoupaSelecionada(roupa);
                setVariacaoRoupaSelecionada(variacao);
                setQtdRoupaSelecionada(variacao.estoque_infinito || variacao.quantidade_atual > 0 ? 1 : 0);
                setRoupaVariacaoDialog(true);
                setSkuInput('');
                toast.current?.show({
                    severity: 'success', summary: 'Variação encontrada',
                    detail: `${roupa.nome} — ${variacao.tamanho}${variacao.cor ? ` / ${variacao.cor}` : ''}`,
                    life: 3000,
                });
                return;
            }
            // Nunca mantenha a roupa da leitura anterior quando o identificador
            // interno não existe mais ou pertence a outra empresa.
            setRoupaSelecionada(null);
            setVariacaoRoupaSelecionada(null);
            setRoupaVariacaoDialog(false);
            setSkuInput(termoBarras);
            toast.current?.show({
                severity: 'error', summary: 'Etiqueta não vinculada',
                detail: `A variação da etiqueta ${termoBarras} não foi encontrada neste estoque.`, life: 5000,
            });
            return;
        }

        const encontrado = produtosDisponiveis.find(p =>
            (p.sku?.toLowerCase() === termo) ||
            (p.codigo_barras?.toLowerCase() === termo)
        );
        if (encontrado) {
            setRoupaSelecionada(null);
            setVariacaoRoupaSelecionada(null);
            setRoupaVariacaoDialog(false);
            handleProductSelect(encontrado);
            setSkuInput('');
            toast.current?.show({ severity: 'success', summary: 'Produto encontrado', detail: encontrado.nome, life: 2000 });
            return;
        }

        const roupaEncontrada = roupasDisponiveis.find(roupa =>
            String(roupa.codigo ?? '').trim().toLowerCase() === termo
        );
        if (roupaEncontrada) {
            setRoupaSelecionada(roupaEncontrada);
            setVariacaoRoupaSelecionada(null);
            setQtdRoupaSelecionada(1);
            setRoupaVariacaoDialog(true);
            setSkuInput('');
            toast.current?.show({ severity: 'success', summary: 'Roupa encontrada', detail: `${roupaEncontrada.nome} — selecione tamanho/cor`, life: 3000 });
            return;
        }

        setRoupaSelecionada(null);
        setVariacaoRoupaSelecionada(null);
        setRoupaVariacaoDialog(false);
        toast.current?.show({ severity: 'warn', summary: 'Código não encontrado', detail: `Nenhum produto ou roupa com SKU/código "${valor.trim()}"`, life: 3000 });
    };

    const handleProductSelect = (produto: Produto | null) => {
        if (!produto) {
            setProdutoSelecionado(null);
            setFiltroProdutoDropdown('');
            setIsWaitingForWeight(false);
            setQtdSelecionada(1);
            return;
        }

        if (isWeightProduct(produto)) {
            setIsWaitingForWeight(false);

            confirmDialog({
                message: `O produto "${produto.nome}" é vendido por peso. Deseja ler o peso da balança?`,
                header: 'Produto por Peso',
                icon: 'pi pi-question-circle',
                acceptLabel: 'Sim, ler da balança',
                rejectLabel: 'Não, digitar manualmente',
                accept: () => {
                    setProdutoSelecionado(produto);
                    if (scaleConnected && scaleReading && scaleReading > 0) {
                        setQtdSelecionada(scaleReading);
                        toast.current?.show({ severity: 'success', summary: 'Peso detectado', detail: `${produto.nome}: ${scaleReading.toFixed(3)} kg`, life: 3000 });
                    } else if (scaleConnected) {
                        setIsWaitingForWeight(true);
                        toast.current?.show({ severity: 'info', summary: 'Aguardando peso', detail: `Coloque "${produto.nome}" na balança. O peso será lido automaticamente.`, life: 5000 });
                    } else {
                        setPendingWeightProduct(produto);
                        setShowScaleModal(true);
                    }
                },
                reject: () => {
                    setIsWaitingForWeight(false);
                    setPendingWeightProduct(produto);
                    setScaleInputValue(null);
                    setScaleInputByValue(true);
                    setScaleValueInput(null);
                    setShowScaleModal(true);
                }
            });
        } else {
            setProdutoSelecionado(produto);
            setIsWaitingForWeight(false);
            const info = getUnitInfo(produto);
            const initialQtd = info.isScaleLinked && scaleConnected && scaleReading !== null
                ? parseFloat((scaleReading * info.scaleFactor).toFixed(info.fractionDigits))
                : info.step;
            setQtdSelecionada(initialQtd > 0 ? initialQtd : info.step);
            setTimeout(() => {
                qtdInputRef.current?.focus();
                qtdInputRef.current?.select();
            }, 100);
        }
    };

    const confirmWeightProduct = (weightKg: number, valorTotalInformado?: number) => {
        if (!pendingWeightProduct) return;
        if (weightKg <= 0) {
            toast.current?.show({ severity: 'warn', summary: 'Atenção', detail: 'Informe um peso válido!', life: 3000 });
            return;
        }

        const estoqueDisponivel = Number(
            produtosDisponiveis.find(p => p.id === pendingWeightProduct.id)?.currentQuantity ?? pendingWeightProduct.currentQuantity ?? 0
        );
        if (estoqueDisponivel <= 0) {
            toast.current?.show({ severity: 'error', summary: 'Sem estoque', detail: `"${pendingWeightProduct.nome}" está sem estoque.`, life: 4000 });
            return;
        }
        if (weightKg > estoqueDisponivel) {
            toast.current?.show({ severity: 'error', summary: 'Estoque insuficiente', detail: `Disponível: ${estoqueDisponivel.toFixed(3)} kg. Você pesou: ${weightKg.toFixed(3)} kg.`, life: 4000 });
            return;
        }

        const pricePerKg = pendingWeightProduct.price_per_kg || pendingWeightProduct.valor;

        const weightItem: ItemVenda = {
            id: pendingWeightProduct.id,
            nome: `${pendingWeightProduct.nome} (${weightKg.toFixed(3)} kg)`,
            valor: pricePerKg,
            quantidade: weightKg,
            is_weight_product: true,
            weight_kg: weightKg,
            unit: 'kg',
            unit_type: 'kg',
            valorTotalFixo: valorTotalInformado != null ? arredondarMoeda(valorTotalInformado) : undefined,
        };

        setVenda(prev => ({
            ...prev,
            produtos: [...prev.produtos, weightItem]
        }));

        toast.current?.show({
            severity: 'success',
            summary: 'Produto adicionado',
            detail: `${pendingWeightProduct.nome}: ${weightKg.toFixed(3)} kg = ${formatarMoeda(valorTotalInformado ?? (pricePerKg * weightKg))}`,
            life: 3000
        });

        setShowScaleModal(false);
        setPendingWeightProduct(null);
        setProdutoSelecionado(null);
        setRoupaSelecionada(null);
        setVariacaoRoupaSelecionada(null);
        setRoupaVariacaoDialog(false);
        setQtdRoupaSelecionada(1);
        setFiltroProdutoDropdown('');
        setScaleReading(null);
        setScaleInputValue(null);
        setScaleInputByValue(true);
        setScaleValueInput(null);
        setIsWaitingForWeight(false);
    };

    const cancelWeightProduct = () => {
        setShowScaleModal(false);
        setPendingWeightProduct(null);
        setProdutoSelecionado(null);
        setFiltroProdutoDropdown('');
        setScaleInputByValue(true);
        setScaleValueInput(null);
        setScaleReading(null);
        setScaleInputValue(null);
        setIsWaitingForWeight(false);
    };

    useEffect(() => {
        if (isWaitingForWeight && produtoSelecionado && isWeightProduct(produtoSelecionado) && scaleReading && scaleReading > 0) {
            setQtdSelecionada(scaleReading);
            toast.current?.show({ severity: 'success', summary: 'Peso detectado', detail: `${produtoSelecionado.nome}: ${scaleReading.toFixed(3)} kg — clique em "Adicionar"`, life: 3000 });
            setIsWaitingForWeight(false);
        }
    }, [scaleReading, isWaitingForWeight, produtoSelecionado]);

    useEffect(() => {
        if (!scaleConnected || scaleReading === null || !produtoSelecionado) return;
        if (isWeightProduct(produtoSelecionado) && scaleReading > 0) {
            setQtdSelecionada(scaleReading);
        } else {
            const { isScaleLinked, scaleFactor, fractionDigits } = getUnitInfo(produtoSelecionado);
            if (isScaleLinked) {
                const converted = parseFloat((scaleReading * scaleFactor).toFixed(fractionDigits));
                if (converted > 0) setQtdSelecionada(converted);
            }
        }
    }, [scaleReading, scaleConnected, produtoSelecionado]);

    const adicionarProduto = () => {
        if (!produtoSelecionado) {
            if (venda.produtos.length === 0) showError('Selecione um produto');
            return;
        }
        if (!qtdSelecionada || qtdSelecionada <= 0) return showError('Quantidade inválida');

        const produtoFresco = produtosDisponiveis.find(p => p.id === produtoSelecionado.id);
        const estoqueDisponivel = Number(produtoFresco?.currentQuantity ?? produtoSelecionado.currentQuantity ?? -1);
        if (estoqueDisponivel >= 0) {
            const noCarrinho = Number(venda.produtos.find(p => p.id === produtoSelecionado.id)?.quantidade ?? 0);
            const totalPedido = noCarrinho + Number(qtdSelecionada);
            if (totalPedido > estoqueDisponivel) {
                return showError(`Estoque insuficiente para "${produtoSelecionado.nome}" — disponível: ${estoqueDisponivel}, no carrinho: ${noCarrinho}, pedido: ${qtdSelecionada}`);
            }
        }

        setVenda(prev => {
            const existente = prev.produtos.find(p => p.id === produtoSelecionado.id);
            if (existente) {
                return {
                    ...prev,
                    produtos: prev.produtos.map(p =>
                        p.id === produtoSelecionado.id
                            ? { ...p, quantidade: p.quantidade + qtdSelecionada, editablePrice: true }
                            : p
                    ),
                };
            }
            return {
                ...prev,
                // O valor editado fica somente no item desta venda; o cadastro do produto não é alterado.
                produtos: [...prev.produtos, { ...produtoSelecionado, quantidade: qtdSelecionada, editablePrice: true }],
            };
        });

        setProdutoSelecionado(null);
        setFiltroProdutoDropdown('');
        setQtdSelecionada(1);
        setIsWaitingForWeight(false);

        setTimeout(() => {
            if (skuInputRef.current) {
                skuInputRef.current.focus();
            }
        }, 100);
    };

    const adicionarRoupa = () => {
        if (!roupaSelecionada || !variacaoRoupaSelecionada) return showError('Selecione a peça e a variação');
        if (!qtdRoupaSelecionada || qtdRoupaSelecionada <= 0 || !Number.isInteger(qtdRoupaSelecionada)) return showError('A quantidade da roupa deve ser um inteiro maior que zero');
        const estoque = Number(variacaoRoupaSelecionada.quantidade_atual);
        const noCarrinho = venda.produtos
            .filter(item => item.tipo === 'roupa' && item.variacao_id === variacaoRoupaSelecionada.id)
            .reduce((total, item) => total + Number(item.quantidade), 0);
        if (!variacaoRoupaSelecionada.estoque_infinito && estoque < noCarrinho + qtdRoupaSelecionada) return showError(`Estoque insuficiente para esta variação — disponível: ${estoque}, no carrinho: ${noCarrinho}`);
        const detalhe = [variacaoRoupaSelecionada.tamanho, variacaoRoupaSelecionada.cor].filter(Boolean).join(' / ');
        setVenda(prev => ({
            ...prev,
            produtos: [...prev.produtos, {
                id: -Date.now(),
                nome: `${roupaSelecionada.nome}${detalhe ? ` — ${detalhe}` : ''}`,
                valor: Number(roupaSelecionada.preco_venda),
                quantidade: qtdRoupaSelecionada,
                editablePrice: true,
                tipo: 'roupa',
                roupa_id: roupaSelecionada.id,
                variacao_id: variacaoRoupaSelecionada.id,
            }],
        }));
        setRoupaSelecionada(null);
        setVariacaoRoupaSelecionada(null);
        setQtdRoupaSelecionada(1);
        setRoupaVariacaoDialog(false);
    };

    const adicionarServico = () => {
        if (!servicoSelecionado || !agendamentoEdicaoId) return showError('Selecione um serviço');
        const jaAdicionado = venda.produtos.some(item =>
            item.tipo === 'servico'
            && item.agendamentoId === agendamentoEdicaoId
            && item.servicoId === servicoSelecionado.id
        );
        if (jaAdicionado) return showError('Este serviço já está na venda');

        setVenda(prev => ({
            ...prev,
            produtos: [...prev.produtos, {
                id: -Date.now(),
                nome: servicoSelecionado.nome,
                valor: servicoSelecionado.preco,
                quantidade: 1,
                editablePrice: true,
                tipo: 'servico',
                agendamentoId: agendamentoEdicaoId,
                servicoId: servicoSelecionado.id,
            }],
        }));
        setServicoSelecionado(null);
    };

    const adicionarServicoDireto = () => {
        if (!servicoCaixaSelecionado) return showError('Selecione um serviço');
        const servico = servicoCaixaSelecionado;
        setVenda(prev => ({
            ...prev,
            produtos: [...prev.produtos, {
                id: -Date.now(),
                nome: servico.name,
                valor: Number(servico.value),
                quantidade: 1,
                editablePrice: true,
                tipo: 'servico',
                origemServico: servico.origem === 'manual' ? 'caixa' : undefined,
                catalogoServicoId: servico.origem === 'fiscal' ? Number(servico.id) : undefined,
                servicoAgendaCatalogoId: servico.origem === 'agenda' ? String(servico.id) : undefined,
            }],
        }));
        setServicoCaixaSelecionado(null);
    };

    const removerItem = (id: number) => {
        setVenda(prev => ({ ...prev, produtos: prev.produtos.filter(p => p.id !== id) }));
    };

    const atualizarQtd = (id: number, qtd: number) => {
        setVenda(prev => ({
            ...prev,
            produtos: prev.produtos.map(p => p.id === id ? { ...p, quantidade: qtd, valorTotalFixo: undefined } : p),
        }));
    };

    const atualizarValorItem = (id: number, valor: number) => {
        setVenda(prev => ({
            ...prev,
            produtos: prev.produtos.map(p => p.id === id ? { ...p, valor, valorTotalFixo: undefined } : p),
        }));
    };

    const confirmarAberturaCaixa = async () => {
        if (!funcAberturaId) return showError('Selecione o funcionário que está abrindo o caixa');
        if (valAberturaInput === null || valAberturaInput < 0) return showError('Informe o valor inicial do caixa');
        const func = funcionarios.find(f => f.id === funcAberturaId);
        if (!func) return;
        try {
            await api.post('/turnos-caixa', { func_abertura_id: func.id, func_abertura_nome: func.nome, valor_abertura: valAberturaInput });
            await fetchTurnos(empresaId);
            setAberturaCaixaDialog(false);
            setFuncAberturaId(null); setValAberturaInput(null);
            showSuccess(`Caixa aberto por ${func.nome} com ${fmtMoeda(valAberturaInput)}`);
        } catch (err: any) { showError(err?.response?.data?.error ?? 'Erro ao abrir caixa'); }
    };

    const confirmarFechamentoCaixa = async () => {
        if (!turnoFechamentoId) return showError('Selecione qual caixa fechar');
        if (valFechamentoInput === null || valFechamentoInput < 0) return showError('Informe o valor no fechamento');
        const turno = turnosAbertos.find(t => t.id === turnoFechamentoId);
        if (!turno) return;
        const funcFech = funcFechamentoId ? funcionarios.find(f => f.id === funcFechamentoId) : null;
        try {
            await api.put(`/turnos-caixa/${turnoFechamentoId}/fechar`, {
                func_fechamento_id: funcFech?.id ?? turno.func_abertura_id,
                func_fechamento_nome: funcFech?.nome ?? turno.func_abertura_nome,
                valor_fechamento: valFechamentoInput,
            });
            await fetchTurnos(empresaId);
            setFechamentoCaixaDialog(false);
            setTurnoFechamentoId(null); setFuncFechamentoId(null); setValFechamentoInput(null);
            showSuccess(`Caixa de ${turno.func_abertura_nome} fechado`);
        } catch (err: any) { showError(err?.response?.data?.error ?? 'Erro ao fechar caixa'); }
    };

    const verMovimentosTurno = async (turno: TurnoCaixa) => {
        setTurnoDetalhe(turno); setTurnoMovimentos(null); setCarregandoMovimentos(true);
        try {
            const res = await api.get(`/turnos-caixa/${turno.id}/movimentos`);
            setTurnoMovimentos(res.data);
        } catch (err: any) { showError(err?.response?.data?.error ?? err?.message ?? 'Erro ao carregar movimentos'); }
        finally { setCarregandoMovimentos(false); }
    };

    const totalPago = venda.pagamentos.reduce((s, p) => s + (p.valor || 0), 0);
    const trocoTotal = venda.pagamentos.filter(p => p.forma === 'DINHEIRO')
        .reduce((s, p) => s + Math.max(0, (p.valorRecebido || 0) - (p.valor || 0)), 0);

    const adicionarPagamento = () => {
        const restante = Math.max(0, venda.valorTotal - totalPago);
        setVenda(prev => ({ ...prev, pagamentos: [...prev.pagamentos, { uid: Date.now(), forma: 'DINHEIRO', valor: restante }] }));
    };
    const atualizarPagamento = (uid: number, campos: Partial<PagamentoItem>) => {
        setVenda(prev => ({ ...prev, pagamentos: prev.pagamentos.map(p => p.uid === uid ? { ...p, ...campos } : p) }));
    };
    const removerPagamento = (uid: number) => {
        setVenda(prev => ({ ...prev, pagamentos: prev.pagamentos.filter(p => p.uid !== uid) }));
    };

    const obterItensSelecionadosNota = () => modoItensNota === 'todos'
        ? itensNotaFiscal
        : itensNotaFiscal.filter(item => itemIdsNotaSelecionados.includes(item.id));

    const calcularTotalNota = (itensSelecionados: ItemNotaFiscal[]) => {
        const emissaoParcial = itensSelecionados.length < itensNotaFiscal.length;
        if (!emissaoParcial) return venda.valorTotal;

        const subtotalVenda = itensNotaFiscal.reduce((s, item) => s + item.valor_total, 0);
        const subtotalNota = itensSelecionados.reduce((s, item) => s + item.valor_total, 0);
        const descontoVenda = Number(venda.desconto || 0);
        const descontoNota = venda.tipoDesconto === 'percent'
            ? subtotalNota * (descontoVenda / 100)
            : (subtotalVenda > 0 ? descontoVenda * (subtotalNota / subtotalVenda) : 0);

        return Math.max(0, subtotalNota - Math.min(descontoNota, subtotalNota));
    };

    const gerarResumoFiscal = (tipo: 'nfce' | 'nfe' = tipoNotaFiscal) => {
        const tipoNotaLabel = tipo === 'nfce' ? 'NFC-e (Consumidor Eletrônica)' : 'NF-e (Modelo 55)';
        const clienteStr = venda.cliente?.nomeCompleto || 'Consumidor Final';
        const docCliente = venda.cliente ? (venda.cliente.cpf || venda.cliente.cnpj || 'Não informado') : 'Não informado';
        const itensSelecionados = obterItensSelecionadosNota();
        const itensStr = itensSelecionados.map(item => `  • ${item.nome} (x${item.quantidade}) - ${fmtMoeda(item.valor_total)}`).join('\n');
        const totalNota = calcularTotalNota(itensSelecionados);
        return `
📄 RESUMO DA NOTA FISCAL
Tipo: ${tipoNotaLabel}
Cliente: ${clienteStr}
Documento: ${docCliente}
${tipo === 'nfe' && destinatarioIsentoIE ? 'Inscrição Estadual: contribuinte isento\n' : ''}Valor da Nota: ${fmtMoeda(totalNota)}

Itens:
${itensStr}

${itensSelecionados.length < itensNotaFiscal.length ? 'Emissão parcial: somente os produtos selecionados serão incluídos.' : 'Emissão completa: todos os produtos da venda serão incluídos.'}

Confirme os dados acima antes de emitir a nota.
        `.trim();
    };

    const handleVendaSubmit = () => {
        if (!venda.funcionario) return showError('Selecione um funcionário');
        if (precisaAutenticarFuncionario(podePularSenha, venda.funcionario.id, funcionarioAutenticadoId)) {
            setFuncionarioPendente(venda.funcionario);
            setSenhaInput('');
            setSenhaDialog(true);
            return;
        }
        if (venda.produtos.length === 0) return showError('Adicione pelo menos um produto');
        if (venda.cfop && !/^\d{4}$/.test(venda.cfop)) return showError('O CFOP da venda deve conter exatamente 4 dígitos');
        if (venda.cstCsosn && !/^\d{2,3}$/.test(venda.cstCsosn)) return showError('O CST deve conter 2 dígitos ou o CSOSN deve conter 3 dígitos');
        const totalmenteCobertaPelaRecorrencia = venda.valorTotal <= 0.01
            && venda.produtos.every(item => item.recorrenciaInclusa);
        if (venda.pagamentos.length === 0 && !totalmenteCobertaPelaRecorrencia) {
            return showError('Adicione pelo menos uma forma de pagamento');
        }
        if (venda.pagamentos.some(p => p.forma === 'CARTAO' && !p.tipoCartao)) return showError('Selecione crédito ou débito no cartão');
        if (totalPago < venda.valorTotal - 0.01) return showError(`Valor pago (${fmtMoeda(totalPago)}) menor que o total (${fmtMoeda(venda.valorTotal)})`);

        setVendaConfirmadaId(null);
        setReciboContent(gerarRecibo());
        setShowReciboDialog(true);
    };

    const calcularTotalVenda = (v: typeof venda) => {
        const subtotal = v.produtos.reduce((s, p) => {
            if (p.valorTotalFixo != null) return s + calcularTotalItem(p);
            const qtd = p.weight_kg != null ? Number(p.weight_kg) : Number(p.quantidade);
            const unitario = p.weight_kg != null && Number(p.quantidade) === 1
                ? Number(p.valor) / Number(p.weight_kg)
                : Number(p.valor);
            return s + qtd * unitario;
        }, 0);
        const descontoValor = v.desconto
            ? (v.tipoDesconto === 'percent' ? subtotal * (v.desconto / 100) : v.desconto)
            : 0;
        return Math.max(0, subtotal - descontoValor + (v.taxaEntrega || 0));
    };

    const estoqueDisponivelItem = (item: ItemVenda) => {
        if (item.tipo === 'roupa') {
            const roupa = roupasDisponiveis.find(r => r.id === item.roupa_id);
            const variacao = roupa?.variacoes.find(v => v.id === item.variacao_id);
            return variacao?.estoque_infinito ? Number.POSITIVE_INFINITY : Number(variacao?.quantidade_atual ?? -1);
        }
        return Number(produtosDisponiveis.find(p => p.id === item.id)?.currentQuantity ?? item.currentQuantity ?? -1);
    };

    const confirmarVenda = async () => {
        if (confirmandoVenda) return;
        setConfirmandoVenda(true);

        // Em modo de edição o backend já reverte o estoque antes de revalidar,
        // então só bloqueamos no frontend quando a quantidade AUMENTOU além do disponível.
        // Para edições sem aumento de quantidade, deixamos o backend decidir.
        if (!editingVendaId) {
            for (const item of venda.produtos) {
                if (item.is_weight_product) continue;
                if (item.tipo === 'roupa') {
                    const estoqueDisp = estoqueDisponivelItem(item);
                    if (estoqueDisp >= 0 && Number(item.quantidade) > estoqueDisp) {
                        showError(`Estoque insuficiente para "${item.nome}" (tem ${estoqueDisp}, precisa ${item.quantidade})`);
                        setConfirmandoVenda(false);
                        return;
                    }
                    continue;
                }
                if (item.id <= 0) continue; // serviço — sem estoque
                const produtoFresco = produtosDisponiveis.find(p => p.id === item.id);
                const estoqueDisp = Number(produtoFresco?.currentQuantity ?? item.currentQuantity ?? -1);
                if (estoqueDisp >= 0 && Number(item.quantidade) > estoqueDisp) {
                    showError(`Estoque insuficiente para "${item.nome}" (tem ${estoqueDisp}, precisa ${item.quantidade})`);
                    setConfirmandoVenda(false);
                    return;
                }
            }
        } else {
            // Edição: só bloqueia se a quantidade AUMENTOU além de (estoque atual + original)
            for (const item of venda.produtos) {
                if (item.is_weight_product) continue;
                if (item.tipo === 'roupa') {
                    const itemOriginal = originalProdutosRef.current.find(p => p.tipo === 'roupa' && p.variacao_id === item.variacao_id);
                    const qtdOriginal = Number(itemOriginal?.quantidade ?? 0);
                    if (Number(item.quantidade) <= qtdOriginal) continue;
                    const estoqueDisp = estoqueDisponivelItem(item);
                    if (estoqueDisp >= 0 && Number(item.quantidade) > estoqueDisp + qtdOriginal) {
                        showError(`Estoque insuficiente para "${item.nome}" (tem ${estoqueDisp}, precisa ${item.quantidade})`);
                        setConfirmandoVenda(false);
                        return;
                    }
                    continue;
                }
                if (item.id <= 0) continue;
                const qtdOriginal = Number(originalProdutosRef.current.find(p => p.id === item.id)?.quantidade ?? 0);
                if (Number(item.quantidade) <= qtdOriginal) continue; // não aumentou — backend cuida
                const produtoFresco = produtosDisponiveis.find(p => p.id === item.id);
                const estoqueDisp = Number(produtoFresco?.currentQuantity ?? item.currentQuantity ?? -1);
                const estoqueEfetivo = estoqueDisp + qtdOriginal;
                if (estoqueEfetivo >= 0 && Number(item.quantidade) > estoqueEfetivo) {
                    showError(`Estoque insuficiente para "${item.nome}" (tem ${estoqueDisp}, precisa ${item.quantidade})`);
                    setConfirmandoVenda(false);
                    return;
                }
            }
        }

        if (editingVendaId) {
            try {
                const primeiroPag = venda.pagamentos[0];
                const payload = {
                    forma_pagamento: primeiroPag?.forma ?? 'DINHEIRO',
                    pagamentos: venda.pagamentos,
                    turno_id: turnosAbertos[0]?.id ?? null,
                    valor_total: calcularTotalVenda(venda),
                    cliente_id: venda.cliente?.id ?? null,
                    funcionario_id: venda.funcionario?.id ?? null,
                    com_nota: venda.comNota,
                    tipo_cartao: primeiroPag?.tipoCartao ?? null,
                    parcelas: primeiroPag?.parcelas ?? 1,
                    desconto: venda.desconto ?? 0,
                    tipo_desconto: venda.tipoDesconto,
                    taxa_entrega: venda.taxaEntrega ?? 0,
                    endereco_entrega: venda.temEntrega ? venda.enderecoEntrega : '',
                    observacao: venda.observacao,
                    cfop: venda.cfop.trim() || null,
                    cst_csosn: venda.cstCsosn.trim() || null,
                    data: venda.dataVenda,
                    orcamento_id: pendingTransfer?.orcamentoId ?? null,
                    itens: venda.produtos.map(p => {
                        // weight_kg != null → produto de balança
                        // formato antigo: quantidade=1, valor=totalValue → unitario = valor/weight
                        // formato novo:   quantidade=weightKg, valor=pricePerKg → unitario = valor
                        const qtd = p.weight_kg != null ? Number(p.weight_kg) : Number(p.quantidade);
                        const unitarioCalculado = p.weight_kg != null && Number(p.quantidade) === 1
                            ? Number(p.valor) / Number(p.weight_kg)
                            : Number(p.valor);
                        const unitario = p.valorTotalFixo != null && qtd > 0
                            ? Number(p.valorTotalFixo) / qtd
                            : unitarioCalculado;
                        return {
                            produto_id: p.id > 0 ? p.id : null,
                            nome_servico: p.id <= 0 ? p.nome : undefined,
                            tipo: p.tipo ?? (p.id <= 0 ? 'servico' : 'produto'),
                            roupa_id: p.tipo === 'roupa' ? p.roupa_id : undefined,
                            variacao_id: p.tipo === 'roupa' ? p.variacao_id : undefined,
                            nome_item: p.tipo === 'roupa' ? p.nome : undefined,
                            agendamento_id: p.agendamentoId ?? null,
                            servico_id: p.servicoId ?? null,
                            agendamento_servico_catalogo_id: p.servicoAgendaCatalogoId ?? null,
                            catalogo_servico_id: p.catalogoServicoId ?? null,
                            origem_servico: p.origemServico ?? null,
                            quantidade: qtd,
                            valor_unitario: unitario,
                            valor_total: p.valorTotalFixo ?? (qtd * unitario)
                        };
                    })
                };
                await api.put(`/vendas/${editingVendaId}`, payload);
                await Promise.all([fetchHistorico(), fetchProdutos(), fetchRoupasCaixa()]);
                showSuccess('Venda atualizada!');
                resetVenda();
                setShowReciboDialog(false);
            } catch (err: any) {
                showError(err?.response?.data?.error ?? 'Erro ao atualizar venda');
            }
            setConfirmandoVenda(false);
            return;
        }

        let vendaIdCriada: number | null = null;
        try {
            const primeiroPag = venda.pagamentos[0];
            const payload = {
                forma_pagamento: primeiroPag?.forma ?? 'DINHEIRO',
                pagamentos: venda.pagamentos,
                turno_id: turnosAbertos[0]?.id ?? null,
                valor_total: calcularTotalVenda(venda),
                cliente_id: venda.cliente?.id ?? null,
                funcionario_id: venda.funcionario?.id ?? null,
                com_nota: venda.comNota,
                tipo_cartao: primeiroPag?.tipoCartao ?? null,
                parcelas: primeiroPag?.parcelas ?? 1,
                desconto: venda.desconto ?? 0,
                tipo_desconto: venda.tipoDesconto,
                loja_cupom_id: venda.cupomId ?? null,
                loja_cupom_codigo: venda.cupomCodigo.trim().toUpperCase() || null,
                taxa_entrega: venda.taxaEntrega ?? 0,
                endereco_entrega: venda.temEntrega ? venda.enderecoEntrega : '',
                observacao: venda.observacao,
                cfop: venda.cfop.trim() || null,
                cst_csosn: venda.cstCsosn.trim() || null,
                data: venda.dataVenda,
                orcamento_id: pendingTransfer?.orcamentoId ?? null,
                itens: venda.produtos.map(p => {
                    const qtd = p.weight_kg != null ? Number(p.weight_kg) : Number(p.quantidade);
                    const unitarioCalculado = p.weight_kg != null && Number(p.quantidade) === 1
                        ? Number(p.valor) / Number(p.weight_kg)
                        : Number(p.valor);
                    const unitario = p.valorTotalFixo != null && qtd > 0
                        ? Number(p.valorTotalFixo) / qtd
                        : unitarioCalculado;
                    return {
                        produto_id: p.id > 0 ? p.id : null,
                        nome_servico: p.id <= 0 ? p.nome : undefined,
                        tipo: p.tipo ?? (p.id <= 0 ? 'servico' : 'produto'),
                        roupa_id: p.tipo === 'roupa' ? p.roupa_id : undefined,
                        variacao_id: p.tipo === 'roupa' ? p.variacao_id : undefined,
                        nome_item: p.tipo === 'roupa' ? p.nome : undefined,
                        agendamento_id: p.agendamentoId ?? null,
                        servico_id: p.servicoId ?? null,
                        agendamento_servico_catalogo_id: p.servicoAgendaCatalogoId ?? null,
                        catalogo_servico_id: p.catalogoServicoId ?? null,
                        origem_servico: p.origemServico ?? null,
                        quantidade: qtd,
                        valor_unitario: unitario,
                        valor_total: p.valorTotalFixo ?? (qtd * unitario)
                    };
                })
            };
            const response = await api.post('/vendas', payload);
            vendaIdCriada = response.data?.id ?? response.data?.venda?.id;
            if (!vendaIdCriada) throw new Error('ID da venda não retornado pela API');
            const vendaRegistrada = { ...venda, id: vendaIdCriada };
            setVenda(vendaRegistrada);
            setVendaConfirmadaId(vendaIdCriada);
            setReciboContent(gerarRecibo(vendaRegistrada));
            const itensCriados = Array.isArray(response.data?.itens) ? response.data.itens : [];
            const itensFiscais: ItemNotaFiscal[] = itensCriados.map((item: any, index: number) => ({
                id: Number(item.id),
                produto_id: item.produto_id != null ? Number(item.produto_id) : null,
                nome: venda.produtos.find(produto => produto.id === Number(item.produto_id))?.nome
                    || item.nome_item
                    || venda.produtos[index]?.nome
                    || `Item ${index + 1}`,
                quantidade: Number(item.quantidade || 0),
                valor_unitario: Number(item.valor_unitario || 0),
                valor_total: Number(item.valor_total || 0),
            })).filter((item: ItemNotaFiscal) => Number.isInteger(item.id));
            setItensNotaFiscal(itensFiscais);
            setItemIdsNotaSelecionados(itensFiscais.map(item => item.id));
            setModoItensNota('todos');
            setPendingTransfer(null);
            await Promise.all([fetchHistorico(), fetchProdutos(), fetchRoupasCaixa()]);
            showSuccess('Venda registrada! Estoque atualizado.');

            if (configFiscal && vendaIdCriada) {
                setVendaIdParaNota(vendaIdCriada);
                setDestinatarioIsentoIE(false);
                setShowEmitirNotaDialog(true);
            }
        } catch (err: any) {
            showError(err?.message || 'Erro ao registrar venda');
            setConfirmandoVenda(false);
            return;
        }
        setConfirmandoVenda(false);
    };

    const abrirResumoFiscalParaTipo = (tipo: 'nfce' | 'nfe') => {
        if (itensNotaFiscal.length === 0) {
            return showError('Não foi possível carregar os produtos da venda para emitir a nota');
        }
        if (modoItensNota === 'selecionar' && itemIdsNotaSelecionados.length === 0) {
            return showError('Selecione pelo menos um produto para emitir a nota');
        }
        setTipoNotaFiscal(tipo);
        setShowEmitirNotaDialog(false);

        setResumoFiscalContent(gerarResumoFiscal(tipo));
        setResumoFiscalDialog(true);
    };

    const emitirNotaFiscal = async () => {
        if (!vendaIdParaNota) return;

        try {
            setEmitindoNota(true);

            const vendaId = vendaIdParaNota;
            const tipo = tipoNotaFiscal;

            if (tipo === 'nfce') {
                await focusFiscalService.emitirNFCe({
                    vendaId,
                    itemIds: modoItensNota === 'selecionar' ? itemIdsNotaSelecionados : undefined
                });
            } else {
                const respostaNFe = await focusFiscalService.emitirNFe({
                    vendaId,
                    itemIds: modoItensNota === 'selecionar' ? itemIdsNotaSelecionados : undefined,
                    destinatarioIsentoIE
                });
                if (respostaNFe?.success === false) {
                    throw new Error(respostaNFe.message || 'A NF-e não foi aceita para emissão.');
                }

                if (dataVencimentoNota) {
                    try {
                        const resultado = respostaNFe as any;
                        await financeiroService.criarContaReceber({
                            cliente_id: venda.cliente?.id ?? null,
                            venda_id: vendaId,
                            nota_fiscal_id: Number(resultado?.registro?.id || resultado?.data?.registro?.id || 0) || null,
                            origem: 'NF_E',
                            descricao: `NF-e da venda #${vendaId}`,
                            valor: modoItensNota === 'selecionar'
                                ? calcularTotalNota(obterItensSelecionadosNota())
                                : Number(venda.valorTotal || 0),
                            data_vencimento: dataVencimentoNota
                        });
                    } catch (financeiroError) {
                        console.error('NF-e emitida, mas a conta a receber não foi criada', financeiroError);
                        showError('NF-e emitida, mas não foi possível criar a conta a receber. Você pode cadastrá-la na aba Contas a Receber.');
                    }
                }
            }

            showSuccess(`${tipo.toUpperCase()} enviada para emissão.`);

            setResumoFiscalDialog(false);
            setShowEmitirNotaDialog(false);
            setShowReciboDialog(false);
            setVendaIdParaNota(null);
            setDataVencimentoNota('');
            setDestinatarioIsentoIE(false);

            resetVenda();

            // As telas fiscais não fazem parte do recorte deste sistema.
            // Após a emissão, o usuário permanece na Caixa, que é o módulo operacional permitido.
            router.push('/uikit/input');
        } catch (err: any) {
            console.error(err);

            showError(
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                `Erro ao emitir ${tipoNotaFiscal.toUpperCase()}`
            );
        } finally {
            setEmitindoNota(false);
        }
    };

    const enderecoCompletoEntrega = (src: Venda | any) => {
        const enderecoInformado = String(src.enderecoEntrega || '').trim();
        const complemento = String(src.cliente?.complemento || '').trim();
        if (enderecoInformado) {
            return complemento && !enderecoInformado.toLowerCase().includes(complemento.toLowerCase())
                ? `${enderecoInformado}, ${complemento}`
                : enderecoInformado;
        }
        return [src.cliente?.rua, src.cliente?.numero, complemento, src.cliente?.bairro, src.cliente?.cidade, src.cliente?.cep]
            .filter(Boolean)
            .join(', ');
    };

    const gerarRecibo = (vendaOverride?: Venda) => {
        const src = vendaOverride ?? venda;
        const subtotal = src.produtos.reduce((s, p) => s + calcularTotalItem(p), 0);
        const descontoValor = src.tipoDesconto === 'percent'
            ? subtotal * ((src.desconto || 0) / 100)
            : (src.desconto || 0);
        const nomeEmpresa = empresaInfo?.nome_exibicao
            || empresaInfo?.nome_fantasia
            || empresaInfo?.razao_social
            || 'Empresa';
        const enderecoEmpresa = enderecoEmpresaRecibo(empresaInfo);
        const codigoVenda = codigoVendaRecibo(src);
        const enderecoEntrega = enderecoCompletoEntrega(src);
        const fmtPagto = (p: PagamentoItem) => {
            if (p.forma === 'CARTAO') return `Cartão ${p.bandeira ? bandeiraCartaoOptions.find(b => b.value === p.bandeira)?.label + ' ' : ''}${p.tipoCartao === 'credito' ? `Crédito ${p.parcelas ?? 1}x` : 'Débito'}: ${fmtMoeda(p.valor)}`;
            if (p.forma === 'DINHEIRO') {
                const troco = Math.max(0, (p.valorRecebido || 0) - p.valor);
                return `Dinheiro: ${fmtMoeda(p.valor)}${p.valorRecebido ? ` (recebido ${fmtMoeda(p.valorRecebido)}, troco ${fmtMoeda(troco)})` : ''}`;
            }
            return `PIX: ${fmtMoeda(p.valor)}`;
        };
        return `
${nomeEmpresa.toUpperCase()}
${empresaInfo?.cnpj ? `CNPJ: ${empresaInfo.cnpj}\n` : ''}${enderecoEmpresa ? `${enderecoEmpresa}\n` : ''}
================= RECIBO =================
${codigoVenda ? `Venda:         ${codigoVenda}\n` : ''}Data:          ${src.dataVenda?.toLocaleDateString('pt-BR')}
Funcionário:   ${src.funcionario?.nome}
Cliente:       ${src.cliente?.nomeCompleto ?? 'Consumidor'}

PRODUTOS:
${src.produtos.map(p => `  - ${p.nome} x${p.quantidade}: ${fmtMoeda(calcularTotalItem(p))}`).join('\n')}

Subtotal:      ${fmtMoeda(subtotal)}
Desconto:      ${fmtMoeda(descontoValor)}
Taxa Entrega:  ${fmtMoeda(src.taxaEntrega || 0)}${src.temEntrega && enderecoEntrega ? `\nEntrega para:  ${enderecoEntrega}` : ''}
TOTAL:         ${fmtMoeda(src.valorTotal)}

PAGAMENTO:
${src.pagamentos.map(p => `  - ${fmtPagto(p)}`).join('\n')}${trocoTotal > 0 ? `\nTroco Total:   ${fmtMoeda(trocoTotal)}` : ''}
Nota Fiscal:   Será perguntado após concluir a venda
Observação:    ${src.observacao || 'Nenhuma'}
=========================================
        `.trim();
    };

    // Helpers compartilhados para recibo
    const _dadosRecibo = (v?: any) => {
        const src = v ?? venda;
        const subtotal = src.produtos.reduce((s: number, p: ItemVenda) => s + calcularTotalItem(p), 0);
        const descV = src.tipoDesconto === 'percent' ? subtotal * ((src.desconto || 0) / 100) : (src.desconto || 0);
        const fmtPag = (p: PagamentoItem) => {
            if (p.forma === 'CARTAO') return `Cartão ${p.bandeira ? bandeiraCartaoOptions.find(b => b.value === p.bandeira)?.label + ' ' : ''}${p.tipoCartao === 'credito' ? `Crédito ${p.parcelas ?? 1}x` : 'Débito'}: ${fmtMoeda(p.valor)}`;
            if (p.forma === 'DINHEIRO') { const tr = Math.max(0, (p.valorRecebido || 0) - p.valor); return `Dinheiro: ${fmtMoeda(p.valor)}${p.valorRecebido ? ` (troco ${fmtMoeda(tr)})` : ''}`; }
            return `PIX: ${fmtMoeda(p.valor)}`;
        };
        return { subtotal, descV, fmtPag, src };
    };

    const enderecoEmpresaRecibo = (emp: any) => [
        emp?.logradouro,
        emp?.numero,
        emp?.complemento,
        emp?.bairro,
        emp?.municipio || emp?.cidade,
        emp?.uf,
        emp?.cep,
    ].map(valor => String(valor ?? '').trim())
        .filter(valor => valor && valor !== '-' && valor.toUpperCase() !== 'S/N' && valor.toUpperCase() !== 'XX')
        .join(', ');

    const codigoVendaRecibo = (src: any) => {
        const id = Number(src?.id ?? editingVendaId);
        return Number.isInteger(id) && id > 0 ? `#${id}` : null;
    };

    // PDF A4
    const imprimirPDF = (vendaOverride?: any) => {
        const { subtotal, descV, fmtPag, src } = _dadosRecibo(vendaOverride);
        const emp = empresaInfo;
        const nomeEmpresa = emp?.nome_exibicao || emp?.nome_fantasia || emp?.razao_social || 'EMPRESA';
        const data = src.dataVenda ? new Date(src.dataVenda).toLocaleDateString('pt-BR') : '';
        const enderecoEntrega = enderecoCompletoEntrega(src);
        const endEmp = enderecoEmpresaRecibo(emp);
        const codigoVenda = codigoVendaRecibo(src);
        const linhasProdutos = src.produtos.map((p: any) => `
            <tr>
                <td>${p.nome}</td>
                <td style="text-align:center">${p.quantidade}</td>
                <td style="text-align:right">${fmtMoeda(p.valor)}</td>
                <td style="text-align:right"><strong>${fmtMoeda(calcularTotalItem(p))}</strong></td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
        <style>
            @page { size: A4; margin: 16mm 14mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: #222; }
            .header { display: flex; align-items: flex-start; gap: 16px; border-bottom: 3px solid #2e7d32; padding-bottom: 10px; margin-bottom: 14px; }
            .header img { width: 64px; height: 64px; object-fit: contain; }
            .header-info h1 { font-size: 18px; color: #2e7d32; font-weight: 800; margin-bottom: 3px; }
            .header-info p { font-size: 10px; color: #555; line-height: 1.6; }
            .emissao { text-align: center; font-size: 10px; color: #666; margin-bottom: 14px; border-bottom: 1px dashed #ccc; padding-bottom: 8px; }
            .section { margin-bottom: 14px; }
            .section p { font-size: 11px; line-height: 1.8; }
            .section strong { font-weight: 700; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
            thead tr { background: #2e7d32; color: #fff; }
            thead th { padding: 6px 8px; text-align: left; font-weight: 600; }
            thead th:nth-child(2),thead th:nth-child(3),thead th:nth-child(4) { text-align: center; }
            tbody tr:nth-child(even) { background: #f1f8f1; }
            tbody td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; }
            tbody td:first-child { white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
            .totais { margin-top: 10px; border-top: 2px dashed #aaa; padding-top: 8px; }
            .totais table { width: 100%; }
            .totais td { padding: 3px 8px; font-size: 11px; }
            .totais .total-row td { font-size: 14px; font-weight: 800; color: #2e7d32; border-top: 2px solid #2e7d32; padding-top: 6px; }
            .footer { margin-top: 18px; text-align: center; border-top: 1px dashed #aaa; padding-top: 10px; font-size: 10px; color: #555; line-height: 1.8; }
        </style></head><body>
        <div class="header">
            ${emp?.logo_url ? `<img src="${emp.logo_url}" alt="logo"/>` : ''}
            <div class="header-info">
                <h1>${nomeEmpresa}</h1>
                ${emp?.cnpj ? `<p>CNPJ: ${emp.cnpj}</p>` : ''}
                <p>${emp?.telefone ? `(${emp.telefone.substring(0, 2)}) ${emp.telefone.substring(2)}` : ''}${endEmp ? ` | ${endEmp}` : ''}</p>
            </div>
        </div>
        <div class="emissao">${codigoVenda ? `Venda: ${codigoVenda} &nbsp;|&nbsp; ` : ''}Emissão: ${data} &nbsp;|&nbsp; Vendedor: ${src.funcionario?.nome ?? '—'}</div>
        <div class="section">
            <p><strong>Cliente:</strong> ${src.cliente?.nomeCompleto ?? 'Consumidor Final'}</p>
            ${src.cliente?.telefone ? `<p><strong>Telefone:</strong> ${src.cliente.telefone}</p>` : ''}
            ${src.temEntrega && enderecoEntrega ? `<p><strong>Endereço:</strong> ${enderecoEntrega}</p>` : ''}
            <p><strong>Forma de Pagamento:</strong> ${(src.pagamentos ?? []).map(fmtPag).join(' + ')}</p>
            ${src.observacao ? `<p><strong>Observação:</strong> ${src.observacao}</p>` : ''}
        </div>
        <div class="section">
            <strong>Produtos: ${src.produtos.length} ${src.produtos.length === 1 ? 'item' : 'itens'}</strong>
            <table>
                <thead><tr><th>Produto</th><th>Qtd</th><th>Valor</th><th>Total</th></tr></thead>
                <tbody>${linhasProdutos}</tbody>
            </table>
        </div>
        <div class="totais">
            <table>
                ${descV > 0 ? `<tr><th>Subtotal</th><td style="text-align:right">${fmtMoeda(subtotal)}</td></tr>
                <tr><th>Desconto</th><td style="text-align:right">- ${fmtMoeda(descV)}</td></tr>` : ''}
                ${src.temEntrega ? `<tr><th>Taxa de entrega</th><td style="text-align:right">${fmtMoeda(src.taxaEntrega || 0)}</td></tr>` : ''}
                <tr class="total-row"><th>TOTAL:</th><td style="text-align:right">${fmtMoeda(src.valorTotal)}</td></tr>
            </table>
        </div>
        <div class="footer">
            ${emp?.pix ? `<p>PIX: ${emp.pix}</p>` : ''}
            <p>Recibo gerado pelo sistema ${nomeEmpresa}</p>
        </div>
        <script>window.onload = () => window.print();<\/script>
        </body></html>`;

        const w = window.open('', '_blank', 'width=900,height=700');
        if (!w) return;
        w.document.write(html);
        w.document.close();
    };

    // Formatos térmicos com quebra de linha para preservar o nome completo dos produtos.
    const imprimirTermico = (largura: '80mm' | '58mm' | '120mm', vendaOverride?: any) => {
        const { subtotal, descV, fmtPag, src } = _dadosRecibo(vendaOverride);
        const configuracao = {
            '80mm': { cols: 42, pagina: '', corpo: '76mm', fonte: '10px', janela: 380 },
            '58mm': { cols: 32, pagina: '58mm 297mm', corpo: '54mm', fonte: '10px', janela: 280 },
            '120mm': { cols: 48, pagina: '120mm auto', corpo: '116mm', fonte: '11px', janela: 500 },
        }[largura];
        const { cols } = configuracao;
        const compacto = largura !== '120mm';
        const emp = empresaInfo;
        const nomeEmpresa = emp?.nome_exibicao || emp?.nome_fantasia || emp?.razao_social || '';
        const enderecoEmpresa = enderecoEmpresaRecibo(emp);
        const codigoVenda = codigoVendaRecibo(src);
        const enderecoEntrega = enderecoCompletoEntrega(src);

        const limparTexto = (txt: string) => {
            if (!txt) return '';
            return txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\x00-\x7F]/g, '')
                .replace(/[ãâäáà]/g, 'a')
                .replace(/[êëéè]/g, 'e')
                .replace(/[îïíì]/g, 'i')
                .replace(/[ôöóò]/g, 'o')
                .replace(/[ûüúù]/g, 'u')
                .replace(/[ç]/g, 'c')
                .replace(/[Ç]/g, 'C');
        };

        const linha = (c: string) => c.repeat(cols);

        const centro = (txt: string) => {
            const txtLimpo = limparTexto(txt);
            const pad = Math.max(0, Math.floor((cols - txtLimpo.length) / 2));
            return ' '.repeat(pad) + txtLimpo;
        };

        const dir = (esq: string, dirVal: string) => {
            const esqLimpo = limparTexto(esq);
            const dirLimpo = limparTexto(dirVal);
            const sp = Math.max(1, cols - esqLimpo.length - dirLimpo.length);
            return esqLimpo + ' '.repeat(sp) + dirLimpo;
        };

        const wrap = (txt: string, max: number): string[] => {
            const txtLimpo = limparTexto(txt);
            const words = txtLimpo.split(/\s+/).filter(Boolean);
            const lines: string[] = [];
            let cur = '';
            for (let word of words) {
                if (word.length > max) {
                    if (cur) {
                        lines.push(cur);
                        cur = '';
                    }
                    while (word.length > max) {
                        lines.push(word.substring(0, max));
                        word = word.substring(max);
                    }
                    cur = word;
                } else if ((cur + (cur ? ' ' : '') + word).length <= max) {
                    cur += (cur ? ' ' : '') + word;
                } else {
                    if (cur) lines.push(cur);
                    cur = word;
                }
            }
            if (cur) lines.push(cur);
            return lines;
        };

        const linhas: string[] = [];

        // CABEÇALHO
        if (compacto) {
            linhas.push(linha('='));
            linhas.push('');
        }

        if (nomeEmpresa) {
            const nomeEmp = limparTexto(nomeEmpresa);
            if (compacto) {
                wrap(nomeEmp, cols).forEach(nome => linhas.push(centro(nome)));
            } else {
                linhas.push(centro(nomeEmp));
            }
        }
        if (emp?.cnpj) linhas.push(centro(`CNPJ: ${emp.cnpj}`));
        if (enderecoEmpresa) {
            wrap(enderecoEmpresa, cols).forEach(parte => linhas.push(centro(parte)));
        }
        if (emp?.telefone) linhas.push(centro(limparTexto(emp.telefone)));

        if (compacto) {
            linhas.push('');
            linhas.push(centro('RECIBO DE VENDA'));
        } else {
            linhas.push(linha('-'));
            linhas.push(centro(`RECIBO DE VENDA`));
        }

        const dataVendaDate = src.dataVenda instanceof Date ? src.dataVenda : (src.dataVenda ? new Date(src.dataVenda) : null);
        linhas.push(centro(dataVendaDate?.toLocaleDateString('pt-BR') ?? ''));
        if (codigoVenda) linhas.push(centro(`VENDA: ${codigoVenda}`));

        if (compacto) {
            linhas.push('');
            const vendedor = limparTexto(src.funcionario?.nome ?? '');
            const prefixoVendedor = 'VENDEDOR: ';
            wrap(vendedor, cols - prefixoVendedor.length).forEach((parte, indice) => {
                linhas.push(`${indice === 0 ? prefixoVendedor : ' '.repeat(prefixoVendedor.length)}${parte}`);
            });
        } else {
            linhas.push(centro(`Vendedor: ${limparTexto(src.funcionario?.nome ?? '')}`));
        }
        linhas.push(linha('-'));

        // CLIENTE
        if (src.cliente) {
            const nomeCli = limparTexto(src.cliente.nomeCompleto);
            if (compacto) {
                const prefixoCliente = 'CLIENTE: ';
                wrap(nomeCli, cols - prefixoCliente.length).forEach((parte, indice) => {
                    linhas.push(`${indice === 0 ? prefixoCliente : ' '.repeat(prefixoCliente.length)}${parte}`);
                });
            } else {
                linhas.push(`Cliente: ${nomeCli}`);
            }
            if (src.cliente.telefone) {
                linhas.push(`TEL: ${limparTexto(src.cliente.telefone)}`);
            }
        } else {
            if (compacto) {
                linhas.push(`CLIENTE: CONSUMIDOR FINAL`);
            }
        }

        if (src.temEntrega && enderecoEntrega) {
            linhas.push(linha('-'));
            linhas.push('ENTREGA:');
            wrap(enderecoEntrega, cols).forEach(l => linhas.push(`  ${l}`));
        }
        linhas.push(linha('-'));

        // PRODUTOS
        const srcProdutos: any[] = src.produtos ?? [];
        if (compacto) {
            linhas.push('');
            linhas.push('ITENS / DESCRICAO');
        } else {
            linhas.push('PRODUTO                         QTD   TOTAL');
        }
        linhas.push(linha('-'));

        srcProdutos.forEach((p, idx) => {
            const prefixoItem = `${idx + 1}. `;
            const nomePartes = wrap(p.nome, Math.max(1, cols - prefixoItem.length));
            nomePartes.forEach((parte, indice) => {
                linhas.push(`${indice === 0 ? prefixoItem : ' '.repeat(prefixoItem.length)}${parte}`);
            });
            const qtdEValor = `${p.quantidade} x ${fmtMoeda(p.valor)}`;
            const totalItem = fmtMoeda(calcularTotalItem(p));
            wrap(qtdEValor, Math.max(1, cols - totalItem.length - 3))
                .forEach((parte, indice, partes) => {
                    linhas.push(indice === partes.length - 1 ? dir(`  ${parte}`, totalItem) : `  ${parte}`);
                });
            if (idx < srcProdutos.length - 1) linhas.push('');
        });
        linhas.push(linha('-'));

        // TOTAIS
        if (descV > 0) {
            linhas.push(dir('SUBTOTAL:', fmtMoeda(subtotal)));
            linhas.push(dir('DESCONTO:', `- ${fmtMoeda(descV)}`));
        }
        if (src.temEntrega) linhas.push(dir('ENTREGA:', fmtMoeda(src.taxaEntrega || 0)));

        const srcTrocoTotal = (src.pagamentos ?? []).filter((p: any) => p.forma === 'DINHEIRO').reduce((s: number, p: any) => s + Math.max(0, (p.valorRecebido || 0) - p.valor), 0);

        if (compacto) {
            linhas.push('');
            linhas.push(centro('═' + ' TOTAL ' + '═'));
            linhas.push(centro(`${fmtMoeda(src.valorTotal)}`));
            linhas.push('');
        } else {
            linhas.push(dir('TOTAL:', fmtMoeda(src.valorTotal)));
        }
        linhas.push(linha('-'));

        // PAGAMENTO
        if (compacto) {
            linhas.push('PAGAMENTO:');
        }
        (src.pagamentos ?? []).forEach((p: any) => {
            const textoPag = fmtPag(p);
            if (compacto) {
                wrap(textoPag, cols - 2).forEach(l => linhas.push(`  ${l}`));
            } else {
                linhas.push(textoPag);
            }
        });
        if (srcTrocoTotal > 0) {
            if (compacto) {
                linhas.push(`TROCO: ${fmtMoeda(srcTrocoTotal)}`);
            } else {
                linhas.push(dir('Troco:', fmtMoeda(srcTrocoTotal)));
            }
        }

        // OBSERVAÇÃO
        if (src.observacao) {
            linhas.push(linha('-'));
            linhas.push('OBS:');
            wrap(src.observacao, cols - 4).forEach(l => linhas.push(`  ${l}`));
        }

        linhas.push(linha('-'));

        // RODAPÉ
        if (emp?.pix) {
            const pixLimpo = limparTexto(emp.pix);
            if (compacto) {
                linhas.push('');
                linhas.push(centro('PIX PARA PAGAMENTO'));
                wrap(pixLimpo, cols).forEach(parte => linhas.push(centro(parte)));
            } else {
                linhas.push(centro(`PIX: ${pixLimpo}`));
            }
        }

        if (compacto) {
            linhas.push('');
            linhas.push(centro('* OBRIGADO! *'));
            linhas.push('');
            linhas.push(centro('VOLTE SEMPRE'));
            linhas.push('');
            linhas.push(linha('='));
            linhas.push('');
        } else {
            linhas.push(centro('Obrigado pela preferência!'));
            linhas.push(linha('-'));
            linhas.push('');
        }

        // Bobinas informam largura e comprimento total do rolo. A altura de cada
        // recibo precisa acompanhar o conteúdo para a impressora cortar apenas no fim.
        const alturaPagina80Mm = Math.max(50, Math.ceil(linhas.length * 3.7 + 6));
        const tamanhoPagina =
            largura === '80mm'
                ? `80mm ${alturaPagina80Mm}mm`
                : configuracao.pagina;

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>
            @page { 
                size: ${tamanhoPagina};
                margin: 1mm 2mm;
            }
            * { 
                margin: 0; 
                padding: 0; 
                box-sizing: border-box; 
            }
            body { 
                font-family: 'Courier New', 'Courier', 'Monaco', monospace; 
                font-size: ${configuracao.fonte};
                font-weight: ${compacto ? 'bold' : 'normal'};
                width: ${configuracao.corpo};
                max-width: 100%;
                line-height: 1.35; 
                color: #000000; 
                background: #ffffff;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            pre { 
                white-space: pre-wrap; 
                font-family: 'Courier New', 'Courier', monospace; 
                font-size: ${configuracao.fonte};
                font-weight: ${compacto ? 'bold' : 'normal'};
                line-height: 1.35;
                margin: 0;
                color: #000000;
                max-width: 100%;
                overflow-wrap: anywhere;
                word-break: break-word;
            }
            @media print {
                body, pre {
                    color: #000000 !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }
        </style>
        </head><body>
        <pre>${linhas.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        <script>
            window.onload = () => { 
                window.print(); 
                setTimeout(() => window.close(), 500);
            };
        <\/script>
        </body></html>`;

        const w = window.open('', '', `width=${configuracao.janela},height=700,menubar=no,toolbar=no`);
        if (!w) return;
        w.document.write(html);
        w.document.close();
    };

    const imprimirRecibo = () => {
        const vendaRecibo = vendaConfirmadaId ? { ...venda, id: vendaConfirmadaId } : venda;
        if (tipoCupom === 'pdf') return imprimirPDF(vendaRecibo);
        if (tipoCupom === '80mm') return imprimirTermico('80mm', vendaRecibo);
        if (tipoCupom === '120mm') return imprimirTermico('120mm', vendaRecibo);
        return imprimirTermico('58mm', vendaRecibo);
    };

    const imprimirReciboHistorico = (item: HistoricoItem, formato: FormatoRecibo) => {
        if (item._kind !== 'venda') return;
        const vendaTemp = {
            ...item,
            temEntrega: !!(item.enderecoEntrega),
            produtos: item.produtos ?? [],
            pagamentos: item.pagamentos ?? [],
        };
        if (formato === 'pdf') imprimirPDF(vendaTemp);
        else if (formato === '80mm') imprimirTermico('80mm', vendaTemp);
        else if (formato === '120mm') imprimirTermico('120mm', vendaTemp);
        else imprimirTermico('58mm', vendaTemp);
        setVendaHistoricoParaImprimir(null);
    };

    const resetVenda = () => {
        const funcionarioLogado = encontrarFuncionarioLogado(funcionarios, usuarioLogado);
        setVenda({ ...initialVenda(), funcionario: funcionarioLogado });
        setFuncionarioAutenticadoId(null);
        setProdutoSelecionado(null);
        setRoupaSelecionada(null);
        setVariacaoRoupaSelecionada(null);
        setRoupaVariacaoDialog(false);
        setQtdRoupaSelecionada(1);
        setServicosDisponiveis([]);
        setServicoSelecionado(null);
        setServicoCaixaSelecionado(null);
        setAgendamentoEdicaoId(null);
        setCarregandoServicos(false);
        setFiltroProdutoDropdown('');
        setQtdSelecionada(1);
        setEditingVendaId(null);
        originalProdutosRef.current = [];
        setTipoNotaFiscal('nfce');
        setDestinatarioIsentoIE(false);
        setIsWaitingForWeight(false);
        setBairroSelecionado(null);
        setItensNotaFiscal([]);
        setItemIdsNotaSelecionados([]);
        setModoItensNota('todos');
        setVendaConfirmadaId(null);
    };

    const abrirNovaSaida = () => {
        setSaida({ ...initialSaida(), turno_id: turnosAbertos.length === 1 ? turnosAbertos[0].id : null });
        setEditingSaidaId(null);
        setSaidaDialog(true);
    };

    const abrirCadastroComissao = () => {
        setComissaoFuncionarioId(null);
        setComissaoTipo('percent');
        setComissaoValor(0);
        setComissaoDialog(true);
    };

    const onSelecionarFuncionarioComissao = (id: number) => {
        setComissaoFuncionarioId(id);
        const func = funcionarios.find(f => f.id === id);
        if (func) {
            setComissaoTipo(func.comissao_tipo ?? 'percent');
            setComissaoValor(func.comissao_valor ?? 0);
        }
    };

    const salvarComissao = async () => {
        if (!comissaoFuncionarioId) return showError('Selecione um funcionário');
        if (comissaoValor < 0) return showError('Valor inválido');
        setComissaoSalvando(true);
        try {
            await api.put(`/users/${comissaoFuncionarioId}`, {
                comissao_tipo: comissaoTipo,
                comissao_valor: comissaoValor,
            });
            setFuncionarios(prev => prev.map(f =>
                f.id === comissaoFuncionarioId
                    ? { ...f, comissao_tipo: comissaoTipo, comissao_valor: comissaoValor }
                    : f
            ));
            if (venda.funcionario?.id === comissaoFuncionarioId) {
                setVenda(p => ({
                    ...p,
                    funcionario: p.funcionario
                        ? { ...p.funcionario, comissao_tipo: comissaoTipo, comissao_valor: comissaoValor }
                        : null
                }));
            }
            showSuccess('Comissão salva!');
            setComissaoDialog(false);
        } catch (err: any) {
            showError(err?.message || 'Erro ao salvar comissão');
        } finally {
            setComissaoSalvando(false);
        }
    };

    const handleSaidaSubmit = async () => {
        if (salvandoSaidaRef.current) return;
        if (!empresaId) return showError('Selecione a empresa antes de registrar a saída');
        if (!saida.tipo) return showError('Informe o tipo da saída');
        if (!Number.isFinite(saida.valor) || Number(saida.valor) <= 0) return showError('Informe um valor maior que zero');
        if (!saida.data || !Number.isFinite(new Date(saida.data).getTime())) return showError('Informe a data da saída');
        if ((!editingSaidaId || saida.turno_id != null) && !saida.forma_pagamento) return showError('Selecione a forma de pagamento da saída');
        if (!editingSaidaId && !turnosAbertos.some(t => Number(t.id) === Number(saida.turno_id))) return showError('Abra ou selecione um turno aberto para registrar a saída');
        salvandoSaidaRef.current = true;
        setSalvandoSaida(true);
        try {
            const payload = { tipo: saida.tipo, descricao: saida.descricao, data: saida.data, valor: saida.valor, natureza: 'SAIDA', forma_pagamento: saida.forma_pagamento, turno_id: saida.turno_id };
            if (editingSaidaId) await api.put(`/financeiro/saidas/${editingSaidaId}`, payload);
            else await api.post('/financeiro/saidas', payload);
            showSuccess(editingSaidaId ? 'Saída atualizada!' : 'Saída registrada!');
            setSaida(initialSaida);
            setEditingSaidaId(null);
            setSaidaDialog(false);
            await fetchHistorico(empresaId);
            if (turnoDetalhe) await verMovimentosTurno(turnoDetalhe);
        } catch (error: any) {
            showError(error?.message ?? 'Não foi possível salvar a saída. Confira o histórico antes de tentar novamente.');
        } finally {
            salvandoSaidaRef.current = false;
            setSalvandoSaida(false);
        }
    };

    const visualizar = (item: HistoricoItem) => { setViewItem(item); setViewDialog(true); };
    const carregarServicosDoAgendamento = async (agendamentoId: number) => {
        setCarregandoServicos(true);
        setServicosDisponiveis([]);
        setServicoSelecionado(null);
        try {
            const agendamentosResponse = await api.get('/agendamentos');
            const agendamentos = agendamentosResponse.data?.data ?? agendamentosResponse.data ?? [];
            const agendamento = Array.isArray(agendamentos)
                ? agendamentos.find((registro: any) => Number(registro.id) === agendamentoId)
                : null;
            if (!agendamento?.unidadeId) throw new Error('Unidade do agendamento não encontrada');

            const servicosResponse = await api.get('/agendamentos/servicos', {
                params: { unidadeId: agendamento.unidadeId },
            });
            const servicos = servicosResponse.data?.data ?? servicosResponse.data ?? [];
            setServicosDisponiveis(Array.isArray(servicos) ? servicos.map((servico: any) => ({
                id: String(servico.id),
                nome: servico.nome,
                preco: Number(servico.preco ?? 0),
                duracaoMin: Number(servico.duracaoMin ?? 0),
            })) : []);
        } catch (error: any) {
            setServicosDisponiveis([]);
            showError(error?.response?.data?.error ?? error?.message ?? 'Não foi possível carregar os serviços');
        } finally {
            setCarregandoServicos(false);
        }
    };

    const editar = (item: HistoricoItem) => {
        if (item._kind === 'venda') {
            setVenda({
                ...item,
                dataVenda: item.dataVenda ? new Date(item.dataVenda) : null,
                temEntrega: !!(item.enderecoEntrega),
                enderecoEntrega: item.enderecoEntrega ?? '',
            });
            originalProdutosRef.current = item.produtos ?? [];
            setEditingVendaId(item.id!);
            const agendamentoId = item.produtos.find(produto =>
                produto.tipo === 'servico' && produto.agendamentoId
            )?.agendamentoId ?? null;
            setAgendamentoEdicaoId(agendamentoId);
            if (agendamentoId) void carregarServicosDoAgendamento(agendamentoId);
            else {
                setServicosDisponiveis([]);
                setServicoSelecionado(null);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            setSaida({ ...item, data: item.data ? new Date(item.data) : null });
            setEditingSaidaId(item.id!);
            setSaidaDialog(true);
        }
    };
    const excluir = (item: HistoricoItem) => {
        confirmDialog({
            message: item._kind === 'saida'
                ? 'Deseja excluir esta saída? Ela será removida do histórico compartilhado e do Financeiro da empresa.'
                : 'Deseja realmente excluir este registro?',
            header: 'Confirmar exclusão',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sim, excluir',
            rejectLabel: 'Cancelar',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                if (item._kind === 'venda' && item.id) {
                    try {
                        await api.delete(`/vendas/${item.id}`);
                        await Promise.all([fetchHistorico(), fetchRoupasCaixa()]);
                        showSuccess('Venda excluída');
                    } catch (error: any) {
                        showError(error?.response?.data?.error ?? error?.message ?? 'Erro ao excluir venda');
                    }
                } else if (item.id) {
                    try {
                        await api.delete(`/financeiro/saidas/${item.id}`);
                        await fetchHistorico(empresaId);
                        if (turnoDetalhe) await verMovimentosTurno(turnoDetalhe);
                        showSuccess('Saída excluída');
                    } catch (error: any) {
                        showError(error?.message ?? 'Erro ao excluir saída');
                    }
                }
            }
        });
    };

    const fetchTurnos = async (eid?: number | null) => {
        try {
            const params: Record<string, any> = {};
            const id = eid !== undefined ? eid : empresaId;
            if (id) params.empresa_id = id;
            const res = await api.get('/turnos-caixa', { params });
            setTurnos(res.data ?? []);
        } catch { setTurnos([]); }
    };

    useEffect(() => {
        let empId: number | undefined;
        try {
            const u = JSON.parse(localStorage.getItem('user') ?? '{}');
            setUsuarioLogado({
                id: u?.id != null ? Number(u.id) : undefined,
                email: typeof u?.email === 'string' ? u.email : undefined,
            });
            const isMaster = u?.tipo === 'MASTER' || u?.email === 'admin@master.com';
            const empresaSelecionada = localStorage.getItem('empresa_selecionada');
            if (isMaster && empresaSelecionada) {
                empId = Number(empresaSelecionada);
            } else {
                empId = u?.empresa_id ? Number(u.empresa_id) : undefined;
            }
            if (empId) {
                api.get(`/empresas/${empId}/configuracoes`)
                    .then(res => {
                        const cfg = res.data ?? {};
                        // Mantido apenas para compatibilidade com instalações
                        // antigas: a senha do caixa deixou de ser obrigatória.
                        void cfg;
                    })
                    .catch(() => {});
            }
        } catch { }

        fetchTurnos(empId ?? null);
        fetchBairros();
        api.get('/clientes')
            .then(res => {
                const lista = Array.isArray(res.data?.data ?? res.data) ? (res.data?.data ?? res.data) : [];
                setClientes(lista.map((c: any) => ({
                    id: c.id, nomeCompleto: c.nomeCompleto ?? c.nome ?? c.nome_completo ?? '', telefone: c.telefone,
                    cpf: c.cpf, cnpj: c.cnpj,
                    rua: c.rua, numero: c.numero, complemento: c.complemento, bairro: c.bairro, cidade: c.cidade, cep: c.cep,
                })));
            })
            .catch(() => setClientes([]))
            .finally(() => setClientesCarregados(true));

        // O Caixa pode ser usado por operadores sem acesso administrativo.
        // Tenta a lista operacional e, em ambientes legados, complementa com
        // vendedores que já aparecem nas vendas da própria empresa.
        Promise.allSettled([
            api.get('/users/funcionarios-venda'),
            api.get('/users'),
            api.get('/vendas'),
        ])
            .then(resultados => {
                const listas: any[][] = [];
                const [operacional, administrativa, vendas] = resultados;
                for (const resultado of [operacional, administrativa]) {
                    if (resultado.status !== 'fulfilled') continue;
                    const payload = resultado.value.data?.data ?? resultado.value.data ?? [];
                    if (Array.isArray(payload)) listas.push(payload);
                }

                if (vendas.status === 'fulfilled') {
                    const payload = vendas.value.data?.data ?? vendas.value.data ?? [];
                    if (Array.isArray(payload)) {
                        listas.push(payload
                            .filter((v: any) => v.funcionario && (v.funcionario_id ?? v.funcionario.id))
                            .map((v: any) => ({
                                id: v.funcionario_id ?? v.funcionario.id,
                                nomeCompleto: v.funcionario.nomeCompleto,
                                email: v.funcionario.email,
                            })));
                    }
                }

                setFuncionarios(normalizarFuncionariosCaixa(listas));
            })
            .catch(() => setFuncionarios([]))
            .finally(() => setFuncionariosCarregados(true));

        fetchProdutos(empId);
        fetchRoupasCaixa();
        fetchServicosCaixa(empId);

        setEmpresaId(empId ?? null);
        fetchHistorico(empId ?? null);

        if (empId) {
            api.get(`/empresa-config-fiscal/${empId}`)
                .then(res => setConfigFiscal(res.data))
                .catch(() => setConfigFiscal(null))
                .finally(() => setCarregandoConfigFiscal(false));
            carregarDadosEmpresaRecibo(empId)
                .then(setEmpresaInfo)
                .catch(() => setEmpresaInfo(null));
        } else {
            setCarregandoConfigFiscal(false);
        }

        checkWebSerialSupport();

        const transferKey = 'saudevida_orcamento_para_caixa';
        const transferRaw = localStorage.getItem(transferKey);
        if (transferRaw) {
            try {
                const t = JSON.parse(transferRaw);
                setVenda(prev => ({
                    ...prev,
                    produtos: t.produtos ?? [],
                    observacao: t.observacao ? `[Orçamento #${t.orcamentoNumero}] ${t.observacao}` : `[Orçamento #${t.orcamentoNumero}]`,
                    desconto: t.desconto ?? 0,
                    tipoDesconto: t.tipoDesconto ?? 'valor',
                }));
                setPendingTransfer(t);
                toast.current?.show({
                    severity: 'info',
                    summary: `Orçamento #${t.orcamentoNumero}`,
                    detail: `Dados de ${t.nomeCliente} carregados. Confirme a senha do atendente para fechar.`,
                    life: 5000
                });
            } catch { }
            localStorage.removeItem(transferKey);
        }

        return () => {
            if (scalePort) disconnectFromScale();
        };
    }, []);

    useEffect(() => {
        if (!funcionariosCarregados || !usuarioLogado || editingVendaId != null) return;
        const funcionarioLogado = encontrarFuncionarioLogado(funcionarios, usuarioLogado);
        if (!funcionarioLogado) return;

        setVenda(prev => prev.funcionario
            ? prev
            : { ...prev, funcionario: funcionarioLogado }
        );
    }, [funcionariosCarregados, funcionarios, usuarioLogado, editingVendaId]);

    useEffect(() => {
        const raw = sessionStorage.getItem('caixa_prefill');
        if (!raw) return;
        if (!clientesCarregados || !funcionariosCarregados) return;
        try {
            const p = JSON.parse(raw);
            sessionStorage.removeItem('caixa_prefill');
            const somenteDigitos = (v?: string) => (v ?? '').replace(/\D/g, '');
            const normalizarNome = (v?: string) => (v ?? '').trim().toLowerCase();
            const telefonePrefill = somenteDigitos(p.clienteTelefone);
            const clienteNomePrefill = normalizarNome(p.clienteNome);
            const funcionarioNomePrefill = normalizarNome(p.funcionarioNome);

            const clienteEncontrado = clientes.find(c =>
                (telefonePrefill && somenteDigitos(c.telefone) === telefonePrefill) ||
                normalizarNome(c.nomeCompleto) === clienteNomePrefill
            ) ?? null;

            const funcionarioEncontrado = funcionarios.find(f =>
                (p.funcionarioUsuarioId && f.id === Number(p.funcionarioUsuarioId)) ||
                normalizarNome(f.nome) === funcionarioNomePrefill ||
                (!!funcionarioNomePrefill && normalizarNome(f.nome).includes(funcionarioNomePrefill))
            ) ?? null;

            const servicosPrefill = Array.isArray(p.servicos) && p.servicos.length
                ? p.servicos
                : [{ id: p.servicoId, nome: p.servicoNome, preco: p.servicoPreco }];
            const itensServico: ItemVenda[] = servicosPrefill.map((servico: any, indice: number) => ({
                id: -(indice + 1),
                nome: servico.nome || servico.name || 'Serviço',
                valor: servico.cobertoRecorrencia ? 0 : Number(servico.preco ?? servico.price ?? 0),
                quantidade: 1,
                editablePrice: !servico.cobertoRecorrencia,
                tipo: 'servico',
                agendamentoId: Number(p.agendamentoId) || undefined,
                servicoId: servico.id ? String(servico.id) : undefined,
                recorrenciaInclusa: Boolean(servico.cobertoRecorrencia),
            }));

            const observacaoRecorrencia = p.observacaoRecorrencia
                ? `[Recorrência] ${p.observacaoRecorrencia}`
                : '';

            setVenda(prev => ({
                ...prev,
                cliente: clienteEncontrado,
                funcionario: funcionarioEncontrado,
                produtos: itensServico,
                observacao: [prev.observacao, observacaoRecorrencia].filter(Boolean).join('\n'),
            }));

            toast.current?.show({
                severity: p.beneficioRecorrencia?.excedente ? 'warn' : 'info',
                summary: p.beneficioRecorrencia?.excedente ? 'Cobrança adicional necessária' : 'Agendamento carregado',
                detail: p.beneficioRecorrencia?.mensagem
                    ? `${p.beneficioRecorrencia.mensagem} Confira o valor do serviço.`
                    : `${p.clienteNome}${p.servicoNome ? ` — ${p.servicoNome}` : ''}. Confira o valor do serviço.`,
                life: 8000,
            });
        } catch { }
    }, [clientes, funcionarios, clientesCarregados, funcionariosCarregados]);

    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'empresa_selecionada') {
                const eid = e.newValue ? Number(e.newValue) : null;
                setEmpresaId(eid);
                setHistorico([]);
                setViewItem(null);
                setViewDialog(false);
                setSaidaDialog(false);
                setEditingSaidaId(null);
                setFiltroBusca('');
                setFiltroPeriodo('');
                setFiltroDataInicio(null);
                setFiltroDataFim(null);
                void fetchHistorico(eid);
                fetchTurnos(eid);
                fetchRoupasCaixa();
                if (eid) {
                    carregarDadosEmpresaRecibo(eid)
                        .then(setEmpresaInfo)
                        .catch(() => setEmpresaInfo(null));
                } else {
                    setEmpresaInfo(null);
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    useEffect(() => {
        if (!pendingTransfer) return;
        if (funcionarios.length === 0) return;
        const t = pendingTransfer;
        if (t.nomeCliente) {
            const c = clientes.find(x => x.nomeCompleto === t.nomeCliente);
            if (c) setVenda(p => ({ ...p, cliente: c }));
        }
        if (t.funcionario) {
            const f = funcionarios.find(x => x.nome === t.funcionario);
            if (f) {
                if (podePularSenha) {
                    setVenda(p => ({ ...p, funcionario: f }));
                } else {
                    setFuncionarioPendente(f);
                    setSenhaInput('');
                    setSenhaDialog(true);
                }
            }
        }
        // Mantém o vínculo até a venda ser concluída. O Caixa precisa enviá-lo
        // na criação da venda para atualizar o orçamento na mesma transação.
    }, [pendingTransfer, funcionarios, clientes]);

    const fetchBairros = async () => {
        try {
            const res = await api.get('/bairros');
            setBairros((res.data ?? []).map((b: any) => ({ id: b.id, nome: b.nome, taxa: Number(b.taxa) })));
        } catch { }
    };

    const salvarBairro = async () => {
        if (!novoBairroNome.trim()) return showError('Informe o nome do bairro');
        setSalvandoBairro(true);
        try {
            await api.post('/bairros', { nome: novoBairroNome.trim(), taxa: novoBairroTaxa });
            await fetchBairros();
            setNovoBairroNome('');
            setNovoBairroTaxa(null);
            showSuccess('Bairro cadastrado!');
        } catch { showError('Erro ao salvar bairro'); }
        finally { setSalvandoBairro(false); }
    };

    const excluirBairro = async (id: number) => {
        try {
            await api.delete(`/bairros/${id}`);
            await fetchBairros();
            if (bairroSelecionado === id) {
                setBairroSelecionado(null);
                setVenda(prev => ({ ...prev, taxaEntrega: null }));
            }
        } catch { showError('Erro ao excluir bairro'); }
    };

    const fetchProdutos = async (eid?: number | null) => {
        try {
            const empId = eid !== undefined ? eid : empresaId;
            const res = await api.get('/products', { params: empId ? { empresa_id: empId } : {} });
            const data = res.data?.data ?? res.data ?? [];
            if (Array.isArray(data)) {
                setProdutosDisponiveis(data.map((p: any) => ({
                    id: p.id,
                    nome: p.name ?? p.nome,
                    valor: parseFloat(p.price ?? p.preco ?? p.valor ?? 0),
                    unit_type: p.unit_type ?? p.unit ?? p.unidade_medida ?? (p.price_per_kg ? 'kg' : 'unit'),
                    unit: p.unit ?? p.unidade_medida ?? p.unit_type,
                    price_per_kg: p.price_per_kg ? parseFloat(p.price_per_kg) : undefined,
                    sku: p.code ?? p.sku ?? p.codigo ?? '',
                    codigo_barras: p.codigo_barras ?? p.barcode ?? '',
                    currentQuantity: parseFloat(p.currentQuantity ?? p.estoque ?? 0),
                })));
            }
        } catch {
            toast.current?.show({ severity: 'warn', summary: 'Atenção', detail: 'Não foi possível atualizar a lista de produtos. Os dados anteriores foram mantidos.', life: 4000 });
        }
    };

    const fetchRoupasCaixa = async () => {
        setCarregandoRoupasCaixa(true);
        try {
            const res = await api.get('/estoque-roupas');
            const data = res.data?.data ?? res.data ?? [];
            setRoupasDisponiveis(Array.isArray(data) ? data.map((roupa: any) => ({
                id: Number(roupa.id),
                nome: String(roupa.nome ?? ''),
                preco_venda: Number(roupa.preco_venda ?? 0),
                codigo: roupa.codigo ? String(roupa.codigo) : null,
                foto_url: obterFotoRoupaCaixa(roupa),
                variacoes: Array.isArray(roupa.variacoes) ? roupa.variacoes.map((variacao: any) => ({
                    id: Number(variacao.id),
                    cor: variacao.cor ?? null,
                    tamanho: String(variacao.tamanho ?? ''),
                    quantidade_atual: Number(variacao.quantidade_atual ?? 0),
                    estoque_infinito: Boolean(variacao.estoque_infinito),
                })).filter((variacao: VariacaoRoupaCaixa) => variacao.id > 0 && variacao.tamanho) : [],
            })).filter((roupa: RoupaCaixa) => roupa.id > 0 && roupa.nome && roupa.variacoes.length > 0) : []);
        } catch {
            setRoupasDisponiveis([]);
        } finally {
            setCarregandoRoupasCaixa(false);
        }
    };

    useEffect(() => {
        if (carregandoRoupasCaixa || !codigoEtiquetaPendenteRef.current) return;
        const codigoPendente = codigoEtiquetaPendenteRef.current;
        codigoEtiquetaPendenteRef.current = null;
        buscarPorSku(codigoPendente);
    }, [carregandoRoupasCaixa, roupasDisponiveis]);

    const fetchServicosCaixa = async (eid?: number | null) => {
        setCarregandoServicosCaixa(true);
        try {
            // O atalho de serviço do caixa não deve importar o catálogo do Lucro+.
            // No caixa, o único lançamento manual permitido é Recarga, com valor
            // inicial zero para a atendente informar o valor real no atendimento.
            setServicosCaixa([{
                key: 'manual:recarga',
                id: 'recarga',
                name: 'Recarga',
                value: 0,
                origem: 'manual',
            }]);
        } catch {
            setServicosCaixa([]);
        } finally {
            setCarregandoServicosCaixa(false);
        }
    };

    const fetchHistorico = async (eid?: number | null) => {
        const requestId = ++historicoRequestRef.current;
        const id = eid !== undefined ? eid : empresaId;
        setHistoricoErro('');
        if (!id) {
            setHistorico([]);
            setLoadingHistorico(false);
            return;
        }
        setLoadingHistorico(true);
        try {
            // O legado não tem empresa confiável: preservar, mas nunca mesclar ou importar automaticamente.
            setTemSaidasLegadas(!!localStorage.getItem(SAIDAS_KEY) && localStorage.getItem(SAIDAS_KEY) !== '[]');
            const params = { empresa_id: id };
            const [res, resSaidas] = await Promise.all([
                api.get('/vendas', { params }),
                api.get('/financeiro/saidas', { params: { ...params, natureza: 'SAIDA' } }),
            ]);
            if (requestId !== historicoRequestRef.current) return;
            const vendas: HistoricoItem[] = (res.data ?? []).map((v: any) => ({
                _kind: 'venda' as const,
                _uid: `venda-${v.id}`,
                id: v.id,
                criadoEm: v.createdAt ?? v.data,
                funcionario: v.funcionario ? { id: v.funcionario_id, nome: v.funcionario.nomeCompleto, email: v.funcionario.email } : null,
                cliente: v.cliente ? { id: v.cliente_id, nomeCompleto: v.cliente.nomeCompleto, telefone: v.cliente.telefone } : null,
                produtos: (v.itens ?? []).map((it: any, indice: number) => ({
                    id: it.produto_id ?? -Number(it.id ?? indice + 1),
                    nome: it.nome_item ?? it.produto?.name ?? it.produto?.nome ?? it.Product?.name ?? it.product?.name ?? '',
                    valor: Number(it.valor_unitario),
                    quantidade: it.quantidade,
                    editablePrice: it.produto_id != null || it.tipo === 'roupa',
                    valorTotalFixo: Number(it.valor_total),
                    tipo: it.tipo === 'servico' ? 'servico' : (it.tipo === 'roupa' ? 'roupa' : 'produto'),
                    roupa_id: it.roupa_id ? Number(it.roupa_id) : undefined,
                    variacao_id: it.variacao_id ? Number(it.variacao_id) : undefined,
                    agendamentoId: it.agendamento_id ? Number(it.agendamento_id) : undefined,
                    servicoId: it.agendamento_id && it.agendamento_servico_id ? String(it.agendamento_servico_id) : undefined,
                    servicoAgendaCatalogoId: !it.agendamento_id && it.agendamento_servico_id ? String(it.agendamento_servico_id) : undefined,
                    catalogoServicoId: it.catalogo_servico_id ? Number(it.catalogo_servico_id) : undefined,
                })),
                dataVenda: v.data ? new Date(v.data) : null,
                desconto: Number(v.desconto ?? 0),
                tipoDesconto: v.tipo_desconto ?? 'valor',
                cupomCodigo: v.loja_cupom_codigo ?? '',
                cupomId: v.loja_cupom_id ? Number(v.loja_cupom_id) : null,
                taxaEntrega: Number(v.taxa_entrega ?? 0),
                temEntrega: !!(v.endereco_entrega),
                enderecoEntrega: v.endereco_entrega ?? '',
                observacao: v.observacao ?? '',
                cfop: v.cfop ?? '',
                cstCsosn: v.cst_csosn ?? '',
                pagamentos: normalizarPagamentosVenda(v),
                comNota: v.com_nota ?? false,
                valorTotal: Number(v.valor_total ?? 0),
            }));

            const saidas = normalizarSaidasServidor(resSaidas.data ?? []);
            setHistorico(prepararHistorico([...vendas, ...saidas]));
        } catch (error: any) {
            if (requestId !== historicoRequestRef.current) return;
            setHistorico([]);
            setHistoricoErro('Não foi possível atualizar o histórico compartilhado. Tente novamente; nenhum registro foi apagado.');
        } finally {
            if (requestId === historicoRequestRef.current) setLoadingHistorico(false);
        }
    };

    useEffect(() => {
        const subtotal = venda.produtos.reduce((s, p) => s + calcularTotalItem(p), 0);
        const descontoValor = venda.desconto
            ? (venda.tipoDesconto === 'percent' ? subtotal * (venda.desconto / 100) : venda.desconto)
            : 0;
        const taxa = venda.taxaEntrega || 0;
        const total = Math.max(0, subtotal - descontoValor + taxa);
        setVenda(prev => {
            const updated = { ...prev, valorTotal: total };
            if (prev.pagamentos.length === 1) {
                updated.pagamentos = [{ ...prev.pagamentos[0], valor: total }];
            }
            return updated;
        });
    }, [venda.produtos, venda.desconto, venda.tipoDesconto, venda.taxaEntrega]);

    useEffect(() => {
        if (!scaleConnected || scaleReading === null || !produtoSelecionado) return;
        if (isWeightProduct(produtoSelecionado)) return;
        const { isScaleLinked, scaleFactor, fractionDigits } = getUnitInfo(produtoSelecionado);
        if (!isScaleLinked) return;
        const converted = parseFloat((scaleReading * scaleFactor).toFixed(fractionDigits));
        setQtdSelecionada(converted > 0 ? converted : 0);
    }, [scaleReading, scaleConnected]);

    const showSuccess = (m: string) =>
        toast.current?.show({ severity: 'success', summary: 'Sucesso', detail: m, life: 3000 });
    const showError = (m: string) =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: m, life: 5000 });
    const showInfo = (m: string) =>
        toast.current?.show({ severity: 'info', summary: 'Info', detail: m, life: 5000 });
    const fmtMoeda = (v: number) =>
        Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtData = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '-';

    const aplicarCupomCaixa = async () => {
        const codigo = venda.cupomCodigo.trim().toUpperCase();
        if (!codigo) return showError('Informe o código do cupom.');
        if (!venda.cliente?.id) return showError('Selecione o cliente antes de aplicar o cupom.');
        if (!venda.produtos.length) return showError('Adicione os produtos antes de aplicar o cupom.');
        const valorBruto = venda.produtos.reduce((total, item) => total + calcularTotalItem(item), 0);
        setAplicandoCupom(true);
        try {
            const resposta = await lojaOnlineService.validarCupomCaixa({
                codigo,
                cliente_id: venda.cliente.id,
                valor_bruto: Number(valorBruto.toFixed(2)),
                itens: venda.produtos.map((item) => ({
                    produto_id: item.id > 0 ? item.id : null,
                    quantidade: item.quantidade,
                    valor_unitario: item.valor,
                    valor_total: calcularTotalItem(item),
                })),
            });
            const cupom = resposta.data;
            setVenda((prev) => ({
                ...prev,
                cupomCodigo: cupom.codigo,
                cupomId: cupom.cupom_id ?? null,
                desconto: cupom.desconto,
                tipoDesconto: 'valor',
            }));
            showSuccess(`Cupom aplicado: ${fmtMoeda(cupom.desconto)} de desconto.`);
        } catch (error: any) {
            showError(error?.response?.data?.message ?? error?.response?.data?.error ?? error?.message ?? 'Não foi possível aplicar o cupom.');
        } finally {
            setAplicandoCupom(false);
        }
    };

    const removerCupomCaixa = () => setVenda((prev) => ({ ...prev, cupomCodigo: '', cupomId: null, desconto: null, tipoDesconto: 'valor' }));

    const gerarRelatorioDia = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');

        const hoje = new Date();
        const hojeStr = hoje.toLocaleDateString('pt-BR');
        const nomeEmpresa = empresaInfo?.nomeEmpresa ?? empresaInfo?.nome ?? 'Empresa';

        const vendas = historico.filter(h => {
            if (h._kind !== 'venda') return false;
            const d = new Date(h.criadoEm);
            return d.toLocaleDateString('pt-BR') === hojeStr;
        }) as (Venda & { _kind: 'venda'; criadoEm: string })[];

        const saidas = historico.filter(h => {
            if (h._kind !== 'saida') return false;
            const d = new Date(h.criadoEm);
            return d.toLocaleDateString('pt-BR') === hojeStr;
        }) as (Saida & { _kind: 'saida'; criadoEm: string })[];

        const totalVendas = vendas.reduce((s, v) => s + (v.valorTotal ?? 0), 0);
        const totalSaidas = saidas.reduce((s, v) => s + (Number(v.valor) ?? 0), 0);

        const porForma: Record<string, number> = { PIX: 0, DINHEIRO: 0, CARTAO: 0 };
        vendas.forEach(v => v.pagamentos?.forEach(p => { porForma[p.forma] = (porForma[p.forma] ?? 0) + p.valor; }));

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const W = doc.internal.pageSize.getWidth();

        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, W, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(nomeEmpresa, 14, 12);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Relatório do Caixa — ${hojeStr}`, 14, 21);
        doc.text(`Gerado em: ${hoje.toLocaleTimeString('pt-BR')}`, W - 14, 21, { align: 'right' });
        doc.setTextColor(0, 0, 0);

        let y = 36;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo do Dia', 14, y);
        y += 4;

        autoTable(doc, {
            startY: y,
            head: [['Indicador', 'Valor']],
            body: [
                ['Total de Vendas', fmtMoeda(totalVendas)],
                [`Vendas (${vendas.length})`, `${vendas.length} registro${vendas.length !== 1 ? 's' : ''}`],
                ['PIX', fmtMoeda(porForma.PIX)],
                ['Dinheiro', fmtMoeda(porForma.DINHEIRO)],
                ['Cartão', fmtMoeda(porForma.CARTAO)],
                ['Total Saídas', fmtMoeda(totalSaidas)],
                ['Saldo Líquido', fmtMoeda(totalVendas - totalSaidas)],
            ],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [37, 99, 235] },
            columnStyles: { 1: { halign: 'right' } },
            margin: { left: 14, right: 14 },
        });

        y = (doc as any).lastAutoTable.finalY + 10;

        if (vendas.length > 0) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Detalhamento das Vendas', 14, y);
            y += 4;

            const rows: any[] = [];
            vendas.forEach((v, i) => {
                const hora = new Date(v.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const itens = (v.produtos ?? []).map(p => `${p.nome} x${p.quantidade}`).join(', ');
                const pgto = (v.pagamentos ?? []).map(p => p.forma).join(', ');
                rows.push([i + 1, hora, v.funcionario?.nome ?? '-', v.cliente?.nomeCompleto ?? 'Sem cliente', itens, pgto, fmtMoeda(v.valorTotal)]);
            });

            autoTable(doc, {
                startY: y,
                head: [['#', 'Hora', 'Funcionário', 'Cliente', 'Itens', 'Pagamento', 'Total']],
                body: rows,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [37, 99, 235] },
                columnStyles: { 6: { halign: 'right' } },
                margin: { left: 14, right: 14 },
            });
        }

        if (saidas.length > 0) {
            y = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Saídas do Dia', 14, y);
            y += 4;

            autoTable(doc, {
                startY: y,
                head: [['Tipo', 'Descrição', 'Valor']],
                body: saidas.map(s => [s.tipo, s.descricao, fmtMoeda(Number(s.valor ?? 0))]),
                styles: { fontSize: 8 },
                headStyles: { fillColor: [220, 38, 38] },
                columnStyles: { 2: { halign: 'right' } },
                margin: { left: 14, right: 14 },
            });
        }

        const dataArq = hoje.toLocaleDateString('pt-BR').replace(/\//g, '-');
        doc.save(`relatorio_caixa_${dataArq}.pdf`);
    };

    const gerarRelatorioFiltrado = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');

        const agora = new Date();
        const nomeEmpresa = empresaInfo?.nomeEmpresa ?? empresaInfo?.nome ?? 'Empresa';

        const periodoLabel = filtroPeriodo === 'hoje' ? 'Hoje'
            : filtroPeriodo === 'semana' ? 'Esta Semana'
            : filtroPeriodo === 'mes' ? 'Este Mês'
            : filtroPeriodo === 'custom'
                ? `${filtroDataInicio?.toLocaleDateString('pt-BR') ?? '?'} a ${filtroDataFim?.toLocaleDateString('pt-BR') ?? '?'}`
            : 'Todos os Registros';

        const vendas = historicoFiltrado.filter(h => h._kind === 'venda') as (Venda & { _kind: 'venda'; criadoEm: string })[];
        const saidas = historicoFiltrado.filter(h => h._kind === 'saida') as (Saida & { _kind: 'saida'; criadoEm: string })[];

        const totalVendas = vendas.reduce((s, v) => s + (v.valorTotal ?? 0), 0);
        const totalSaidas = saidas.reduce((s, v) => s + (Number(v.valor) ?? 0), 0);
        const porForma: Record<string, number> = { PIX: 0, DINHEIRO: 0, CARTAO: 0 };
        vendas.forEach(v => v.pagamentos?.forEach(p => { porForma[p.forma] = (porForma[p.forma] ?? 0) + p.valor; }));

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const W = doc.internal.pageSize.getWidth();

        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, W, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(nomeEmpresa, 14, 12);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Relatório de Vendas — ${periodoLabel}`, 14, 21);
        doc.text(`Gerado em: ${agora.toLocaleString('pt-BR')}`, W - 14, 21, { align: 'right' });
        doc.setTextColor(0, 0, 0);

        if (filtroBusca) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text(`Filtro de busca: "${filtroBusca}"`, 14, 33);
            doc.setTextColor(0, 0, 0);
        }

        let y = filtroBusca ? 40 : 36;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo', 14, y);
        y += 4;

        autoTable(doc, {
            startY: y,
            head: [['Indicador', 'Valor']],
            body: [
                ['Total de Vendas', fmtMoeda(totalVendas)],
                [`Qtd. Vendas`, `${vendas.length} venda${vendas.length !== 1 ? 's' : ''}`],
                ['PIX', fmtMoeda(porForma.PIX)],
                ['Dinheiro', fmtMoeda(porForma.DINHEIRO)],
                ['Cartão', fmtMoeda(porForma.CARTAO)],
                ['Total Saídas', fmtMoeda(totalSaidas)],
                ['Saldo Líquido', fmtMoeda(totalVendas - totalSaidas)],
            ],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [37, 99, 235] },
            columnStyles: { 1: { halign: 'right' } },
            margin: { left: 14, right: 14 },
        });

        y = (doc as any).lastAutoTable.finalY + 10;

        if (vendas.length > 0) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Detalhamento das Vendas', 14, y);
            y += 4;
            const rows: any[] = [];
            vendas.forEach((v, i) => {
                const data = new Date(v.criadoEm).toLocaleDateString('pt-BR');
                const hora = new Date(v.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const itens = (v.produtos ?? []).map(p => `${p.nome} x${p.quantidade}`).join(', ');
                const pgto = (v.pagamentos ?? []).map(p => p.forma).join(', ');
                rows.push([i + 1, `${data} ${hora}`, v.funcionario?.nome ?? '-', v.cliente?.nomeCompleto ?? 'Consumidor', itens, pgto, fmtMoeda(v.valorTotal)]);
            });
            autoTable(doc, {
                startY: y,
                head: [['#', 'Data/Hora', 'Funcionário', 'Cliente', 'Itens', 'Pagamento', 'Total']],
                body: rows,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [37, 99, 235] },
                columnStyles: { 6: { halign: 'right' } },
                margin: { left: 14, right: 14 },
            });
        }

        if (saidas.length > 0) {
            y = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Saídas', 14, y);
            y += 4;
            autoTable(doc, {
                startY: y,
                head: [['Tipo', 'Descrição', 'Valor']],
                body: saidas.map(s => [s.tipo, s.descricao, fmtMoeda(Number(s.valor ?? 0))]),
                styles: { fontSize: 8 },
                headStyles: { fillColor: [220, 38, 38] },
                columnStyles: { 2: { halign: 'right' } },
                margin: { left: 14, right: 14 },
            });
        }

        const periodoArq = periodoLabel.replace(/\s+/g, '_').replace(/\//g, '-');
        doc.save(`relatorio_vendas_${periodoArq}_${agora.toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    };

    const onFuncionarioChange = (func: Funcionario | null) => {
        if (!func) return setVenda(p => ({ ...p, funcionario: null }));
        if (podePularSenha) {
            setVenda(p => ({ ...p, funcionario: func }));
            showSuccess(`Funcionário ${func.nome} selecionado`);
            return;
        }
        setFuncionarioPendente(func);
        setSenhaInput('');
        setSenhaDialog(true);
    };

    const confirmarSenhaFuncionario = async () => {
        if (!senhaInput.trim()) return showError('Digite a senha do funcionário');
        if (!funcionarioPendente?.email) return showError('Funcionário sem e-mail cadastrado');
        setSenhaCarregando(true);
        try {
            const resp = await api.post('/auth/login', {
                email: funcionarioPendente.email,
                senha: senhaInput,
            }, { skipAuthInterceptor: true } as any);
            const userData = resp.data?.user ?? {};
            const funcComComissao: Funcionario = {
                ...funcionarioPendente,
                comissao_tipo: userData.comissao_tipo ?? null,
                comissao_valor: userData.comissao_valor != null ? Number(userData.comissao_valor) : null,
            };
            setVenda(p => ({ ...p, funcionario: funcComComissao }));
            setFuncionarioAutenticadoId(funcComComissao.id);
            setSenhaDialog(false);
            setFuncionarioPendente(null);
            setSenhaInput('');
            showSuccess(`Funcionário ${funcionarioPendente.nome} autenticado`);
        } catch (err: any) {
            showError(err?.message || 'Senha incorreta');
        } finally {
            setSenhaCarregando(false);
        }
    };

    const senhaFooter = (
        <div className="flex gap-2 justify-content-end">
            <Button label="Cancelar" icon="pi pi-times" className="p-button-text"
                onClick={() => { setSenhaDialog(false); setFuncionarioPendente(null); setSenhaInput(''); }}
                disabled={senhaCarregando} />
            <Button label="Confirmar" icon="pi pi-check"
                onClick={confirmarSenhaFuncionario} loading={senhaCarregando} />
        </div>
    );
    const reciboFooter = (
        <div className="flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="flex align-items-center gap-2">
                <span className="text-sm text-color-secondary">Formato:</span>
                <div className="flex" style={{ border: '1px solid #dee2e6', borderRadius: 6, overflow: 'hidden' }}>
                    {formatosRecibo.map(f => (
                        <button key={f.value} type="button"
                            onClick={() => setTipoCupom(f.value)}
                            style={{ padding: '0 12px', height: 32, fontSize: '0.78rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: tipoCupom === f.value ? '#7c3aed' : '#fff', color: tipoCupom === f.value ? '#fff' : '#555' }}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <Button label="Imprimir" icon="pi pi-print" severity="help" size="small"
                    onClick={imprimirRecibo}
                    tooltip={!editingVendaId && !vendaConfirmadaId ? 'Confirme a venda para gerar o código do recibo' : undefined}
                    disabled={confirmandoVenda || emitindoNota || (!editingVendaId && !vendaConfirmadaId)} />
            </div>
            <div className="flex gap-2">
                <Button label="Cancelar" icon="pi pi-times" className="p-button-text"
                    onClick={() => {
                        if (vendaConfirmadaId) resetVenda();
                        setShowReciboDialog(false);
                    }}
                    disabled={confirmandoVenda || emitindoNota}
                />
                <Button
                    label={vendaConfirmadaId ? 'Finalizar' : (editingVendaId ? 'Salvar Edição' : 'Confirmar Venda')}
                    icon={vendaConfirmadaId ? 'pi pi-arrow-right' : 'pi pi-check'}
                    onClick={vendaConfirmadaId
                        ? () => { resetVenda(); setShowReciboDialog(false); }
                        : confirmarVenda}
                    loading={confirmandoVenda || emitindoNota}
                    disabled={confirmandoVenda || emitindoNota}
                />
            </div>
        </div>
    );
    const saidaFooter = (
        <div className="flex gap-2 justify-content-end">
            <Button label="Cancelar" icon="pi pi-times" className="p-button-text"
                disabled={salvandoSaida}
                onClick={() => { setSaidaDialog(false); setEditingSaidaId(null); setSaida(initialSaida); }} />
            <Button label={editingSaidaId ? 'Salvar Alterações' : 'Registrar Saída'} icon="pi pi-check" loading={salvandoSaida} disabled={salvandoSaida} onClick={handleSaidaSubmit} />
        </div>
    );
    const resumoFooter = (
        <div className="flex gap-2 justify-content-end">
            <Button
                label="Voltar"
                icon="pi pi-arrow-left"
                className="p-button-text"
                disabled={emitindoNota}
                onClick={() => {
                    setResumoFiscalDialog(false);
                    setShowEmitirNotaDialog(true);
                }}
            />

            <Button
                label={`Confirmar e Emitir ${tipoNotaFiscal.toUpperCase()}`}
                icon="pi pi-check"
                loading={emitindoNota}
                disabled={emitindoNota}
                onClick={emitirNotaFiscal}
            />
        </div>
    );

    const tipoBody = (item: HistoricoItem) => (
        <Tag value={item._kind === 'venda' ? 'Venda' : 'Saída'} severity={item._kind === 'venda' ? 'success' : 'warning'} icon={item._kind === 'venda' ? 'pi pi-shopping-cart' : 'pi pi-arrow-up-right'} />
    );
    const descricaoBody = (item: HistoricoItem) => item._kind === 'venda' ? (item.cliente?.nomeCompleto ?? 'Consumidor') : item.tipo;
    const vendedorBody = (item: HistoricoItem) => item._kind === 'venda' ? (item.funcionario?.nome ?? '-') : '-';
    const valorBody = (item: HistoricoItem) => fmtMoeda(item._kind === 'venda' ? item.valorTotal : (item.valor || 0));
    const dataBody = (item: HistoricoItem) => fmtData(item._kind === 'venda' ? item.dataVenda : item.data);
    const acoesBody = (item: HistoricoItem) => (
        <div className="flex gap-2">
            <Button icon="pi pi-eye" rounded outlined severity="info" tooltip="Visualizar" onClick={() => visualizar(item)} />
            <Button icon="pi pi-pencil" rounded outlined tooltip="Editar" onClick={() => editar(item)} />
            {item._kind === 'venda' && (
                <Button
                    icon="pi pi-print"
                    rounded
                    outlined
                    severity="help"
                    tooltip="Imprimir recibo"
                    onClick={() => {
                        setTipoCupomHistorico('58mm');
                        setVendaHistoricoParaImprimir(item);
                    }}
                />
            )}
            <Button icon="pi pi-trash" rounded outlined severity="danger" tooltip="Excluir" onClick={() => excluir(item)} />
        </div>
    );

    const historicoFiltrado = historico.filter(item => {
        if (filtroBusca) {
            const busca = filtroBusca.toLowerCase();
            const codigoVenda = item._kind === 'venda' && item.id ? String(item.id) : '';
            const buscaCodigo = busca.replace(/^#/, '');
            const desc = item._kind === 'venda'
                ? (item.cliente?.nomeCompleto ?? 'Consumidor').toLowerCase()
                : (item.tipo ?? '').toLowerCase();
            const descExtra = item._kind === 'saida' ? (item.descricao ?? '').toLowerCase() : '';
            const vendedor = item._kind === 'venda' ? (item.funcionario?.nome ?? '').toLowerCase() : '';
            if (!desc.includes(busca) && !vendedor.includes(busca) && !descExtra.includes(busca) && codigoVenda !== buscaCodigo) return false;
        }
        if (filtroPeriodo) {
            const raw = item._kind === 'venda' ? (item.dataVenda ?? item.criadoEm) : (item.data ?? item.criadoEm);
            const itemDate = raw ? new Date(raw) : null;
            if (!itemDate) return false;
            const agora = new Date();
            if (filtroPeriodo === 'hoje') {
                return itemDate.toDateString() === agora.toDateString();
            }
            if (filtroPeriodo === 'semana') {
                const inicio = new Date(agora);
                inicio.setDate(agora.getDate() - agora.getDay());
                inicio.setHours(0, 0, 0, 0);
                return itemDate >= inicio;
            }
            if (filtroPeriodo === 'mes') {
                return itemDate.getMonth() === agora.getMonth() && itemDate.getFullYear() === agora.getFullYear();
            }
            if (filtroPeriodo === 'custom') {
                if (filtroDataInicio) { const di = new Date(filtroDataInicio); di.setHours(0,0,0,0); if (itemDate < di) return false; }
                if (filtroDataFim)    { const df = new Date(filtroDataFim);    df.setHours(23,59,59,999); if (itemDate > df) return false; }
            }
        }
        return true;
    });

    useEffect(() => {
        const executarAtalhoCaixa = (event: KeyboardEvent) => {
            if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
            if (document.querySelector('.p-dialog-mask')) return;

            switch (event.key) {
                case 'F2':
                    event.preventDefault();
                    skuInputRef.current?.focus();
                    skuInputRef.current?.select();
                    break;
                case 'F4':
                    event.preventDefault();
                    adicionarPagamento();
                    break;
                case 'F5':
                    event.preventDefault();
                    handleVendaSubmit();
                    break;
                case 'F8':
                    event.preventDefault();
                    resetVenda();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', executarAtalhoCaixa);
        return () => window.removeEventListener('keydown', executarAtalhoCaixa);
    });

    const scaleStatusIcon = scaleConnected ? 'pi-circle-on' : 'pi-circle-off';
    const scaleStatusColor = scaleConnected ? '#22c55e' : '#ef4444';

    const limitesQtdRoupa = limitesQuantidadeRoupa(variacaoRoupaSelecionada);

    return (
        <div className="grid input-page">
            <Toast ref={toast} />
            <ConfirmDialog />
            <style>{`
                .green-select .p-button.p-highlight,
                .green-select .p-button.p-highlight:hover,
                .green-select .p-button.p-highlight:focus {
                    background-color: #22c55e !important;
                    border-color: #22c55e !important;
                    color: #fff !important;
                    box-shadow: none !important;
                }
                .green-select .p-button:not(.p-highlight):hover {
                    background-color: rgba(34, 197, 94, 0.1) !important;
                    border-color: #22c55e !important;
                    color: #16a34a !important;
                }
            `}</style>

            <div className="col-12">
                <div className="card">
                    <div className="flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                        <div className="flex align-items-center gap-3 flex-wrap">
                            <h5 className="m-0">{editingVendaId ? 'Editar Venda' : 'Nova Venda'}</h5>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: caixaAberto ? '#dcfce7' : '#fee2e2', color: caixaAberto ? '#16a34a' : '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>
                                <i className={`pi ${caixaAberto ? 'pi-lock-open' : 'pi-lock'}`} style={{ fontSize: '0.75rem' }} />
                                {caixaAberto ? (turnosAbertos.length === 1 ? `Caixa Aberto — ${turnosAbertos[0].func_abertura_nome}` : `${turnosAbertos.length} Caixas Abertos`) : 'Caixa Fechado'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: scaleConnected ? '#dcfce7' : '#f3f4f6', color: scaleConnected ? '#16a34a' : '#6b7280', fontSize: '0.8rem', fontWeight: 500 }}>
                                <i className={`pi ${scaleStatusIcon}`} style={{ fontSize: '0.7rem', color: scaleStatusColor }} />
                                <span>Balança {scaleConnected ? 'Conectada' : 'Desconectada'}</span>
                                {!scaleConnected && scaleSupported && (
                                    <Button label="Conectar" icon="pi pi-plug" text size="small" onClick={connectToScale} loading={isReadingScale} style={{ padding: '2px 8px', fontSize: '0.7rem' }} />
                                )}
                                {scaleConnected && scaleReading !== null && (
                                    <span style={{ marginLeft: '4px', fontWeight: 600 }}>{scaleReading.toFixed(3)} kg</span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap cash-page-actions">
                            <Button label="Abrir Caixa"      icon="pi pi-lock-open"      severity="success"   outlined disabled={caixaAberto}  onClick={() => { setFuncAberturaId(null); setValAberturaInput(null); setAberturaCaixaDialog(true); }} />
                            <Button label="Fechar Caixa"     icon="pi pi-lock"            severity="danger"    outlined disabled={!caixaAberto} onClick={() => { setTurnoFechamentoId(turnosAbertos.length === 1 ? turnosAbertos[0].id : null); setFuncFechamentoId(null); setValFechamentoInput(null); setFechamentoCaixaDialog(true); }} />
                            <Button label="Turnos"           icon="pi pi-history"         severity="secondary" outlined onClick={() => setTurnosDialog(true)} />
                            <Button label="Bairros"          icon="pi pi-map-marker"      severity="secondary" outlined onClick={() => setBairroDialog(true)} />
                            <Button label="Cadastrar Saída"  icon="pi pi-arrow-up-right"  outlined             onClick={abrirNovaSaida} />
                            <Button label="Relatório do Dia" icon="pi pi-file-pdf"         severity="help"     outlined onClick={gerarRelatorioDia} />
                            <Button label="Mais Vendidos"    icon="pi pi-chart-bar"         severity="help"     outlined onClick={() => router.push('/uikit/relatorios-produtos?aba=vendas')} />
                        </div>
                    </div>

                    <div className="flex align-items-center gap-2 flex-wrap mb-3 p-2 border-round cash-shortcuts" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <span className="text-sm font-semibold text-color-secondary mr-1">
                            <i className="pi pi-bolt mr-1" />
                            Atalhos
                        </span>
                        <Button label="F2 Buscar produto" text size="small" onClick={() => { skuInputRef.current?.focus(); skuInputRef.current?.select(); }} />
                        <Button label="F4 Adicionar pagamento" text size="small" onClick={adicionarPagamento} />
                        <Button label="F5 Finalizar venda" text size="small" onClick={handleVendaSubmit} />
                        <Button label="F8 Limpar" text size="small" severity="secondary" onClick={resetVenda} />
                    </div>

                    <div className="grid formgrid">
                        <div className="col-12 md:col-4 field">
                            <label>Funcionário *</label>
                            <Dropdown options={funcionarios} value={venda.funcionario} onChange={(e) => onFuncionarioChange(e.value)} optionLabel="nome" dataKey="id" placeholder="Selecione o funcionário" filter emptyMessage="Nenhum funcionário cadastrado" className="w-full" />
                            {venda.funcionario && (() => {
                                const tipo = venda.funcionario.comissao_tipo;
                                const taxa = Number(venda.funcionario.comissao_valor ?? 0);
                                const temComissao = tipo && taxa > 0;
                                const totalServicosAgenda = venda.produtos
                                    .filter(item => item.tipo === 'servico' && item.agendamentoId)
                                    .reduce((total, item) => total + Number(item.valorTotalFixo ?? (item.valor * item.quantidade)), 0);
                                const baseComissao = Math.max(0, venda.valorTotal - totalServicosAgenda);
                                const valorComissao = temComissao && baseComissao > 0 ? (tipo === 'percent' ? (baseComissao * taxa) / 100 : taxa) : 0;
                                return <small className="block mt-1" style={{ color: temComissao ? '#10b981' : '#9ca3af', fontWeight: 500 }}><i className="pi pi-percentage mr-1" />{temComissao ? <>Comissão sobre produtos: {tipo === 'percent' ? `${taxa}%` : fmtMoeda(taxa)}{baseComissao > 0 && <span className="ml-1 font-bold">→ {fmtMoeda(valorComissao)}</span>}</> : 'Comissão: não configurada'}</small>;
                            })()}
                        </div>
                        <div className="col-12 md:col-4 field">
                            <label>Cliente</label>
                            <Dropdown
                                options={clientes}
                                value={clientes.find(c => c.id === venda.cliente?.id) ?? null}
                                dataKey="id"
                                onChange={(e) => {
                                    const cliente: Cliente | null = e.value;
                                    const enderecoAuto = (venda.temEntrega && cliente && (cliente.rua || cliente.cidade))
                                        ? [cliente.rua, cliente.numero, cliente.complemento, cliente.bairro, cliente.cidade, cliente.cep].filter(Boolean).join(', ')
                                        : venda.enderecoEntrega;
                                    setVenda(prev => ({ ...prev, cliente, enderecoEntrega: enderecoAuto }));
                                }}
                                optionLabel="nomeCompleto"
                                placeholder="Consumidor (opcional)"
                                filter showClear
                                emptyMessage="Nenhum cliente cadastrado"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-4 field">
                            <label>Data da Venda</label>
                            <Calendar value={venda.dataVenda} onChange={(e) => setVenda({ ...venda, dataVenda: e.value as Date })} dateFormat="dd/mm/yy" showIcon className="w-full" />
                        </div>
                    </div>

                    <Divider />
                    <h6 className="mb-2">Produtos e serviços *</h6>

                    <div className="flex gap-2 mb-3 align-items-center cash-product-search">
                        <span className="p-input-icon-left flex-1" style={{ maxWidth: 320 }}>
                            <i className="pi pi-barcode" />
                            <InputText
                                ref={skuInputRef}
                                value={skuInput}
                                onChange={e => setSkuInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === 'Tab') {
                                        e.preventDefault();
                                        buscarPorSku(e.currentTarget.value);
                                    }
                                }}
                                placeholder="Buscar por SKU ou cód. de barras..."
                                className="w-full"
                            />
                        </span>
                        <Button
                            icon="pi pi-search"
                            outlined
                            onClick={() => buscarPorSku(skuInput)}
                            tooltip="Buscar produto por SKU"
                            disabled={!skuInput.trim()}
                        />
                    </div>

                    <div className="grid align-items-end">
                        <div className="col-12 md:col-6 field">
                            <label>Produto</label>
                            <Dropdown
                                options={produtosDisponiveis}
                                value={produtoSelecionado}
                                onChange={(e) => handleProductSelect(e.value)}
                                optionLabel="nome"
                                placeholder="Selecione um produto"
                                filter
                                filterValue={filtroProdutoDropdown}
                                onFilter={(e) => setFiltroProdutoDropdown(e.filter)}
                                resetFilterOnHide
                                className="w-full"
                                itemTemplate={(opt: Produto) => {
                                    const ui = getUnitInfo(opt);
                                    return (
                                        <div className="flex justify-content-between align-items-center w-full">
                                            <div>
                                                <div>{opt.nome}</div>
                                                {opt.sku && (
                                                    <div className="text-xs" style={{ color: '#9ca3af' }}>SKU: {opt.sku}</div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 align-items-center">
                                                {ui.suffix && (
                                                    <span className="text-xs text-color-secondary" style={{ background: '#f3f4f6', borderRadius: 4, padding: '1px 5px' }}>
                                                        {ui.suffix.trim()}
                                                    </span>
                                                )}
                                                <span className="text-sm text-color-secondary">{fmtMoeda(opt.valor)}</span>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                        </div>
                        {(() => {
                            const unitInfo = getUnitInfo(produtoSelecionado);
                            const isKgScale = produtoSelecionado ? isWeightProduct(produtoSelecionado) : false;
                            const isBalancaLinked = !isKgScale && unitInfo.isScaleLinked && scaleConnected;
                            return (
                                <div className="col-6 md:col-3 field">
                                    <label>{unitInfo.label}</label>
                                    <InputNumber
                                        inputRef={qtdInputRef}
                                        value={qtdSelecionada}
                                        onValueChange={(e) => setQtdSelecionada(e.value ?? 0)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && produtoSelecionado && qtdSelecionada > 0) {
                                                e.preventDefault();
                                                adicionarProduto();
                                            }
                                        }}
                                        min={0}
                                        step={unitInfo.step}
                                        minFractionDigits={0}
                                        maxFractionDigits={unitInfo.fractionDigits}
                                        locale="pt-BR"
                                        suffix={unitInfo.suffix || undefined}
                                        showButtons
                                        className="w-full"
                                        disabled={isKgScale}
                                    />
                                    {isKgScale && (
                                        <small className="text-color-secondary">Produto por peso - use a balança</small>
                                    )}
                                    {isBalancaLinked && (
                                        <small style={{ color: '#16a34a' }}>
                                            <i className="pi pi-check-circle mr-1" style={{ fontSize: 10 }} />
                                            Vinculado à balança
                                        </small>
                                    )}
                                </div>
                            );
                        })()}
                        <div className="col-6 md:col-3 field">
                            <label>&nbsp;</label>
                            <Button
                                label="Adicionar"
                                icon="pi pi-plus"
                                onClick={adicionarProduto}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {!carregandoServicosCaixa && servicosCaixa.length > 0 && (
                    <div className="grid align-items-end mt-2 p-3 border-round" style={{ background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.16)' }}>
                        <div className="col-12 md:col-9 field mb-0">
                            <label>Adicionar serviço diretamente na comanda</label>
                            <Dropdown
                                options={servicosCaixa}
                                value={servicoCaixaSelecionado?.key ?? null}
                                onChange={(e) => {
                                    const key = typeof e.value === 'string' ? e.value : e.value?.key;
                                    setServicoCaixaSelecionado(
                                        servicosCaixa.find((servico) => servico.key === key) ?? null
                                    );
                                }}
                                optionLabel="name"
                                // O campo value é o preço: não pode identificar a opção, sobretudo quando é zero.
                                optionValue="key"
                                dataKey="key"
                                placeholder={carregandoServicosCaixa ? 'Carregando serviços...' : 'Selecione um serviço'}
                                filter
                                showClear
                                loading={carregandoServicosCaixa}
                                className="w-full"
                                emptyMessage="Nenhum serviço ativo cadastrado"
                                itemTemplate={(servico: ServicoCaixa) => (
                                    <div className="flex justify-content-between align-items-center w-full gap-3">
                                        <span>{servico.name}</span>
                                        <span className="text-sm text-color-secondary">{fmtMoeda(servico.value)}</span>
                                    </div>
                                )}
                            />
                        </div>
                        <div className="col-12 md:col-3 field mb-0">
                            <label>&nbsp;</label>
                            <Button
                                label="Adicionar serviço"
                                icon="pi pi-plus"
                                onClick={adicionarServicoDireto}
                                disabled={!servicoCaixaSelecionado || carregandoServicosCaixa}
                                className="w-full"
                                outlined
                            />
                        </div>
                    </div>

                    )}

                    {roupasDisponiveis.length > 0 && (
                    <div className="grid align-items-end mt-2 p-3 border-round" style={{ background: 'rgba(124, 58, 237, 0.04)', border: '1px solid rgba(124, 58, 237, 0.16)' }}>
                        <div className="col-12 mb-2">
                            <span className="font-semibold"><i className="pi pi-tag mr-2" />Adicionar roupa ao caixa</span>
                            <small className="block text-color-secondary mt-1">A venda baixa a variação escolhida do estoque e pode ser combinada com serviços e produtos.</small>
                        </div>
                        <div className="col-12 md:col-5 field mb-0">
                            <label>Peça</label>
                            <Dropdown
                                options={roupasDisponiveis}
                                value={roupaSelecionada}
                                onChange={(e) => {
                                    setRoupaSelecionada(e.value);
                                    setVariacaoRoupaSelecionada(null);
                                    setQtdRoupaSelecionada(0);
                                    setRoupaVariacaoDialog(Boolean(e.value));
                                }}
                                optionLabel="nome"
                                dataKey="id"
                                placeholder="Selecione uma peça"
                                filter
                                showClear
                                className="w-full"
                                emptyMessage="Nenhuma roupa cadastrada com variação"
                                itemTemplate={(roupa: RoupaCaixa) => (
                                    <div className="flex align-items-center gap-2 w-full" style={{ minWidth: 0 }}>
                                        <MiniaturaRoupaCaixa fotoUrl={roupa.foto_url} nome={roupa.nome} />
                                        <span className="flex-1 white-space-normal" style={{ overflowWrap: 'anywhere' }}>{roupa.nome}</span>
                                        <span className="text-sm text-color-secondary flex-shrink-0">{fmtMoeda(roupa.preco_venda)}</span>
                                    </div>
                                )}
                                valueTemplate={(roupa: RoupaCaixa | null) => roupa ? (
                                    <div className="flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                        <MiniaturaRoupaCaixa fotoUrl={roupa.foto_url} nome={roupa.nome} />
                                        <span className="overflow-hidden text-overflow-ellipsis">{roupa.nome}</span>
                                    </div>
                                ) : <span className="text-color-secondary">Selecione uma peça</span>}
                            />
                        </div>
                        <div className="col-12 md:col-3 field mb-0">
                            <label>Variação</label>
                            <Dropdown
                                options={roupaSelecionada?.variacoes ?? []}
                                value={variacaoRoupaSelecionada}
                                onChange={(e) => {
                                    setVariacaoRoupaSelecionada(e.value);
                                    setQtdRoupaSelecionada(e.value?.estoque_infinito || Number(e.value?.quantidade_atual ?? 0) > 0 ? 1 : 0);
                                }}
                                optionLabel="tamanho"
                                dataKey="id"
                                placeholder="Tamanho / cor"
                                className="w-full"
                                disabled={!roupaSelecionada}
                                itemTemplate={(variacao: VariacaoRoupaCaixa) => <span>{variacao.tamanho}{variacao.cor ? ` / ${variacao.cor}` : ''} · estoque: {variacao.estoque_infinito ? '∞ infinito' : variacao.quantidade_atual}</span>}
                                valueTemplate={(variacao: VariacaoRoupaCaixa | null) => variacao ? <span>{variacao.tamanho}{variacao.cor ? ` / ${variacao.cor}` : ''}</span> : <span className="text-color-secondary">Tamanho / cor</span>}
                            />
                        </div>
                        <div className="col-6 md:col-2 field mb-0">
                            <label>Quantidade</label>
                            <InputNumber value={roupaSelecionada ? qtdRoupaSelecionada : 0} onValueChange={(e) => setQtdRoupaSelecionada(e.value ?? 0)} min={limitesQtdRoupa.min} max={limitesQtdRoupa.max} maxFractionDigits={0} useGrouping={false} className="w-full" disabled={limitesQtdRoupa.disabled} />
                        </div>
                        <div className="col-6 md:col-2 field mb-0">
                            <label>&nbsp;</label>
                            <Button label="Adicionar" icon="pi pi-plus" onClick={adicionarRoupa} disabled={!roupaSelecionada || !variacaoRoupaSelecionada || qtdRoupaSelecionada < 1 || (!variacaoRoupaSelecionada.estoque_infinito && qtdRoupaSelecionada > Number(variacaoRoupaSelecionada?.quantidade_atual ?? 0))} className="w-full" outlined />
                        </div>
                    </div>
                    )}

                    <Dialog
                        header={roupaSelecionada ? `Escolher tamanho e cor — ${roupaSelecionada.nome}` : 'Escolher variação'}
                        visible={roupaVariacaoDialog}
                        modal
                        style={{ width: '460px', maxWidth: 'calc(100vw - 2rem)' }}
                        onHide={() => setRoupaVariacaoDialog(false)}
                        footer={
                            <div className="flex justify-content-end gap-2">
                                <Button label="Cancelar" icon="pi pi-times" text onClick={() => setRoupaVariacaoDialog(false)} />
                                <Button
                                    label="Adicionar ao caixa"
                                    icon="pi pi-plus"
                                    onClick={adicionarRoupa}
                                    disabled={!variacaoRoupaSelecionada || qtdRoupaSelecionada < 1 || (!variacaoRoupaSelecionada.estoque_infinito && qtdRoupaSelecionada > Number(variacaoRoupaSelecionada?.quantidade_atual ?? 0))}
                                />
                            </div>
                        }
                    >
                        <div className="flex flex-column gap-3">
                            <small className="text-color-secondary">Escolha as características da peça e confira a quantidade disponível antes de adicionar à venda.</small>
                            <div className="field m-0">
                                <label htmlFor="caixa-variacao-roupa">Tamanho e cor *</label>
                                <Dropdown
                                    inputId="caixa-variacao-roupa"
                                    options={roupaSelecionada?.variacoes ?? []}
                                    value={variacaoRoupaSelecionada}
                                    onChange={(e) => {
                                        setVariacaoRoupaSelecionada(e.value);
                                        setQtdRoupaSelecionada(e.value?.estoque_infinito || Number(e.value?.quantidade_atual ?? 0) > 0 ? 1 : 0);
                                    }}
                                    optionLabel="tamanho"
                                    dataKey="id"
                                    placeholder="Selecione tamanho / cor"
                                    className="w-full"
                                    itemTemplate={(variacao: VariacaoRoupaCaixa) => (
                                        <div className="flex justify-content-between align-items-center gap-2">
                                            <span>{variacao.tamanho}{variacao.cor ? ` / ${variacao.cor}` : ''}</span>
                                            <span className={variacao.estoque_infinito || variacao.quantidade_atual > 0 ? 'text-color-secondary' : 'text-red-500'}>{variacao.estoque_infinito ? '∞ disponível' : `${variacao.quantidade_atual} disponível(is)`}</span>
                                        </div>
                                    )}
                                    valueTemplate={(variacao: VariacaoRoupaCaixa | null) => variacao ? <span>{variacao.tamanho}{variacao.cor ? ` / ${variacao.cor}` : ''}</span> : <span className="text-color-secondary">Selecione tamanho / cor</span>}
                                />
                            </div>
                            {variacaoRoupaSelecionada && (
                                <div className="p-3 border-round" style={{ background: variacaoRoupaSelecionada.estoque_infinito || variacaoRoupaSelecionada.quantidade_atual > 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)' }}>
                                    <div className="flex justify-content-between align-items-center">
                                        <span className="font-semibold">Estoque desta variação</span>
                                        <span className={variacaoRoupaSelecionada.estoque_infinito || variacaoRoupaSelecionada.quantidade_atual > 0 ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{variacaoRoupaSelecionada.estoque_infinito ? '∞ infinito' : `${variacaoRoupaSelecionada.quantidade_atual} unidade(s)`}</span>
                                    </div>
                                </div>
                            )}
                            <div className="field m-0">
                                <label htmlFor="caixa-quantidade-roupa">Quantidade *</label>
                                <InputNumber inputId="caixa-quantidade-roupa" value={qtdRoupaSelecionada} onValueChange={(e) => setQtdRoupaSelecionada(e.value ?? 0)} min={limitesQtdRoupa.min} max={limitesQtdRoupa.max} maxFractionDigits={0} useGrouping={false} className="w-full" disabled={limitesQtdRoupa.disabled} />
                            </div>
                            {variacaoRoupaSelecionada && !variacaoRoupaSelecionada.estoque_infinito && qtdRoupaSelecionada > variacaoRoupaSelecionada.quantidade_atual && <small className="text-red-500">A quantidade informada é maior que o estoque desta variação.</small>}
                        </div>
                    </Dialog>

                    {editingVendaId && agendamentoEdicaoId && (
                        <div className="grid align-items-end mt-2 p-3 border-round" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <div className="col-12 mb-2">
                                <span className="font-semibold"><i className="pi pi-calendar-plus mr-2" />Adicionar serviço do agendamento</span>
                                <small className="block text-color-secondary mt-1">Serviços ativos da mesma unidade. O profissional e a comissão continuam vinculados ao agendamento.</small>
                            </div>
                            <div className="col-12 md:col-9 field mb-0">
                                <label>Serviço</label>
                                <Dropdown
                                    options={servicosDisponiveis}
                                    value={servicoSelecionado}
                                    onChange={(e) => setServicoSelecionado(e.value)}
                                    optionLabel="nome"
                                    dataKey="id"
                                    placeholder={carregandoServicos ? 'Carregando serviços...' : 'Selecione um serviço'}
                                    filter
                                    showClear
                                    loading={carregandoServicos}
                                    disabled={carregandoServicos}
                                    emptyMessage="Nenhum serviço ativo nesta unidade"
                                    className="w-full"
                                    itemTemplate={(servico: ServicoAgenda) => (
                                        <div className="flex justify-content-between align-items-center w-full gap-3">
                                            <span>{servico.nome}</span>
                                            <span className="text-sm text-color-secondary">{fmtMoeda(servico.preco)}</span>
                                        </div>
                                    )}
                                />
                            </div>
                            <div className="col-12 md:col-3 field mb-0">
                                <label>&nbsp;</label>
                                <Button
                                    label="Adicionar serviço"
                                    icon="pi pi-plus"
                                    onClick={adicionarServico}
                                    disabled={!servicoSelecionado || carregandoServicos}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}

                    <div className="resumo-venda mt-3 p-3 border-round" style={{ background: 'rgba(21, 101, 192, 0.04)', border: '1px solid rgba(21, 101, 192, 0.12)' }}>
                        {venda.produtos.length === 0 ? <div className="text-center text-color-secondary py-3"><i className="pi pi-shopping-bag mr-2" />Nenhum produto adicionado</div> : venda.produtos.map((item, idx) => (<div key={idx} className={`py-2 ${idx > 0 ? 'border-top-1 surface-border' : ''}`}><div className="flex justify-content-between align-items-center mb-1"><span className="font-semibold">{item.nome}{item.recorrenciaInclusa && <small className="ml-2" style={{ color: '#7c3aed' }}><i className="pi pi-star-fill mr-1" />Incluso na recorrência</small>}</span><span className="font-bold text-primary">{fmtMoeda(calcularTotalItem(item))}</span></div><div className="flex justify-content-between align-items-center"><div className="flex align-items-center gap-2"><Button icon="pi pi-minus" rounded text size="small" onClick={() => { const _i = getUnitInfo(item as any); const q = Number(item.quantidade); atualizarQtd(item.id, Math.max(_i.step, parseFloat((q - _i.step).toFixed(_i.fractionDigits)))); }} style={{ width: '28px', height: '28px' }} /><span className="font-semibold" style={{ minWidth: '24px', textAlign: 'center' }}>{Number(item.quantidade).toFixed(getUnitInfo(item as any).fractionDigits)}</span><Button icon="pi pi-plus" rounded text size="small" onClick={() => { const _i = getUnitInfo(item as any); const q = Number(item.quantidade); const novaQtd = parseFloat((q + _i.step).toFixed(_i.fractionDigits)); const estoque = Number(produtosDisponiveis.find(p => p.id === item.id)?.currentQuantity ?? -1); if (estoque >= 0 && novaQtd > estoque) { showError(`Estoque insuficiente para "${item.nome}" — disponível: ${estoque}`); return; } atualizarQtd(item.id, novaQtd); }} style={{ width: '28px', height: '28px' }} />{item.editablePrice ? (<InputNumber value={item.valor > 0 ? item.valor : null} onValueChange={e => atualizarValorItem(item.id, e.value ?? 0)} mode="currency" currency="BRL" locale="pt-BR" placeholder="R$ 0,00" inputClassName="w-full" style={{ width: '120px', height: '28px' }} />) : (<span className="text-sm text-color-secondary ml-2">× {fmtMoeda(item.valor)}</span>)}</div><Button icon="pi pi-trash" rounded text severity="danger" size="small" onClick={() => removerItem(item.id)} /></div></div>))}
                    </div>

                    <Divider />
                    <div className="flex flex-wrap gap-3 align-items-end cash-sale-options">
                        <div className="field m-0 cash-discount-field">
                            <label>Desconto</label>
                            <div className="flex gap-1">
                                <div className="flex" style={{ border: '1px solid #dee2e6', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                                    <button type="button" onClick={() => setVenda({ ...venda, tipoDesconto: 'percent' })} style={{ padding: '0 10px', background: venda.tipoDesconto === 'percent' ? '#16a34a' : '#fff', color: venda.tipoDesconto === 'percent' ? '#fff' : '#555', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>%</button>
                                    <button type="button" onClick={() => setVenda({ ...venda, tipoDesconto: 'valor' })} style={{ padding: '0 10px', background: venda.tipoDesconto === 'valor' ? '#16a34a' : '#fff', color: venda.tipoDesconto === 'valor' ? '#fff' : '#555', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>R$</button>
                                </div>
                                <InputNumber value={venda.desconto} onValueChange={(e) => setVenda({ ...venda, desconto: e.value ?? null })} mode={venda.tipoDesconto === 'percent' ? 'decimal' : 'currency'} currency="BRL" locale="pt-BR" suffix={venda.tipoDesconto === 'percent' ? '%' : undefined} min={0} max={venda.tipoDesconto === 'percent' ? 100 : undefined} className="w-full" />
                            </div>
                        </div>
                        <div className="field m-0" style={{ minWidth: '280px', flex: '1 1 320px' }}>
                            <label htmlFor="caixa-cupom">Cupom do cliente</label>
                            <div className="flex gap-2 align-items-center">
                                <InputText
                                    id="caixa-cupom"
                                    value={venda.cupomCodigo}
                                    onChange={(event) => setVenda({ ...venda, cupomCodigo: event.target.value.toUpperCase(), cupomId: null })}
                                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void aplicarCupomCaixa(); } }}
                                    placeholder="Código do cupom"
                                    className="w-full"
                                    disabled={aplicandoCupom}
                                />
                                {venda.cupomId ? (
                                    <Button label="Remover" severity="secondary" outlined onClick={removerCupomCaixa} />
                                ) : (
                                    <Button label="Aplicar" icon="pi pi-check" onClick={() => void aplicarCupomCaixa()} loading={aplicandoCupom} />
                                )}
                            </div>
                            {venda.cupomId && <small className="block mt-1" style={{ color: '#15803d' }}>Cupom vinculado ao cliente e será consumido ao confirmar a venda.</small>}
                        </div>
                        <div className="field m-0">
                            <label className="block mb-1">Entrega?</label>
                            <div className="flex" style={{ border: '1px solid #dee2e6', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
                                <button type="button"
                                    onClick={() => setVenda({ ...venda, temEntrega: false, taxaEntrega: null, enderecoEntrega: '' })}
                                    style={{ padding: '0 14px', height: 36, background: !venda.temEntrega ? '#16a34a' : '#fff', color: !venda.temEntrega ? '#fff' : '#555', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                                    Não
                                </button>
                                <button type="button"
                                    onClick={() => setVenda({ ...venda, temEntrega: true })}
                                    style={{ padding: '0 14px', height: 36, background: venda.temEntrega ? '#10b981' : '#fff', color: venda.temEntrega ? '#fff' : '#555', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                                    Sim
                                </button>
                            </div>
                        </div>

                        {venda.temEntrega && (
                            <>
                                {bairros.length > 0 && (
                                    <div className="field m-0 cash-delivery-neighborhood">
                                        <label>Bairro</label>
                                        <Dropdown
                                            value={bairroSelecionado}
                                            options={bairros}
                                            optionLabel="nome"
                                            optionValue="id"
                                            placeholder="Selecionar bairro"
                                            className="w-full"
                                            filter
                                            filterPlaceholder="Buscar bairro..."
                                            showClear
                                            onChange={e => {
                                                const id = e.value;
                                                setBairroSelecionado(id);
                                                const b = bairros.find(x => x.id === id);
                                                setVenda({ ...venda, taxaEntrega: b ? Number(b.taxa) : null });
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="field m-0 cash-delivery-fee">
                                    <label>Taxa de Entrega</label>
                                    <InputNumber
                                        value={venda.taxaEntrega}
                                        onValueChange={e => setVenda({ ...venda, taxaEntrega: e.value ?? null })}
                                        mode="currency" currency="BRL" min={0}
                                        className="w-full"
                                        placeholder="R$ 0,00"
                                    />
                                </div>
                                <div className="field m-0 cash-delivery-address">
                                    <div className="flex justify-content-between align-items-center mb-1">
                                        <label>Endereço de Entrega</label>
                                        {venda.cliente && (() => {
                                            const clienteCompleto = clientes.find(c => c.id === venda.cliente?.id);
                                            if (!clienteCompleto?.rua && !clienteCompleto?.cidade) return null;
                                            return (
                                                <Button
                                                    label="Usar endereço do cliente"
                                                    icon="pi pi-map-marker"
                                                    text
                                                    size="small"
                                                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                                                    onClick={() => {
                                                        const c = clienteCompleto!;
                                                        const partes = [c.rua, c.numero, c.complemento, c.bairro, c.cidade, c.cep].filter(Boolean);
                                                        setVenda({ ...venda, enderecoEntrega: partes.join(', ') });
                                                    }}
                                                />
                                            );
                                        })()}
                                    </div>
                                    <InputText
                                        value={venda.enderecoEntrega}
                                        onChange={e => setVenda({ ...venda, enderecoEntrega: e.target.value })}
                                        placeholder="Rua, número, bairro, complemento..."
                                        className="w-full"
                                    />
                                </div>
                            </>
                        )}
                        <div className="ml-auto text-right">
                            <div className="text-sm text-color-secondary">Valor Total</div>
                            <div className="text-3xl font-bold text-primary">{fmtMoeda(venda.valorTotal)}</div>
                        </div>
                    </div>

                    <Divider />
                    <div className="grid formgrid">
                        <div className="col-12 field">
                            <div className="flex align-items-center justify-content-between mb-2"><label className="font-semibold m-0">Formas de Pagamento *</label><Button label="+ Adicionar forma" text onClick={adicionarPagamento} style={{ minHeight: '44px', padding: '0.75rem 1rem', fontSize: '0.95rem' }} /></div>
                            {venda.pagamentos.length === 0 && <div className="text-color-secondary text-sm p-3 border-round text-center" style={{ border: '1px dashed #dee2e6' }}>Clique em "+ Adicionar forma" para informar como o cliente vai pagar</div>}
                            <div className="flex flex-column gap-2">{venda.pagamentos.map((pag) => { const troco = pag.forma === 'DINHEIRO' ? Math.max(0, (pag.valorRecebido || 0) - (pag.valor || 0)) : 0; return (<div key={pag.uid} className="p-3 border-round" style={{ border: '1px solid #dee2e6', background: 'rgba(0,0,0,0.01)' }}><div className="flex gap-2 align-items-start flex-wrap"><div style={{ minWidth: '130px' }}><label className="text-xs text-color-secondary block mb-1">Forma</label><div className="flex" style={{ border: '1px solid #dee2e6', borderRadius: '6px', overflow: 'hidden' }}>{(['PIX','DINHEIRO','CARTAO'] as const).map(f => (<button key={f} type="button" onClick={() => atualizarPagamento(pag.uid, { forma: f, tipoCartao: undefined, bandeira: undefined, parcelas: 1 })} style={{ padding: '0 10px', height: '36px', fontSize: '0.78rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: pag.forma === f ? '#1e88e5' : '#fff', color: pag.forma === f ? '#fff' : '#555' }}>{f === 'CARTAO' ? 'Cartão' : f === 'DINHEIRO' ? 'Dinheiro' : 'PIX'}</button>))}</div></div><div style={{ minWidth: '140px' }}><label className="text-xs text-color-secondary block mb-1">Valor</label><InputNumber value={pag.valor} onValueChange={e => atualizarPagamento(pag.uid, { valor: e.value ?? 0 })} mode="currency" currency="BRL" locale="pt-BR" inputClassName="w-full" className="w-full" style={{ height: '36px' }} /></div>{pag.forma === 'CARTAO' && (<div><label className="text-xs text-color-secondary block mb-1">Tipo</label><div className="flex" style={{ border: '1px solid #dee2e6', borderRadius: '6px', overflow: 'hidden' }}>{(['credito','debito'] as const).map(t => (<button key={t} type="button" onClick={() => atualizarPagamento(pag.uid, { tipoCartao: t, parcelas: 1 })} style={{ padding: '0 12px', height: '36px', fontSize: '0.78rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: pag.tipoCartao === t ? '#1e88e5' : '#fff', color: pag.tipoCartao === t ? '#fff' : '#555' }}>{t === 'credito' ? 'Crédito' : 'Débito'}</button>))}</div></div>)}{pag.forma === 'CARTAO' && (<div style={{ minWidth: '130px' }}><label className="text-xs text-color-secondary block mb-1">Bandeira</label><Dropdown value={pag.bandeira ?? null} options={bandeiraCartaoOptions} onChange={e => atualizarPagamento(pag.uid, { bandeira: e.value })} placeholder="Selecione" className="w-full" /></div>)}{pag.forma === 'CARTAO' && pag.tipoCartao === 'credito' && (<div style={{ minWidth: '90px' }}><label className="text-xs text-color-secondary block mb-1">Parcelas</label><InputNumber value={pag.parcelas ?? 1} onValueChange={e => atualizarPagamento(pag.uid, { parcelas: e.value || 1 })} min={1} max={12} showButtons suffix="x" inputClassName="w-full" className="w-full" style={{ height: '36px' }} /></div>)}{pag.forma === 'DINHEIRO' && (<div style={{ minWidth: '140px' }}><label className="text-xs text-color-secondary block mb-1">Recebido</label><InputNumber value={pag.valorRecebido ?? null} onValueChange={e => atualizarPagamento(pag.uid, { valorRecebido: e.value ?? undefined })} mode="currency" currency="BRL" locale="pt-BR" placeholder="Opcional" inputClassName="w-full" className="w-full" style={{ height: '36px' }} /></div>)}<Button icon="pi pi-trash" text severity="danger" size="small" style={{ marginTop: '18px' }} onClick={() => removerPagamento(pag.uid)} /></div>{troco > 0 && <div className="mt-2 text-sm font-semibold" style={{ color: '#ea580c' }}>Troco: {fmtMoeda(troco)}</div>}</div>);})}</div>
                            {venda.pagamentos.length > 0 && (<div className="flex justify-content-between align-items-center mt-2 px-1"><span className="text-sm text-color-secondary">Pago: <strong>{fmtMoeda(totalPago)}</strong>{totalPago < venda.valorTotal && <span style={{ color: '#dc2626' }}> — falta {fmtMoeda(venda.valorTotal - totalPago)}</span>}{totalPago >= venda.valorTotal && <span style={{ color: '#16a34a' }}> ✓</span>}</span>{trocoTotal > 0 && <span className="text-sm font-bold" style={{ color: '#ea580c' }}>Troco total: {fmtMoeda(trocoTotal)}</span>}</div>)}
                        </div>

                        <div className="col-12 md:col-4 field">
                            <label>CFOP da venda (opcional)</label>
                            <InputText
                                value={venda.cfop}
                                onChange={(e) => setVenda({ ...venda, cfop: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                placeholder="Ex.: 5102"
                                maxLength={4}
                                inputMode="numeric"
                                className="w-full"
                            />
                            <small className="text-color-secondary">Se vazio, será usado o CFOP cadastrado em cada produto.</small>
                        </div>
                        <div className="col-12 md:col-4 field">
                            <label>CST/CSOSN da venda (opcional)</label>
                            <InputText
                                value={venda.cstCsosn}
                                onChange={(e) => setVenda({ ...venda, cstCsosn: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                                placeholder="Ex.: 00 ou 102"
                                maxLength={3}
                                inputMode="numeric"
                                className="w-full"
                            />
                            <small className="text-color-secondary">Informe CST com 2 dígitos ou CSOSN com 3. Se vazio, será usado o cadastro de cada produto.</small>
                        </div>
                        <div className="col-12 md:col-4 field"><label>Observação</label><InputTextarea value={venda.observacao} onChange={(e) => setVenda({ ...venda, observacao: e.target.value })} rows={3} className="w-full" /></div>
                        <div className="col-12 flex justify-content-end gap-2"><Button label={editingVendaId ? 'Cancelar Edição' : 'Limpar'} icon="pi pi-refresh" severity="secondary" onClick={resetVenda} /><Button label={editingVendaId ? 'Salvar Alterações' : 'Finalizar Venda'} icon="pi pi-check" onClick={handleVendaSubmit} /></div>
                    </div>
                </div>
            </div>

            <div className="col-12">
                <div className="card">
                    <div className="flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                        <h5 className="m-0">Histórico de Vendas e Saídas</h5>
                        <Button label="Atualizar histórico" icon="pi pi-refresh" outlined loading={loadingHistorico} onClick={() => fetchHistorico()} />
                        <Button
                            label={`Baixar Relatório (${historicoFiltrado.filter(h => h._kind === 'venda').length} vendas)`}
                            icon="pi pi-download"
                            severity="help"
                            outlined
                            onClick={gerarRelatorioFiltrado}
                        />
                    </div>

                    {historicoErro && <p role="alert" className="text-red-600">{historicoErro}</p>}
                    {temSaidasLegadas && <p className="text-sm text-color-secondary">Há uma cópia antiga de saídas neste navegador, preservada sem alterações. Esta lista usa os registros do servidor. As cópias antigas precisam de conferência antes de qualquer importação, para evitar duplicação ou vínculo com a empresa errada.</p>}
                    {/* Barra de filtros */}
                    <div className="flex flex-wrap gap-2 mb-3 align-items-end p-3 border-round cash-history-filters" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div className="flex flex-column gap-1">
                            <label className="text-xs font-semibold text-color-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buscar</label>
                            <InputText
                                value={filtroBusca}
                                onChange={e => setFiltroBusca(e.target.value)}
                                placeholder="Cliente, vendedor ou código..."
                                style={{ width: '240px' }}
                            />
                        </div>
                        <div className="flex flex-column gap-1">
                            <label className="text-xs font-semibold text-color-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Período</label>
                            <Dropdown
                                value={filtroPeriodo}
                                options={[
                                    { label: 'Todos', value: '' },
                                    { label: 'Hoje', value: 'hoje' },
                                    { label: 'Esta Semana', value: 'semana' },
                                    { label: 'Este Mês', value: 'mes' },
                                    { label: 'Personalizado', value: 'custom' },
                                ]}
                                onChange={e => { setFiltroPeriodo(e.value); setFiltroDataInicio(null); setFiltroDataFim(null); }}
                                style={{ width: '175px' }}
                                placeholder="Todos"
                            />
                        </div>
                        {filtroPeriodo === 'custom' && (<>
                            <div className="flex flex-column gap-1">
                                <label className="text-xs font-semibold text-color-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>De</label>
                                <Calendar
                                    value={filtroDataInicio}
                                    onChange={e => setFiltroDataInicio(e.value as Date | null)}
                                    dateFormat="dd/mm/yy"
                                    showIcon
                                    style={{ width: '155px' }}
                                    placeholder="Início"
                                />
                            </div>
                            <div className="flex flex-column gap-1">
                                <label className="text-xs font-semibold text-color-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Até</label>
                                <Calendar
                                    value={filtroDataFim}
                                    onChange={e => setFiltroDataFim(e.value as Date | null)}
                                    dateFormat="dd/mm/yy"
                                    showIcon
                                    style={{ width: '155px' }}
                                    placeholder="Fim"
                                    minDate={filtroDataInicio ?? undefined}
                                />
                            </div>
                        </>)}
                        {(filtroBusca || filtroPeriodo) && (
                            <div className="flex flex-column gap-1">
                                <label className="text-xs" style={{ opacity: 0 }}>x</label>
                                <Button
                                    icon="pi pi-times"
                                    severity="secondary"
                                    outlined
                                    onClick={() => { setFiltroBusca(''); setFiltroPeriodo(''); setFiltroDataInicio(null); setFiltroDataFim(null); }}
                                    tooltip="Limpar filtros"
                                    tooltipOptions={{ position: 'top' }}
                                />
                            </div>
                        )}
                        {(filtroBusca || filtroPeriodo) && (
                            <div className="ml-auto flex align-items-end">
                                <span className="text-sm text-color-secondary">
                                    <strong>{historicoFiltrado.length}</strong> de {historico.length} registros
                                </span>
                            </div>
                        )}
                    </div>

                    <DataTable
                        key={empresaId ?? 'sem-empresa'}
                        value={historicoFiltrado}
                        sortField="dataOrdem"
                        sortOrder={-1}
                        dataKey="_uid"
                        loading={loadingHistorico}
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        emptyMessage="Nenhum registro encontrado."
                        responsiveLayout="scroll"
                        tableStyle={{ minWidth: '50rem' }}
                    >
                        <Column header="Tipo" body={tipoBody} style={{ width: '8rem' }} />
                        <Column header="Descrição" body={descricaoBody} sortField="clienteNome" sortable />
                        <Column header="Vendedor" body={vendedorBody} sortField="funcionarioNome" sortable />
                        <Column header="Data" body={dataBody} sortField="dataOrdem" sortable />
                        <Column header="Valor" body={valorBody} sortField="valorOrdem" sortable />
                        <Column body={acoesBody} style={{ minWidth: '11rem' }} />
                    </DataTable>
                </div>
            </div>

            <Dialog header={`Autenticar ${funcionarioPendente?.nome ?? ''}`} visible={senhaDialog} style={{ width: '420px' }} modal onHide={() => { if (!senhaCarregando) { setSenhaDialog(false); setFuncionarioPendente(null); setSenhaInput(''); } }} footer={senhaFooter}><p className="text-sm text-color-secondary mb-3">Informe a senha de <strong>{funcionarioPendente?.nome}</strong> para autorizar.</p><Password value={senhaInput} onChange={(e) => setSenhaInput(e.target.value)} feedback={false} toggleMask placeholder="Senha do funcionário" className="w-full" inputClassName="w-full" disabled={senhaCarregando} onKeyDown={(e) => e.key === 'Enter' && confirmarSenhaFuncionario()} /></Dialog>
            <Dialog header="Abertura de Caixa" visible={aberturaCaixaDialog} style={{ width: '420px' }} modal onHide={() => setAberturaCaixaDialog(false)} footer={<div className="flex gap-2 justify-content-end"><Button label="Cancelar" icon="pi pi-times" className="p-button-text" onClick={() => setAberturaCaixaDialog(false)} /><Button label="Abrir Caixa" icon="pi pi-lock-open" severity="success" onClick={confirmarAberturaCaixa} /></div>}><div className="flex flex-column gap-3"><div className="field mb-0"><label className="font-medium">Funcionário que está abrindo *</label><Dropdown value={funcAberturaId} options={funcionarios.map(f => ({ label: f.nome, value: f.id }))} onChange={e => setFuncAberturaId(e.value)} placeholder="Selecione o funcionário" filter className="w-full mt-1" /></div><div className="field mb-0"><label className="font-medium">Valor inicial em caixa *</label><InputNumber value={valAberturaInput} onValueChange={e => setValAberturaInput(e.value ?? null)} mode="currency" currency="BRL" locale="pt-BR" placeholder="R$ 0,00" className="w-full mt-1" inputClassName="w-full" onKeyDown={e => { if (e.key === 'Enter') confirmarAberturaCaixa(); }} /></div></div></Dialog>
            <Dialog header="Fechamento de Caixa" visible={fechamentoCaixaDialog} style={{ width: '420px' }} modal onHide={() => setFechamentoCaixaDialog(false)} footer={<div className="flex gap-2 justify-content-end"><Button label="Cancelar" icon="pi pi-times" className="p-button-text" onClick={() => setFechamentoCaixaDialog(false)} /><Button label="Fechar Caixa" icon="pi pi-lock" severity="danger" onClick={confirmarFechamentoCaixa} /></div>}><div className="flex flex-column gap-3">{turnosAbertos.length > 1 && (<div className="field mb-0"><label className="font-medium">Qual caixa fechar *</label><Dropdown value={turnoFechamentoId} options={turnosAbertos.map(t => ({ label: `${t.func_abertura_nome} — aberto ${new Date(t.data_abertura).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, value: t.id }))} onChange={e => setTurnoFechamentoId(e.value)} placeholder="Selecione o caixa" className="w-full mt-1" /></div>)}{turnosAbertos.length === 1 && (<div className="p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}><p className="m-0 text-sm"><strong>Aberto por:</strong> {turnosAbertos[0].func_abertura_nome}</p><p className="m-0 text-sm"><strong>Abertura:</strong> {fmtMoeda(turnosAbertos[0].valor_abertura)}</p><p className="m-0 text-sm"><strong>Início:</strong> {new Date(turnosAbertos[0].data_abertura).toLocaleString('pt-BR')}</p></div>)}<div className="field mb-0"><label className="font-medium">Quem está fechando (opcional)</label><Dropdown value={funcFechamentoId} options={funcionarios.map(f => ({ label: f.nome, value: f.id }))} onChange={e => setFuncFechamentoId(e.value)} placeholder="Padrão: quem abriu" showClear filter className="w-full mt-1" /></div><div className="field mb-0"><label className="font-medium">Valor em caixa no fechamento *</label><InputNumber value={valFechamentoInput} onValueChange={e => setValFechamentoInput(e.value ?? null)} mode="currency" currency="BRL" locale="pt-BR" placeholder="R$ 0,00" className="w-full mt-1" inputClassName="w-full" onKeyDown={e => { if (e.key === 'Enter') confirmarFechamentoCaixa(); }} /></div></div></Dialog>
            <Dialog header="Turnos de Caixa" visible={turnosDialog} style={{ width: '780px' }} modal onHide={() => { setTurnosDialog(false); setTurnoDetalhe(null); setTurnoMovimentos(null); }} footer={turnoDetalhe ? <Button label="← Voltar" icon="pi pi-arrow-left" className="p-button-text" onClick={() => { setTurnoDetalhe(null); setTurnoMovimentos(null); }} /> : <Button label="Fechar" icon="pi pi-times" className="p-button-text" onClick={() => setTurnosDialog(false)} />}>{!turnoDetalhe ? (turnos.length === 0 ? <p className="text-color-secondary text-center py-4">Nenhum turno registrado ainda.</p> : <DataTable value={turnos} paginator rows={10} tableStyle={{ minWidth: '100%' }}><Column header="Status" style={{ width: '7rem' }} body={(t: TurnoCaixa) => (<Tag value={t.status === 'aberto' ? 'Aberto' : 'Fechado'} severity={t.status === 'aberto' ? 'success' : 'secondary'} />)} /><Column header="Abertura" body={(t: TurnoCaixa) => (<div><div className="font-medium">{t.func_abertura_nome}</div><div className="text-sm text-color-secondary">{new Date(t.data_abertura).toLocaleString('pt-BR')}</div><div className="text-sm">{fmtMoeda(t.valor_abertura)}</div></div>)} /><Column header="Fechamento" body={(t: TurnoCaixa) => t.data_fechamento ? (<div><div className="font-medium">{t.func_fechamento_nome}</div><div className="text-sm text-color-secondary">{new Date(t.data_fechamento).toLocaleString('pt-BR')}</div><div className="text-sm">{fmtMoeda(t.valor_fechamento ?? 0)}</div></div>) : <span className="text-color-secondary text-sm">—</span>} /><Column header="" style={{ width: '8rem' }} body={(t: TurnoCaixa) => (<Button label="Ver detalhes" text size="small" icon="pi pi-chart-bar" onClick={() => verMovimentosTurno(t)} />)} /></DataTable>) : (<div><div className="grid mb-3"><div className="col-6"><div className="p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}><div className="text-xs text-color-secondary mb-1">ABERTURA</div><p className="font-bold m-0">{turnoDetalhe.func_abertura_nome}</p><p className="text-sm m-0">{new Date(turnoDetalhe.data_abertura).toLocaleString('pt-BR')}</p><p className="text-lg font-bold m-0" style={{ color: '#16a34a' }}>{fmtMoeda(turnoDetalhe.valor_abertura)}</p></div></div><div className="col-6"><div className="p-3 border-round" style={{ background: turnoDetalhe.data_fechamento ? '#fef2f2' : '#f9fafb', border: turnoDetalhe.data_fechamento ? '1px solid #fecaca' : '1px solid #e5e7eb' }}><div className="text-xs text-color-secondary mb-1">FECHAMENTO</div>{turnoDetalhe.data_fechamento ? <><p className="font-bold m-0">{turnoDetalhe.func_fechamento_nome}</p><p className="text-sm m-0">{new Date(turnoDetalhe.data_fechamento).toLocaleString('pt-BR')}</p><p className="text-lg font-bold m-0" style={{ color: '#dc2626' }}>{fmtMoeda(turnoDetalhe.valor_fechamento ?? 0)}</p></> : <p className="text-color-secondary m-0 text-sm">Caixa ainda aberto</p>}</div></div></div>{carregandoMovimentos ? <div className="flex justify-content-center py-4"><i className="pi pi-spin pi-spinner mr-2" /> Carregando...</div> : turnoMovimentos ? (<><ResumoSaidasTurno resumo={turnoMovimentos.resumo} saidas={turnoMovimentos.saidas ?? []} /><div className="p-3 border-round mb-3 flex align-items-center gap-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}><i className="pi pi-clock" style={{ color: '#64748b', fontSize: '1.3rem' }} /><div><div className="text-xs text-color-secondary">Duração</div><div className="font-bold text-lg">{turnoMovimentos.resumo.duracaoTexto}</div></div><div className="ml-auto text-right"><div className="text-xs text-color-secondary">Total de vendas</div><div className="font-bold text-lg">{turnoMovimentos.resumo.totalVendas} venda{turnoMovimentos.resumo.totalVendas !== 1 ? 's' : ''}</div></div></div><div className="grid mb-3">{[{ label: 'Dinheiro', valor: turnoMovimentos.resumo.totalDinheiro, qtd: turnoMovimentos.resumo.qtdDinheiro, cor: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' }, { label: 'PIX', valor: turnoMovimentos.resumo.totalPix, qtd: turnoMovimentos.resumo.qtdPix, cor: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' }, { label: 'Cartão', valor: turnoMovimentos.resumo.totalCartao, qtd: turnoMovimentos.resumo.qtdCartao, cor: '#f59e0b', bg: '#fffbeb', border: '#fde68a' }].map(item => (<div key={item.label} className="col-4"><div className="p-3 border-round text-center" style={{ background: item.bg, border: `1px solid ${item.border}` }}><div className="text-xs text-color-secondary">{item.label}</div><div className="font-bold" style={{ color: item.cor }}>{fmtMoeda(item.valor)}</div><div className="text-xs text-color-secondary">{item.qtd} venda{item.qtd !== 1 ? 's' : ''}</div></div></div>))}</div>{turnoMovimentos.resumo.qtdTrocos > 0 && (<div className="p-3 border-round mb-3 flex justify-content-between" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}><span className="font-semibold text-sm">Troco dado ({turnoMovimentos.resumo.qtdTrocos}x)</span><span className="font-bold" style={{ color: '#ea580c' }}>{fmtMoeda(turnoMovimentos.resumo.trocoTotal)}</span></div>)}<div className="p-3 border-round mb-3 flex justify-content-between" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}><span className="font-semibold">Total em vendas</span><span className="text-xl font-bold" style={{ color: '#16a34a' }}>{fmtMoeda(turnoMovimentos.resumo.totalGeral)}</span></div><div className="p-3 border-round mb-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}><div className="flex justify-content-between mb-1"><div><div className="font-semibold">Saldo esperado</div><div className="text-xs text-color-secondary">Abertura + vendas em dinheiro − saídas em dinheiro</div></div><div className="text-xl font-bold" style={{ color: '#1d4ed8' }}>{fmtMoeda(turnoMovimentos.resumo.saldoEsperado)}</div></div>{turnoMovimentos.resumo.diferenca != null && (<div className="flex justify-content-between pt-2" style={{ borderTop: '1px solid #bfdbfe' }}><span className="text-sm">Valor informado no fechamento</span><div className="text-right"><div className="font-bold">{fmtMoeda(turnoDetalhe.valor_fechamento ?? 0)}</div><div className="text-sm font-semibold" style={{ color: turnoMovimentos.resumo.diferenca >= 0 ? '#16a34a' : '#dc2626' }}>{turnoMovimentos.resumo.diferenca >= 0 ? '▲' : '▼'} {fmtMoeda(Math.abs(turnoMovimentos.resumo.diferenca))}</div></div></div>)}</div><h6 className="mt-3 mb-2">Vendas ({turnoMovimentos.vendas.length})</h6><DataTable value={turnoMovimentos.vendas} rows={5} paginator tableStyle={{ minWidth: '100%' }}><Column header="Hora" style={{ width: '5rem' }} body={(v: any) => new Date(v.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} /><Column header="Valor" style={{ width: '8rem' }} body={(v: any) => <span className="font-bold">{fmtMoeda(v.valor_total)}</span>} /><Column header="Pagamento" body={(v: any) => { const pags = v.pagamentos ?? [{ forma: v.forma_pagamento, valor: v.valor_total }]; return pags.map((p: any, i: number) => (<span key={i} className="mr-2 text-sm">{p.forma === 'DINHEIRO' ? 'Dinheiro' : p.forma === 'PIX' ? 'PIX' : 'Cartão'}: {fmtMoeda(p.valor)}{p.forma === 'DINHEIRO' && p.valorRecebido && p.valorRecebido > p.valor ? <span style={{ color: '#ea580c' }}> (troco {fmtMoeda(p.valorRecebido - p.valor)})</span> : null}</span>)); }} /></DataTable></>) : <p className="text-color-secondary text-center py-3">Nenhuma venda neste turno.</p>}</div>)}</Dialog>
            <Dialog
                header="Recibo da Venda"
                visible={showReciboDialog}
                style={{ width: '600px' }}
                modal
                onHide={() => {
                    if (vendaConfirmadaId) resetVenda();
                    setShowReciboDialog(false);
                }}
                footer={reciboFooter}
            >
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem' }}>{reciboContent}</pre>
            </Dialog>
            <Dialog
                header="Escolha o tamanho para imprimir"
                visible={!!vendaHistoricoParaImprimir}
                style={{ width: '560px' }}
                modal
                onHide={() => setVendaHistoricoParaImprimir(null)}
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            onClick={() => setVendaHistoricoParaImprimir(null)}
                        />
                        <Button
                            label="Imprimir"
                            icon="pi pi-print"
                            severity="help"
                            onClick={() => vendaHistoricoParaImprimir && imprimirReciboHistorico(vendaHistoricoParaImprimir, tipoCupomHistorico)}
                        />
                    </div>
                }
            >
                <p className="mt-0 text-color-secondary">
                    Selecione novamente o formato desejado para este documento.
                </p>
                <div className="flex flex-column gap-2">
                    {formatosRecibo.map(formato => (
                        <button
                            key={formato.value}
                            type="button"
                            onClick={() => setTipoCupomHistorico(formato.value)}
                            className="flex align-items-center gap-3 p-3 text-left cursor-pointer border-round"
                            style={{
                                border: tipoCupomHistorico === formato.value ? '2px solid #7c3aed' : '1px solid #dee2e6',
                                background: tipoCupomHistorico === formato.value ? '#f5f3ff' : '#fff',
                                color: '#374151',
                            }}
                        >
                            <i className={`pi ${formato.value === 'pdf' ? 'pi-file-pdf' : 'pi-print'}`} style={{ color: '#7c3aed' }} />
                            <span className="font-semibold">{formato.label}</span>
                            {tipoCupomHistorico === formato.value && <i className="pi pi-check ml-auto" style={{ color: '#7c3aed' }} />}
                        </button>
                    ))}
                </div>
            </Dialog>
            <Dialog header="Resumo da Nota Fiscal" visible={resumoFiscalDialog} style={{ width: '550px' }} modal onHide={() => setResumoFiscalDialog(false)} footer={resumoFooter}><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem' }}>{resumoFiscalContent}</pre></Dialog>
            <Dialog header="Cadastrar Comissão" visible={comissaoDialog} style={{ width: '500px' }} modal onHide={() => setComissaoDialog(false)} footer={<div className="flex gap-2 justify-content-end"><Button label="Cancelar" icon="pi pi-times" className="p-button-text" onClick={() => setComissaoDialog(false)} disabled={comissaoSalvando} /><Button label="Salvar" icon="pi pi-check" onClick={salvarComissao} loading={comissaoSalvando} /></div>}><div className="grid formgrid"><div className="col-12 field"><label>Funcionário *</label><Dropdown value={comissaoFuncionarioId} options={funcionarios.map(f => ({ label: f.nome, value: f.id }))} onChange={(e) => onSelecionarFuncionarioComissao(e.value)} placeholder="Selecione o funcionário" filter className="w-full" /></div><div className="col-12 md:col-5 field"><label>Tipo</label><div className="flex" style={{ border: '1px solid #dee2e6', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}><button type="button" onClick={() => setComissaoTipo('percent')} style={{ padding: '0 16px', height: '38px', background: comissaoTipo === 'percent' ? '#1e88e5' : '#fff', color: comissaoTipo === 'percent' ? '#fff' : '#555', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>%</button><button type="button" onClick={() => setComissaoTipo('valor')} style={{ padding: '0 16px', height: '38px', background: comissaoTipo === 'valor' ? '#1e88e5' : '#fff', color: comissaoTipo === 'valor' ? '#fff' : '#555', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>R$</button></div></div><div className="col-12 md:col-7 field"><label>Valor</label><InputNumber value={comissaoValor} onValueChange={(e) => setComissaoValor(e.value || 0)} mode={comissaoTipo === 'percent' ? 'decimal' : 'currency'} currency="BRL" locale="pt-BR" suffix={comissaoTipo === 'percent' ? '%' : undefined} min={0} max={comissaoTipo === 'percent' ? 100 : undefined} className="w-full" /></div></div></Dialog>
            <Dialog header={editingSaidaId ? 'Editar Saída' : 'Nova Saída'} visible={saidaDialog} style={{ width: '550px' }} modal closable={!salvandoSaida} closeOnEscape={!salvandoSaida} onHide={() => { if (salvandoSaidaRef.current) return; setSaidaDialog(false); setEditingSaidaId(null); setSaida(initialSaida); }} footer={saidaFooter}><div className="grid formgrid"><div className="col-12 field"><label>Tipo de Saída *</label><InputText value={saida.tipo} onChange={(e) => setSaida({ ...saida, tipo: e.target.value })} placeholder="Ex: Conta de luz, fornecedor..." className="w-full" /></div><div className="col-12 field"><label>Cliente</label><Dropdown options={clientes} value={saida.cliente} onChange={(e) => setSaida({ ...saida, cliente: e.value })} optionLabel="nomeCompleto" placeholder="Cliente (opcional)" filter showClear emptyMessage="Nenhum cliente cadastrado" className="w-full" /></div><div className="col-6 field"><label>Valor *</label><InputNumber value={saida.valor} onValueChange={(e) => setSaida({ ...saida, valor: e.value ?? null })} mode="currency" currency="BRL" className="w-full" /></div><div className="col-6 field"><label>Data</label><Calendar value={saida.data} onChange={(e) => setSaida({ ...saida, data: e.value as Date })} dateFormat="dd/mm/yy" showIcon className="w-full" /></div><div className="col-12 field"><label htmlFor="saida-pagamento">Forma de pagamento *</label><Dropdown inputId="saida-pagamento" options={formaPagamentoOptions} value={saida.forma_pagamento} onChange={e => setSaida({ ...saida, forma_pagamento: e.value })} placeholder="Como esta saída foi paga?" className="w-full" /></div><div className="col-12 field"><label htmlFor="saida-turno">Turno do caixa *</label>{editingSaidaId ? <p>{saida.turno_id ? 'Vinculada ao turno #' + saida.turno_id + ' (mantido na edição)' : 'Saída antiga sem turno. O histórico será preservado.'}</p> : <><Dropdown inputId="saida-turno" options={turnosAbertos.map(t => ({ value: t.id, label: '#' + t.id + ' — ' + t.func_abertura_nome + ' — ' + new Date(t.data_abertura).toLocaleString('pt-BR') }))} value={saida.turno_id} onChange={e => setSaida({ ...saida, turno_id: e.value })} placeholder="Selecione o turno" emptyMessage="Nenhum turno aberto" className="w-full" />{turnosAbertos.length === 0 && <small>Abra um turno antes de registrar a saída.</small>}<small className="block mt-2">Será registrada como paga e descontada da forma selecionada no relatório do turno.</small></>}</div><div className="col-12 field"><label>Descrição</label><InputTextarea value={saida.descricao} onChange={(e) => setSaida({ ...saida, descricao: e.target.value })} rows={3} className="w-full" /></div></div></Dialog>
            {/* ── Dialog de Bairros ── */}
            <Dialog
                header="Bairros de Entrega"
                visible={bairroDialog}
                style={{ width: '480px' }}
                modal
                onHide={() => { setBairroDialog(false); setNovoBairroNome(''); setNovoBairroTaxa(null); }}
            >
                <div className="mb-3">
                    <div className="p-fluid grid formgrid">
                        <div className="col-12 md:col-6 field">
                            <label>Nome do Bairro *</label>
                            <InputText
                                value={novoBairroNome}
                                onChange={e => setNovoBairroNome(e.target.value)}
                                placeholder="Ex: Centro"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-6 field">
                            <label>Taxa de Entrega (R$) *</label>
                            <InputNumber
                                value={novoBairroTaxa}
                                onValueChange={e => setNovoBairroTaxa(e.value ?? null)}
                                mode="currency" currency="BRL" min={0}
                                placeholder="R$ 0,00"
                                className="w-full"
                            />
                        </div>
                    </div>
                    <Button
                        label="Adicionar Bairro"
                        icon="pi pi-plus"
                        onClick={salvarBairro}
                        loading={salvandoBairro}
                        disabled={!novoBairroNome.trim()}
                        className="w-full"
                    />
                </div>
                {bairros.length === 0 ? (
                    <p className="text-center text-color-secondary mt-3">Nenhum bairro cadastrado.</p>
                ) : (
                    <ul className="list-none p-0 m-0">
                        {bairros.map(b => (
                            <li key={b.id} className="flex align-items-center justify-content-between py-2 border-bottom-1 surface-border">
                                <div>
                                    <span className="font-semibold">{b.nome}</span>
                                    <span className="ml-2 text-color-secondary">
                                        {Number(b.taxa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                </div>
                                <Button
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    size="small"
                                    onClick={() => excluirBairro(b.id)}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </Dialog>

            <Dialog header={viewItem?._kind === 'venda' ? `Venda — ${viewItem.cliente?.nomeCompleto ?? 'Consumidor'}` : `Saída — ${(viewItem as Saida)?.tipo}`} visible={viewDialog} style={{ width: '600px' }} modal onHide={() => setViewDialog(false)} footer={<Button label="Fechar" icon="pi pi-times" className="p-button-text" onClick={() => setViewDialog(false)} />}>{viewItem && viewItem._kind === 'venda' && (<div><div className="grid mb-3"><div className="col-6"><strong>Funcionário:</strong> {viewItem.funcionario?.nome}</div><div className="col-6"><strong>Cliente:</strong> {viewItem.cliente?.nomeCompleto ?? 'Consumidor'}</div><div className="col-6"><strong>Data:</strong> {fmtData(viewItem.dataVenda)}</div><div className="col-6"><strong>Pagamento:</strong> {(viewItem.pagamentos ?? []).map((p: PagamentoItem, i: number) => (<span key={i} className="mr-2">{p.forma === 'DINHEIRO' ? 'Dinheiro' : p.forma === 'PIX' ? 'PIX' : 'Cartão'}: {fmtMoeda(p.valor)}</span>))}</div><div className="col-6"><strong>Nota Fiscal:</strong> {viewItem.comNota ? 'Sim' : 'Não'}</div><div className="col-6"><strong>Total:</strong> {fmtMoeda(viewItem.valorTotal)}</div></div><Divider /><DataTable value={viewItem.produtos} className="p-datatable-sm"><Column field="nome" header="Produto" /><Column header="Qtd." body={(p: ItemVenda) => p.quantidade} /><Column header="Total" body={(p: ItemVenda) => fmtMoeda(calcularTotalItem(p))} /></DataTable>{viewItem.enderecoEntrega && (<p className="mt-3"><strong>Endereço de entrega:</strong> {viewItem.enderecoEntrega}</p>)}{viewItem.observacao && (<p className="mt-3"><strong>Observação:</strong> {viewItem.observacao}</p>)}</div>)}{viewItem && viewItem._kind === 'saida' && (<div><div className="grid"><div className="col-6"><strong>Tipo:</strong> {viewItem.tipo}</div><div className="col-6"><strong>Cliente:</strong> {viewItem.cliente?.nomeCompleto ?? '-'}</div><div className="col-6"><strong>Data:</strong> {fmtData(viewItem.data)}</div><div className="col-6"><strong>Valor:</strong> {fmtMoeda(viewItem.valor || 0)}</div></div>{viewItem.descricao && (<p className="mt-3"><strong>Descrição:</strong> {viewItem.descricao}</p>)}</div>)}</Dialog>

            <Dialog
                header={`Pesagem - ${pendingWeightProduct?.nome || 'Produto'}`}
                visible={showScaleModal}
                style={{ width: '500px' }}
                modal
                onHide={cancelWeightProduct}
                footer={
                    <div className="flex gap-2 justify-content-end">
                        <Button label="Cancelar" icon="pi pi-times" className="p-button-text" onClick={cancelWeightProduct} />
                        <Button label="Conectar Balança" icon="pi pi-plug" onClick={connectToScale} disabled={isReadingScale || scaleConnected} />
                        <Button
                            label="Confirmar Peso"
                            icon="pi pi-check"
                            severity="success"
                            onClick={() => confirmWeightProduct(scaleInputValue ?? scaleReading ?? 0)}
                            disabled={!scaleInputValue && !scaleReading}
                        />
                    </div>
                }
            >
                <div className="flex flex-column align-items-center gap-4 p-3">
                    <div className="text-center">
                        <div className="text-sm text-color-secondary mb-2">Peso Atual</div>
                        <div className="text-5xl font-bold" style={{ color: (scaleInputValue ?? scaleReading) ? '#22c55e' : '#9ca3af' }}>
                            {(scaleInputValue ?? scaleReading) !== null ? `${(scaleInputValue ?? scaleReading)!.toFixed(3)} kg` : '--- kg'}
                        </div>
                        {(scaleInputValue ?? scaleReading) !== null && pendingWeightProduct && (
                            <div className="text-sm text-color-secondary mt-1">
                                Valor: {formatarMoeda((pendingWeightProduct.price_per_kg || pendingWeightProduct.valor) * (scaleInputValue ?? scaleReading ?? 0))}
                            </div>
                        )}
                    </div>

                    <div className="w-full">
                        <div className="flex justify-content-between align-items-center p-2 border-round" style={{ background: scaleConnected ? '#f0fdf4' : '#f9fafb', border: `1px solid ${scaleConnected ? '#bbf7d0' : '#e5e7eb'}` }}>
                            <div className="flex align-items-center gap-2">
                                <i className={`pi ${scaleConnected ? 'pi-circle-on' : 'pi-circle-off'}`} style={{ color: scaleConnected ? '#22c55e' : '#9ca3af' }} />
                                <span className="text-sm font-medium">Balança {scaleConnected ? 'Conectada' : 'Desconectada'}</span>
                            </div>
                            {!scaleConnected && (
                                <Button label="Conectar" icon="pi pi-plug" text size="small" onClick={connectToScale} loading={isReadingScale} />
                            )}
                            {scaleConnected && (
                                <div className="flex gap-2">
                                    <Button label="Ler Agora" icon="pi pi-refresh" text size="small" onClick={readScaleOnce} loading={isReadingScale} />
                                    <Button label="Desconectar" icon="pi pi-power-off" text severity="danger" size="small" onClick={disconnectFromScale} />
                                </div>
                            )}
                        </div>
                        {scaleError && (
                            <div className="mt-2 p-2 border-round" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.75rem' }}>
                                {scaleError}
                            </div>
                        )}
                    </div>

                    <div className="w-full p-3 border-round" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                        <div className="flex gap-2 align-items-center mb-2">
                            <i className="pi pi-info-circle" style={{ color: '#3b82f6' }} />
                            <span className="text-sm font-semibold">Como usar:</span>
                        </div>
                        <ul className="text-sm m-0 pl-3" style={{ color: '#1e40af' }}>
                            <li>1. Conecte a balança no USB</li>
                            <li>2. Clique em "Conectar Balança" e selecione a porta COM</li>
                            <li>3. Coloque o produto na balança</li>
                            <li>4. O peso será lido automaticamente e preenchido no campo</li>
                            <li>5. Clique em "Confirmar Peso" para adicionar à venda</li>
                        </ul>
                    </div>

                    <div className="w-full">
                        <label className="text-sm font-medium block mb-2">Ou digite manualmente:</label>
                        <div className="flex align-items-center gap-3 mb-2">
                            <label className="flex align-items-center gap-2 text-sm cursor-pointer" style={{ color: !scaleInputByValue ? '#1e40af' : '#6b7280', fontWeight: !scaleInputByValue ? 700 : 400 }}
                                onClick={() => { setScaleInputByValue(false); setScaleValueInput(null); }}>
                                <input type="radio" checked={!scaleInputByValue} onChange={() => { setScaleInputByValue(false); setScaleValueInput(null); }} style={{ accentColor: '#3b82f6' }} />
                                Por peso (kg)
                            </label>
                            <label className="flex align-items-center gap-2 text-sm cursor-pointer" style={{ color: scaleInputByValue ? '#16a34a' : '#6b7280', fontWeight: scaleInputByValue ? 700 : 400 }}
                                onClick={() => { setScaleInputByValue(true); setScaleInputValue(null); }}>
                                <input type="radio" checked={scaleInputByValue} onChange={() => { setScaleInputByValue(true); setScaleInputValue(null); }} style={{ accentColor: '#16a34a' }} />
                                Por valor (R$)
                            </label>
                        </div>
                        {!scaleInputByValue ? (
                            <div className="flex gap-2">
                                <InputNumber
                                    value={scaleInputValue ?? scaleReading}
                                    onValueChange={(e) => setScaleInputValue(e.value || 0)}
                                    min={0.001}
                                    step={0.001}
                                    suffix=" kg"
                                    locale="pt-BR"
                                    className="flex-1"
                                    placeholder="0,000 kg"
                                    allowEmpty
                                />
                                <Button
                                    label="Usar"
                                    icon="pi pi-check"
                                    severity="secondary"
                                    onClick={() => confirmWeightProduct(scaleInputValue ?? scaleReading ?? 0)}
                                    disabled={!scaleInputValue && !scaleReading}
                                />
                            </div>
                        ) : (
                            <div>
                                <div className="flex gap-2">
                                    <InputNumber
                                        value={scaleValueInput}
                                        onValueChange={(e) => setScaleValueInput(e.value ?? null)}
                                        mode="currency" currency="BRL" locale="pt-BR"
                                        className="flex-1"
                                        placeholder="Ex: R$ 10,00"
                                        min={0.01}
                                        allowEmpty
                                    />
                                    <Button
                                        label="Usar"
                                        icon="pi pi-check"
                                        severity="success"
                                        onClick={() => {
                                            if (!scaleValueInput || !pendingWeightProduct) return;
                                            const precoKg = pendingWeightProduct.price_per_kg || pendingWeightProduct.valor;
                                            if (!precoKg || precoKg <= 0) {
                                                toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Produto sem preço por kg cadastrado', life: 3000 });
                                                return;
                                            }
                                            const valorInformado = arredondarMoeda(scaleValueInput);
                                            const pesoCalculado = valorInformado / precoKg;
                                            confirmWeightProduct(parseFloat(pesoCalculado.toFixed(3)), valorInformado);
                                        }}
                                        disabled={!scaleValueInput || scaleValueInput <= 0}
                                    />
                                </div>
                                {scaleValueInput && scaleValueInput > 0 && pendingWeightProduct && (() => {
                                    const precoKg = pendingWeightProduct.price_per_kg || pendingWeightProduct.valor;
                                    if (!precoKg || precoKg <= 0) return null;
                                    const pesoCalc = scaleValueInput / precoKg;
                                    const pesoG = pesoCalc * 1000;
                                    return (
                                        <div className="mt-2 p-2 border-round text-sm" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
                                            <i className="pi pi-calculator mr-1" />
                                            {formatarMoeda(scaleValueInput)} ÷ {formatarMoeda(precoKg)}/kg = <strong>{pesoCalc.toFixed(3)} kg</strong> ({pesoG < 1000 ? `${Math.round(pesoG)}g` : `${pesoCalc.toFixed(3)} kg`})
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>

            <Dialog
                header="Deseja emitir nota fiscal?"
                visible={showEmitirNotaDialog}
                onHide={() => {
                    setShowEmitirNotaDialog(false);
                    setVendaIdParaNota(null);
                    setDataVencimentoNota('');
                    setDestinatarioIsentoIE(false);
                }}
                modal
                style={{ width: '620px', maxWidth: '95vw' }}
            >
                <div className="flex flex-column gap-3">
                    <p className="m-0">
                        A venda foi concluída com sucesso. A nota deve incluir todos os produtos ou somente alguns?
                    </p>

                    <SelectButton
                        value={modoItensNota}
                        options={[
                            { label: 'Todos os produtos', value: 'todos', icon: 'pi pi-check-circle' },
                            { label: 'Selecionar produtos', value: 'selecionar', icon: 'pi pi-list-check' },
                        ]}
                        onChange={e => e.value && setModoItensNota(e.value)}
                        optionLabel="label"
                        optionValue="value"
                        className="w-full"
                    />

                    {modoItensNota === 'selecionar' && (
                        <div className="flex flex-column gap-2 p-3 border-round" style={{ border: '1px solid #e2e8f0', maxHeight: '300px', overflowY: 'auto' }}>
                            <div className="flex justify-content-between align-items-center mb-1">
                                <span className="font-semibold">Produtos que irão para a nota</span>
                                <div className="flex gap-1">
                                    <Button label="Marcar todos" text size="small" onClick={() => setItemIdsNotaSelecionados(itensNotaFiscal.map(item => item.id))} />
                                    <Button label="Desmarcar" text size="small" severity="secondary" onClick={() => setItemIdsNotaSelecionados([])} />
                                </div>
                            </div>
                            {itensNotaFiscal.map(item => {
                                const selecionado = itemIdsNotaSelecionados.includes(item.id);
                                return (
                                    <label key={item.id} className="flex align-items-center gap-3 p-2 border-round cursor-pointer" style={{ background: selecionado ? '#eff6ff' : '#fff', border: `1px solid ${selecionado ? '#bfdbfe' : '#e5e7eb'}` }}>
                                        <Checkbox
                                            checked={selecionado}
                                            onChange={e => setItemIdsNotaSelecionados(prev =>
                                                e.checked
                                                    ? [...prev, item.id]
                                                    : prev.filter(id => id !== item.id)
                                            )}
                                        />
                                        <span className="flex-1">
                                            <span className="font-medium block">{item.nome}</span>
                                            <small className="text-color-secondary">Quantidade: {item.quantidade}</small>
                                        </span>
                                        <strong>{fmtMoeda(item.valor_total)}</strong>
                                    </label>
                                );
                            })}
                            <div className="flex justify-content-between align-items-center pt-2 border-top-1 surface-border">
                                <span className="text-sm">{obterItensSelecionadosNota().length} de {itensNotaFiscal.length} produto(s) selecionado(s)</span>
                                <strong>Total da nota: {fmtMoeda(calcularTotalNota(obterItensSelecionadosNota()))}</strong>
                            </div>
                        </div>
                    )}

                    {modoItensNota === 'todos' && (
                        <div className="p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
                            <i className="pi pi-check-circle mr-2" />
                            Todos os {itensNotaFiscal.length} produto(s) serão incluídos. Total da nota: <strong>{fmtMoeda(venda.valorTotal)}</strong>
                        </div>
                    )}

                    <div className="field mb-0">
                        <label htmlFor="data-vencimento-nfe">Data de vencimento da NF-e (opcional)</label>
                        <InputText
                            id="data-vencimento-nfe"
                            type="date"
                            value={dataVencimentoNota}
                            onChange={e => setDataVencimentoNota(e.target.value)}
                        />
                        <small className="text-color-secondary">Apenas registra o acompanhamento em Contas a Receber. Não gera boleto.</small>
                    </div>

                    <div className="flex align-items-start gap-2 p-3 border-round" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <Checkbox
                            inputId="nota-destinatario-isento-ie"
                            checked={destinatarioIsentoIE}
                            onChange={event => setDestinatarioIsentoIE(Boolean(event.checked))}
                            binary
                        />
                        <label htmlFor="nota-destinatario-isento-ie" className="cursor-pointer line-height-3">
                            <span className="font-medium block">Na NF-e, declarar o cliente como contribuinte isento de IE</span>
                            <small className="text-color-secondary">Use somente quando o cliente declarar isenção. Sem marcar, a emissão segue o fluxo normal.</small>
                        </label>
                    </div>

                    <div className="flex flex-column gap-2">
                        <Button
                            label="Emitir NFC-e"
                            icon="pi pi-receipt"
                            onClick={() => abrirResumoFiscalParaTipo('nfce')}
                        />

                        <Button
                            label="Emitir NF-e"
                            icon="pi pi-file"
                            severity="success"
                            onClick={() => abrirResumoFiscalParaTipo('nfe')}
                        />

                        <Button
                            label="Não emitir agora"
                            icon="pi pi-times"
                            severity="secondary"
                            outlined
                            onClick={() => {
                                setShowEmitirNotaDialog(false);
                                setVendaIdParaNota(null);
                                setDataVencimentoNota('');
                                setDestinatarioIsentoIE(false);
                            }}
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default CaixaPage;
