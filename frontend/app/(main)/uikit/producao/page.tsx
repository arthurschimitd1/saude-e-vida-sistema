'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from '@/app/(main)/components/MobileFriendlyInputNumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Calendar } from 'primereact/calendar';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import api from '../../services/api/baseApi';
import { useRouter } from 'next/navigation';

// ── Tipos ──────────────────────────────────────────────────────────────────
type MateriaPrima = { id: number; name: string; unit: string; unidade_medida?: string; currentQuantity: number; price: number; preco_compra?: number };

type ReceitaItem = {
    id?: number;
    raw_material_id?: number;
    produto_id?: number;
    quantidade: number;
    materiaPrima?: MateriaPrima;
    produtoMP?: MateriaPrima;
};

type Receita = {
    id: number;
    nome: string;
    produto_id: number | null;
    descricao: string | null;
    valor_unitario: number | null;
    custo_estimado?: number | null;
    custo_unitario?: number | null;
    rendimento?: number | null;
    rendimento_efetivo?: number | null;
    rendimento_inferido?: boolean;
    rendimento_pendente?: boolean;
    custo_pendente?: boolean;
    produto?: { id: number; name: string; currentQuantity: number; price: number; unidade_medida?: string; is_materia_prima?: boolean };
    itens: ReceitaItem[];
};

type OrdemProducao = {
    id: number;
    receita_id: number;
    quantidade: number;
    quantidade_final?: number | null;
    quantidade_produzida?: number | null;
    status: 'pendente' | 'concluida' | 'cancelada' | 'desfeita';
    observacao: string | null;
    classificacao_desperdicio?: 'rendimento_excedente' | 'desperdicio_real' | 'outro' | null;
    observacao_desperdicio?: string | null;
    created_at: string;
    receita?: Receita;
};

type ConsumoItem = {
    produto_id: number | null;
    raw_material_id: number | null;
    tipo_item: 'produto' | 'raw_material';
    nome: string;
    unidade: string;
    quantidade_ficha: number | null;
    quantidade_real: number;
    quantidade_desperdicio: number;
    quantidade_movimentada: number;
};

type ConsumoOrdem = {
    ordemId: number;
    receitaId: number | null;
    quantidadeReceitas: number;
    quantidadeProduzida: number | null;
    status: OrdemProducao['status'];
    fonte: 'registro_da_conclusao' | 'movimentos_historicos';
    itens: ConsumoItem[];
};

type DesperdicioItem = {
    id: number;
    data: string;
    quantidade: number;
    produtoId: number | null;
    produtoNome: string;
    unidade: string;
    ordemId: number | null;
    receitaId: number | null;
    receitaNome: string;
    motivo: string;
    classificacao: 'rendimento_excedente' | 'desperdicio_real' | 'outro';
    classificacaoLabel: string;
    observacao: string | null;
};

type DesperdicioRelatorio = {
    periodo: string;
    dataInicio: string;
    dataFim: string;
    resumo: {
        totalQuantidade: number;
        totalOcorrencias: number;
        totalRendimentoExcedente: number;
        totalDesperdicioReal: number;
        porProduto: { produtoId: number | null; produtoNome: string; unidade: string; quantidade: number; ocorrencias: number }[];
    };
    itens: DesperdicioItem[];
};

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR');
const fmtDataHora = (d: string) => new Date(d).toLocaleString('pt-BR');
const labelClassificacaoDesperdicio = (value?: string | null) => ({
    rendimento_excedente: 'Rendimento excedente',
    desperdicio_real: 'Desperdício real',
    outro: 'Outro'
}[value || 'desperdicio_real'] || 'Desperdício real');
const toDateOnly = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mensagemErro = (err: any, fallback: string) =>
    err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message ?? fallback;
const UNIDADES_INTEIRAS = ['UN', 'CX', 'PC', 'DZ', 'CT', 'PCT', 'G', ''];
const isUnidadeInteira = (un?: string | null) => UNIDADES_INTEIRAS.includes((un ?? '').toUpperCase().trim());
const fmtQtd = (v: number | string | undefined | null, unidade?: string | null) => {
    const n = Number(v ?? 0);
    if (isNaN(n)) return String(v ?? '');
    if (isUnidadeInteira(unidade)) return Math.round(n).toLocaleString('pt-BR');
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

const unidadesOpcoes = [
    { label: 'UN – Unidade', value: 'UN' },
    { label: 'KG – Quilograma', value: 'KG' },
    { label: 'G – Grama', value: 'G' },
    { label: 'ML – Mililitro', value: 'ML' },
    { label: 'LT – Litro', value: 'LT' },
    { label: 'MT – Metro', value: 'MT' },
    { label: 'CX – Caixa', value: 'CX' },
    { label: 'PC – Peça', value: 'PC' },
    { label: 'DZ – Dúzia', value: 'DZ' },
    { label: 'CT – Cento', value: 'CT' },
];

const statusBody = (o: OrdemProducao) => {
    const map: Record<string, { severity: any; label: string }> = {
        pendente:  { severity: 'warning', label: 'Pendente' },
        concluida: { severity: 'success', label: 'Concluída' },
        cancelada: { severity: 'danger',  label: 'Cancelada' },
        desfeita:  { severity: 'info',    label: 'Desfeita' },
    };
    const s = map[o.status] ?? { severity: 'info', label: o.status };
    return <Tag severity={s.severity} value={s.label} />;
};

// ══════════════════════════════════════════════════════════════════════════════
const ProducaoPage = () => {
    const toast = useRef<Toast>(null);
    const router = useRouter();
    const sincronizandoRef = useRef(false);
    const showError   = (msg: string) => toast.current?.show({ severity: 'error',   summary: 'Erro',    detail: msg, life: 4000 });
    const showSuccess = (msg: string) => toast.current?.show({ severity: 'success', summary: 'Sucesso', detail: msg, life: 3000 });

    // ── Dados ──
    const [receitas,  setReceitas]  = useState<Receita[]>([]);
    const [ordens,    setOrdens]    = useState<OrdemProducao[]>([]);
    const [materias,  setMaterias]  = useState<MateriaPrima[]>([]);
    const [loadingR,  setLoadingR]  = useState(false);
    const [loadingO,  setLoadingO]  = useState(false);
    const [salvando,  setSalvando]  = useState(false);

    // ── Dialog Receita ──
    const [receitaDialog, setReceitaDialog] = useState(false);
    const [editReceita,   setEditReceita]   = useState<Receita | null>(null);
    const [recNome,       setRecNome]       = useState('');
    const [recDescricao,  setRecDescricao]  = useState('');
    const [recValorUnit,  setRecValorUnit]  = useState<number | null>(null);
    const [recRendimento, setRecRendimento] = useState<number | null>(null);
    const [recUnidade,    setRecUnidade]    = useState<string>('UN');
    const [recMateriaPrima, setRecMateriaPrima] = useState(false);
    const [recItens,      setRecItens]      = useState<ReceitaItem[]>([]);

    // ── Dialog Ordem ──
    const [ordemDialog,  setOrdemDialog]  = useState(false);
    const [ordReceitaId, setOrdReceitaId] = useState<number | null>(null);
    const [ordQtd,       setOrdQtd]       = useState<number>(1);
    const [ordQtdFinal,  setOrdQtdFinal]  = useState<number>(1);
    const [ordObs,       setOrdObs]       = useState('');

    // ── Dialog Histórico por Receita ──
    const [histDialog,   setHistDialog]   = useState(false);
    const [histReceita,  setHistReceita]  = useState<Receita | null>(null);
    const [histOrdens,   setHistOrdens]   = useState<OrdemProducao[]>([]);
    const [loadingHist,  setLoadingHist]  = useState(false);

    // ── Dialog Consumo da Ordem ──
    const [consumoDialog, setConsumoDialog] = useState(false);
    const [consumoOrdem, setConsumoOrdem] = useState<ConsumoOrdem | null>(null);
    const [loadingConsumo, setLoadingConsumo] = useState(false);

    // ── Dialog Concluir (baixa de ingredientes) ──
    const [concluirDialog, setConcluirDialog] = useState(false);
    const [concluirOrdemObj, setConcluirOrdemObj] = useState<OrdemProducao | null>(null);
    const [concluirQtdFinal, setConcluirQtdFinal] = useState(1);
    const [concluirItens, setConcluirItens] = useState<{ produto_id?: number; raw_material_id?: number; nome: string; unidade: string; quantidade_receita: number; quantidade_real: number }[]>([]);
    const [concluirClassificacao, setConcluirClassificacao] = useState<'rendimento_excedente' | 'desperdicio_real' | 'outro'>('desperdicio_real');
    const [concluirObsDesperdicio, setConcluirObsDesperdicio] = useState('');

    // ── Tela cheia (comanda) ──
    const [fullscreenAberto, setFullscreenAberto] = useState(false);

    // ── Relatório de desperdícios ──
    const [desperdicioDialog, setDesperdicioDialog] = useState(false);
    const [desperdicioPeriodo, setDesperdicioPeriodo] = useState('mes');
    const [desperdicioDataInicio, setDesperdicioDataInicio] = useState('');
    const [desperdicioDataFim, setDesperdicioDataFim] = useState('');
    const [desperdicioRelatorio, setDesperdicioRelatorio] = useState<DesperdicioRelatorio | null>(null);
    const [loadingDesperdicio, setLoadingDesperdicio] = useState(false);

    // ── Filtros de ordens ──
    const [filtroStatus, setFiltroStatus] = useState<string | null>('pendente');
    const [filtroPeriodo, setFiltroPeriodo] = useState<string>('hoje');
    const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
    const [filtroDataFim, setFiltroDataFim] = useState<string>('');

    // ── Carregamento ──
    const fetchReceitas = useCallback(async () => {
        setLoadingR(true);
        try {
            const res = await api.get('/producao/receitas');
            setReceitas(res.data ?? []);
        } catch { showError('Erro ao carregar receitas'); }
        finally { setLoadingR(false); }
    }, []);

    const fetchOrdens = useCallback(async (silencioso = false) => {
        if (!silencioso) setLoadingO(true);
        try {
            const res = await api.get('/producao/ordens');
            setOrdens(res.data ?? []);
        } catch { if (!silencioso) showError('Erro ao carregar ordens'); }
        finally { if (!silencioso) setLoadingO(false); }
    }, []);

    const fetchAuxiliares = useCallback(async () => {
        try {
            const res = await api.get('/products', { params: { is_materia_prima: 'true' } });
            const produtos = (res.data ?? []).map((p: any) => ({
                ...p,
                unit: p.unidade_medida || 'UN',
                price: Number(p.preco_compra || p.price || 0),
            }));
            setMaterias(produtos);
        } catch { /* silencioso */ }
    }, []);

    const consultarDesperdicios = useCallback(async () => {
        if (desperdicioPeriodo === 'personalizado' && (!desperdicioDataInicio || !desperdicioDataFim)) {
            return showError('Informe a data inicial e a data final');
        }
        setLoadingDesperdicio(true);
        try {
            const params: Record<string, string> = { periodo: desperdicioPeriodo };
            if (desperdicioPeriodo === 'personalizado') {
                params.dataInicio = desperdicioDataInicio;
                params.dataFim = desperdicioDataFim;
            }
            const res = await api.get('/producao/relatorios/desperdicios', { params });
            setDesperdicioRelatorio(res.data);
        } catch (err: any) {
            setDesperdicioRelatorio(null);
            showError(mensagemErro(err, 'Erro ao carregar relatório de desperdícios'));
        } finally {
            setLoadingDesperdicio(false);
        }
    }, [desperdicioPeriodo, desperdicioDataInicio, desperdicioDataFim]);

    const abrirRelatorioDesperdicios = () => {
        setDesperdicioDialog(true);
        void consultarDesperdicios();
    };

    useEffect(() => {
        fetchReceitas();
        fetchOrdens();
        fetchAuxiliares();
    }, [fetchReceitas, fetchOrdens, fetchAuxiliares]);

    useEffect(() => {
        const sincronizar = async () => {
            if (document.visibilityState !== 'visible' || sincronizandoRef.current) return;
            sincronizandoRef.current = true;
            try {
                await Promise.all([fetchOrdens(true), fetchAuxiliares()]);
            } finally {
                sincronizandoRef.current = false;
            }
        };

        const aoVoltarParaAba = () => {
            if (document.visibilityState === 'visible') void sincronizar();
        };

        const intervalId = window.setInterval(() => void sincronizar(), 3000);
        window.addEventListener('focus', sincronizar);
        document.addEventListener('visibilitychange', aoVoltarParaAba);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', sincronizar);
            document.removeEventListener('visibilitychange', aoVoltarParaAba);
        };
    }, [fetchOrdens, fetchAuxiliares]);

    // ══ RECEITAS ══════════════════════════════════════════════════════════

    const abrirNovaReceita = () => {
        setEditReceita(null);
        setRecNome(''); setRecDescricao(''); setRecValorUnit(null); setRecRendimento(null); setRecItens([]);
        setRecUnidade('UN'); setRecMateriaPrima(false);
        setReceitaDialog(true);
    };

    const abrirEditReceita = (r: Receita) => {
        setEditReceita(r);
        setRecUnidade(r.produto?.unidade_medida || 'UN');
        setRecMateriaPrima(r.produto?.is_materia_prima ?? false);
        setRecNome(r.nome);
        setRecDescricao(r.descricao ?? '');
        setRecValorUnit(r.valor_unitario ?? null);
        setRecRendimento(r.rendimento ?? null);
        setRecItens(r.itens.map(i => ({
            ...i,
            produto_id: i.produto_id || undefined,
            raw_material_id: i.raw_material_id || undefined,
        })));
        setReceitaDialog(true);
    };

    const salvarReceita = async () => {
        if (!recNome.trim()) return showError('Informe o nome do produto/receita');
        if (!(Number(recRendimento) > 0)) return showError('Informe o rendimento por receita');
        if (recItens.length === 0) return showError('Adicione pelo menos uma matéria-prima');
        if (recItens.some(i => (!i.raw_material_id && !i.produto_id) || i.quantidade <= 0))
            return showError('Preencha matéria-prima e quantidade em todos os itens');

        setSalvando(true);
        try {
            const payload = { nome: recNome, descricao: recDescricao, valor_unitario: recValorUnit, rendimento: recRendimento, unidade_medida: recUnidade, is_materia_prima: recMateriaPrima, itens: recItens };
            if (editReceita) {
                await api.put(`/producao/receitas/${editReceita.id}`, payload);
                showSuccess('Receita atualizada');
            } else {
                await api.post('/producao/receitas', payload);
                showSuccess('Receita criada');
            }
            setReceitaDialog(false);
            fetchReceitas();
        } catch (err: any) {
            showError(mensagemErro(err, 'Erro ao salvar receita'));
        } finally { setSalvando(false); }
    };

    const excluirReceita = (r: Receita) => {
        confirmDialog({
            message: `Excluir a receita "${r.nome}"?`,
            header: 'Confirmar exclusão',
            icon: 'pi pi-trash',
            acceptLabel: 'Excluir', rejectLabel: 'Cancelar',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await api.delete(`/producao/receitas/${r.id}`);
                    showSuccess('Receita excluída');
                    fetchReceitas();
                } catch (err: any) {
                    showError(mensagemErro(err, 'Erro ao excluir'));
                }
            }
        });
    };

    const abrirHistorico = async (r: Receita) => {
        setHistReceita(r);
        setHistDialog(true);
        setLoadingHist(true);
        try {
            const res = await api.get(`/producao/ordens/por-receita/${r.id}`);
            setHistOrdens(res.data ?? []);
        } catch { setHistOrdens([]); }
        finally { setLoadingHist(false); }
    };

    const abrirDetalhesConsumo = async (o: OrdemProducao) => {
        setConsumoOrdem(null);
        setConsumoDialog(true);
        setLoadingConsumo(true);
        try {
            const res = await api.get(`/producao/ordens/${o.id}/consumo`);
            setConsumoOrdem(res.data);
        } catch (err: any) {
            setConsumoDialog(false);
            showError(mensagemErro(err, 'Erro ao carregar o consumo da produção'));
        } finally { setLoadingConsumo(false); }
    };

    const desfazerOrdem = (o: OrdemProducao) => {
        confirmDialog({
            message: 'A produção será retirada do estoque, os insumos serão devolvidos e a ordem ficará marcada como desfeita. Se o produto já foi vendido ou movimentado, a operação será recusada. Deseja continuar?',
            header: 'Desfazer produção concluída',
            icon: 'pi pi-undo',
            acceptLabel: 'Desfazer produção',
            rejectLabel: 'Voltar',
            acceptClassName: 'p-button-warning',
            accept: async () => {
                try {
                    await api.post(`/producao/ordens/${o.id}/desfazer`);
                    showSuccess('Produção desfeita. Estoque e histórico foram ajustados.');
                    await fetchOrdens();
                    await fetchAuxiliares();
                    if (histReceita) void abrirHistorico(histReceita);
                } catch (err: any) {
                    showError(mensagemErro(err, 'Erro ao desfazer produção'));
                }
            },
        });
    };

    const acoesReceitaBody = (r: Receita) => (
        <div className="flex gap-2">
            <Button icon="pi pi-history" size="small" text tooltip="Histórico de ordens"
                tooltipOptions={{ position: 'top' }} onClick={() => abrirHistorico(r)} />
            <Button icon="pi pi-pencil" size="small" text tooltip="Editar"
                tooltipOptions={{ position: 'top' }} onClick={() => abrirEditReceita(r)} />
            <Button icon="pi pi-trash" size="small" text severity="danger" tooltip="Excluir"
                tooltipOptions={{ position: 'top' }} onClick={() => excluirReceita(r)} />
        </div>
    );

    const resolverMP = useCallback((it: ReceitaItem) => {
        if (it.produto_id) return materias.find(m => m.id === it.produto_id) ?? it.produtoMP ?? it.materiaPrima;
        return materias.find(m => m.id === it.raw_material_id) ?? it.materiaPrima;
    }, [materias]);

    const ingredientesBody = (r: Receita) => (
        <div className="flex flex-column gap-1">
            {r.itens.map((it, i) => {
                const mp = resolverMP(it);
                return (
                    <span key={i} className="text-sm">
                        {mp?.name ?? '?'} — {fmtQtd(it.quantidade, mp?.unit ?? mp?.unidade_medida)} {mp?.unit ?? mp?.unidade_medida ?? ''}
                    </span>
                );
            })}
        </div>
    );

    // ══ ORDENS ════════════════════════════════════════════════════════════

    const sugestaoRendimento = (receitaId: number | null, qtdReceitas: number) => {
        const receita = receitas.find(r => r.id === receitaId);
        if (!receita) return qtdReceitas;
        const rendimento = Number(receita.rendimento_efetivo ?? receita.rendimento ?? 0);
        if (rendimento > 0) return rendimento * qtdReceitas;

        const unidadeFinal = (receita.produto?.unidade_medida || '').toUpperCase();
        if (unidadeFinal === 'KG') {
            return receita.itens.reduce((total, item) => {
                const mp = resolverMP(item);
                const unidade = (mp?.unit || mp?.unidade_medida || '').toUpperCase();
                const quantidade = Number(item.quantidade || 0);
                if (unidade === 'KG') return total + quantidade;
                if (unidade === 'G') return total + quantidade / 1000;
                return total;
            }, 0) * qtdReceitas;
        }
        return qtdReceitas;
    };

    const abrirNovaOrdem = () => {
        setOrdReceitaId(null); setOrdQtd(1); setOrdQtdFinal(1); setOrdObs('');
        setOrdemDialog(true);
    };

    const salvarOrdem = async () => {
        if (!ordReceitaId) return showError('Selecione uma receita');
        if (ordQtd <= 0 || ordQtdFinal <= 0) return showError('As quantidades devem ser maiores que zero');
        setSalvando(true);
        try {
            await api.post('/producao/ordens', { receita_id: ordReceitaId, quantidade: ordQtd, quantidade_final: ordQtdFinal, observacao: ordObs });
            showSuccess('Ordem criada');
            setOrdemDialog(false);
            fetchOrdens();
        } catch (err: any) {
            showError(mensagemErro(err, 'Erro ao criar ordem'));
        } finally { setSalvando(false); }
    };

    const abrirConcluirOrdem = (o: OrdemProducao) => {
        if (!o.receita?.itens) return showError('Receita sem ingredientes');
        const qtd = Number(o.quantidade);
        const itens = o.receita.itens.map(item => {
            const mp = resolverMP(item);
            return {
                produto_id: item.produto_id || undefined,
                raw_material_id: item.raw_material_id || undefined,
                nome: mp?.name ?? '?',
                unidade: mp?.unit ?? mp?.unidade_medida ?? 'UN',
                quantidade_receita: Number(item.quantidade) * qtd,
                quantidade_real: Number(item.quantidade) * qtd,
            };
        });
        setConcluirOrdemObj(o);
        const previstoFicha = sugestaoRendimento(o.receita_id, qtd);
        const previstoOrdem = Number(o.quantidade_final ?? 0);
        const proporcao = previstoFicha > 0 ? previstoOrdem / previstoFicha : 1;
        // Ordens antigas podiam carregar o padrão 1 mesmo quando a ficha rendia
        // dezenas de unidades. Nesse caso abrimos com a previsão correta; uma
        // previsão personalizada plausível continua preservada.
        setConcluirQtdFinal(previstoOrdem > 0 && proporcao >= 0.25 && proporcao <= 4 ? previstoOrdem : previstoFicha);
        setConcluirItens(itens);
        setConcluirClassificacao(o.classificacao_desperdicio || 'desperdicio_real');
        setConcluirObsDesperdicio(o.observacao_desperdicio || '');
        setConcluirDialog(true);
    };

    const executarConclusao = async (confirmarDivergencia = false) => {
        if (!concluirOrdemObj) return;
        setSalvando(true);
        try {
            await api.post(`/producao/ordens/${concluirOrdemObj.id}/concluir`, {
                itens: concluirItens.map(it => ({
                    produto_id: it.produto_id || null,
                    raw_material_id: it.raw_material_id || null,
                    quantidade_real: it.quantidade_real,
                })),
                quantidade_final_real: concluirQtdFinal,
                confirmar_divergencia_quantidade: confirmarDivergencia,
                classificacao_desperdicio: concluirClassificacao,
                observacao_desperdicio: concluirObsDesperdicio
            });
            showSuccess('Produção concluída! Estoque atualizado.');
            setConcluirDialog(false);
            setConcluirOrdemObj(null);
            fetchOrdens();
            fetchAuxiliares();
        } catch (err: any) {
            showError(mensagemErro(err, 'Erro ao concluir produção'));
        } finally { setSalvando(false); }
    };

    const confirmarConclusao = () => {
        if (!concluirOrdemObj) return;
        const esperado = sugestaoRendimento(concluirOrdemObj.receita_id, Number(concluirOrdemObj.quantidade));
        const proporcao = esperado > 0 ? concluirQtdFinal / esperado : 1;
        const divergenciaAtipica = proporcao < 0.25 || proporcao > 4;
        if (!divergenciaAtipica) {
            void executarConclusao(false);
            return;
        }
        confirmDialog({
            header: 'Quantidade muito diferente do esperado',
            message: `A ficha indica aproximadamente ${fmtQtd(esperado, concluirOrdemObj.receita?.produto?.unidade_medida)}, mas foi informado ${fmtQtd(concluirQtdFinal, concluirOrdemObj.receita?.produto?.unidade_medida)}. Confirme somente se a contagem foi conferida.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Conferi e quero concluir',
            rejectLabel: 'Voltar e corrigir',
            acceptClassName: 'p-button-warning',
            accept: () => { void executarConclusao(true); },
        });
    };

    const cancelarOrdem = (o: OrdemProducao) => {
        confirmDialog({
            message: 'Cancelar esta ordem de produção?',
            header: 'Confirmar cancelamento',
            icon: 'pi pi-times-circle',
            acceptLabel: 'Cancelar ordem', rejectLabel: 'Voltar',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await api.post(`/producao/ordens/${o.id}/cancelar`);
                    showSuccess('Ordem cancelada');
                    fetchOrdens();
                } catch (err: any) {
                    showError(mensagemErro(err, 'Erro ao cancelar'));
                }
            }
        });
    };

    const acoesOrdemBody = (o: OrdemProducao) => {
        if (o.status === 'pendente') {
            return (
                <div className="flex gap-2">
                    <Button icon="pi pi-check" size="small" severity="success"
                        tooltip="Concluir produção" tooltipOptions={{ position: 'top' }}
                        onClick={() => abrirConcluirOrdem(o)} />
                    <Button icon="pi pi-times" size="small" severity="danger" text
                        tooltip="Cancelar ordem" tooltipOptions={{ position: 'top' }}
                        onClick={() => cancelarOrdem(o)} />
                </div>
            );
        }
        if (o.status === 'concluida') {
            return (
                <div className="flex gap-2">
                    <Button icon="pi pi-eye" size="small" text
                        tooltip="Ver insumos utilizados" tooltipOptions={{ position: 'top' }}
                        onClick={() => void abrirDetalhesConsumo(o)} />
                    <Button icon="pi pi-undo" size="small" severity="warning" text
                        tooltip="Desfazer produção" tooltipOptions={{ position: 'top' }}
                        onClick={() => desfazerOrdem(o)} />
                </div>
            );
        }
        if (o.status === 'desfeita') {
            return <Button icon="pi pi-eye" size="small" text
                tooltip="Ver insumos utilizados" tooltipOptions={{ position: 'top' }}
                onClick={() => void abrirDetalhesConsumo(o)} />;
        }
        return null;
    };

    // ── Filtro de ordens ────────────────────────────────────────────────
    const ordensFiltradas = useMemo(() => {
        let lista = [...ordens];

        if (filtroStatus) {
            lista = lista.filter(o => o.status === filtroStatus);
        }

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const ontem = new Date(hoje);
        ontem.setDate(ontem.getDate() - 1);

        if (filtroPeriodo === 'hoje') {
            lista = lista.filter(o => new Date(o.created_at) >= hoje);
        } else if (filtroPeriodo === 'ontem') {
            lista = lista.filter(o => { const d = new Date(o.created_at); return d >= ontem && d < hoje; });
        } else if (filtroPeriodo === 'personalizado') {
            if (filtroDataInicio) {
                const inicio = new Date(filtroDataInicio);
                inicio.setHours(0, 0, 0, 0);
                lista = lista.filter(o => new Date(o.created_at) >= inicio);
            }
            if (filtroDataFim) {
                const fim = new Date(filtroDataFim);
                fim.setHours(23, 59, 59, 999);
                lista = lista.filter(o => new Date(o.created_at) <= fim);
            }
        }
        // 'todas' => sem filtro de data

        return lista;
    }, [ordens, filtroStatus, filtroPeriodo, filtroDataInicio, filtroDataFim]);

    // Ordens pendentes para a comanda fullscreen (sempre do dia, independente do filtro da tabela)
    const ordensPendentesHoje = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return ordens.filter(o => o.status === 'pendente' && new Date(o.created_at) >= hoje);
    }, [ordens]);

    // ── Previsão de consumo de MP pelas ordens pendentes ─────────────────
    const previsaoMP = useMemo(() => {
        const pendentes = ordens.filter(o => o.status === 'pendente');
        const consumo: Record<number, { mp: MateriaPrima; consumoPrevisto: number }> = {};

        for (const ordem of pendentes) {
            if (!ordem.receita?.itens) continue;
            for (const item of ordem.receita.itens) {
                const mpAtual = resolverMP(item);
                if (!mpAtual) continue;
                const total = Number(item.quantidade) * Number(ordem.quantidade);
                if (!consumo[mpAtual.id]) consumo[mpAtual.id] = { mp: mpAtual, consumoPrevisto: 0 };
                consumo[mpAtual.id].consumoPrevisto += total;
            }
        }

        return Object.values(consumo).map(({ mp, consumoPrevisto }) => ({
            mp,
            consumoPrevisto,
            estoqueAtual: Number(mp.currentQuantity),
            saldoApos: Number(mp.currentQuantity) - consumoPrevisto,
            deficit: consumoPrevisto > Number(mp.currentQuantity),
        })).sort((a, b) => (a.deficit ? -1 : 1) - (b.deficit ? -1 : 1));
    }, [ordens, resolverMP]);

    // ── Custo estimado ────────────────────────────────────────────────────
    const calcularCusto = (receita: Receita | undefined, qtd: number): number => {
        if (!receita || !receita.itens) return 0;
        return receita.itens.reduce((total, item) => {
            const mp = resolverMP(item);
            const preco = Number(mp?.price ?? 0);
            return total + preco * Number(item.quantidade) * qtd;
        }, 0);
    };

    // Preview de consumo de MP + custo estimado na dialog de nova ordem
    const previewConsumo = () => {
        if (!ordReceitaId || ordQtd <= 0) return null;
        const rec = receitas.find(r => r.id === ordReceitaId);
        if (!rec || rec.itens.length === 0) return null;

        const itensComStatus = rec.itens.map(item => {
            const mp = resolverMP(item);
            const consumo    = Number(item.quantidade) * ordQtd;
            const disponivel = Number(mp?.currentQuantity ?? 0);
            const preco      = Number(mp?.price ?? 0);
            const custoItem  = preco * consumo;
            return { mp, consumo, disponivel, ok: disponivel >= consumo, preco, custoItem, semPreco: preco === 0 };
        });

        const tudo_ok   = itensComStatus.every(i => i.ok);
        const custoTotal = itensComStatus.reduce((acc, i) => acc + i.custoItem, 0);
        const algumSemPreco = itensComStatus.some(i => i.semPreco);

        return (
            <div className="col-12">
                <div className="p-3 border-round mt-1"
                    style={{ background: tudo_ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${tudo_ok ? '#bbf7d0' : '#fecaca'}` }}>
                    <div className="font-semibold mb-2" style={{ color: tudo_ok ? '#16a34a' : '#dc2626' }}>
                        <i className={`pi ${tudo_ok ? 'pi-check-circle' : 'pi-exclamation-triangle'} mr-1`} />
                        {tudo_ok ? 'Estoque suficiente' : 'Estoque insuficiente para alguns itens'}
                    </div>
                    {itensComStatus.map((it, i) => (
                        <div key={i} className="flex justify-content-between text-sm mb-1">
                            <span>{it.mp?.name ?? '?'}</span>
                            <div className="flex gap-3">
                                <span style={{ color: it.ok ? '#16a34a' : '#dc2626' }}>
                                    {fmtQtd(it.consumo, it.mp?.unit)} {it.mp?.unit} {it.ok ? '✓' : `✗ (tem ${fmtQtd(it.disponivel, it.mp?.unit)})`}
                                </span>
                                <span style={{ color: it.semPreco ? '#9ca3af' : '#374151', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>
                                    {it.semPreco ? 'sem preço' : fmtCurrency(it.custoItem)}
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* Custo total estimado */}
                    <div className="flex justify-content-between align-items-center mt-2 pt-2" style={{ borderTop: '1px solid #e5e7eb' }}>
                        <span className="font-bold text-sm">Custo estimado da ordem</span>
                        <span style={{ fontWeight: 800, fontSize: 16, color: '#1e40af' }}>
                            {fmtCurrency(custoTotal)}
                        </span>
                    </div>
                    {algumSemPreco && (
                        <small style={{ color: '#f59e0b', display: 'block', marginTop: 4 }}>
                            ⚠ Algumas matérias-primas sem preço cadastrado — custo pode estar incompleto
                        </small>
                    )}
                </div>
            </div>
        );
    };

    // Custo estimado inline na tabela de ordens
    const custoOrdemBody = (o: OrdemProducao) => {
        const custo = calcularCusto(o.receita, Number(o.quantidade));
        if (custo === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
        return <span style={{ fontWeight: 700, color: '#1e40af' }}>{fmtCurrency(custo)}</span>;
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="grid producao-page">
            <Toast ref={toast} />
            <ConfirmDialog />

            {/* ─── RECEITAS ─── */}
            <div className="col-12">
                <div className="card">
                    <div className="flex justify-content-between align-items-center mb-4">
                        <h5 className="m-0">Receitas de Produção</h5>
                        <Button label="Nova Receita" icon="pi pi-plus" onClick={abrirNovaReceita} />
                    </div>

                    <DataTable value={receitas} loading={loadingR}
                        paginator rows={10} rowsPerPageOptions={[5, 10, 25, 50]}
                        emptyMessage="Nenhuma receita cadastrada"
                        tableStyle={{ minWidth: '40rem' }}>
                        <Column field="nome" header="Nome" sortable />
                        <Column header="Produto Final / Estoque" body={(r: Receita) =>
                            r.produto
                                ? <span>{r.produto.name} <span className="text-color-secondary text-sm">({fmtQtd(r.produto.currentQuantity, r.produto.unidade_medida)} em estoque)</span></span>
                                : <span className="text-color-secondary">—</span>} />
                        <Column header="Custo da receita" body={(r: Receita) =>
                            r.custo_estimado != null ? <div>
                                <div style={{ fontWeight: 700, color: '#1e40af' }}>{fmtCurrency(Number(r.custo_estimado))} <span className="text-color-secondary font-normal text-xs">por lote</span></div>
                                {r.custo_pendente
                                    ? <div className="text-sm mt-1 text-orange-600"><b>Informe o rendimento</b> para calcular por unidade</div>
                                    : <div className="text-sm mt-1"><b>{fmtCurrency(Number(r.custo_unitario ?? 0))}</b> por unidade</div>}
                                {r.rendimento_inferido && <Tag className="mt-2" severity={r.rendimento_pendente ? 'warning' : 'info'} value={r.rendimento_pendente ? 'Rendimento pendente' : `Rendimento ${fmtQtd(r.rendimento_efetivo)} inferido`} />}
                            </div>
                            : <span className="text-color-secondary text-sm">não calculado</span>} style={{ width: '220px' }} />
                        <Column header="Ingredientes" body={ingredientesBody} />
                        <Column body={acoesReceitaBody} style={{ width: '9rem' }} />
                    </DataTable>
                </div>
            </div>

            {/* ─── PREVISÃO DE MATÉRIAS-PRIMAS ─── */}
            {previsaoMP.length > 0 && (
                <div className="col-12">
                    <div className="card">
                        <div className="flex align-items-center gap-2 mb-3">
                            <i className="pi pi-chart-line" style={{ color: '#6366f1', fontSize: '1.2rem' }} />
                            <h5 className="m-0">Previsão de Consumo — Ordens Pendentes</h5>
                        </div>

                        {previsaoMP.some(p => p.deficit) && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="pi pi-exclamation-triangle" style={{ color: '#dc2626' }} />
                                <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 13 }}>
                                    {previsaoMP.filter(p => p.deficit).length} matéria(s)-prima com estoque insuficiente para as ordens pendentes
                                </span>
                            </div>
                        )}

                        <DataTable value={previsaoMP} className="p-datatable-sm" emptyMessage="Nenhuma ordem pendente">
                            <Column header="Matéria-Prima" body={(r: any) => <span className="font-semibold">{r.mp.name}</span>} />
                            <Column header="Estoque Atual" body={(r: any) => (
                                <span style={{ fontWeight: 700, color: r.deficit ? '#dc2626' : '#16a34a' }}>
                                    {fmtQtd(r.estoqueAtual, r.mp.unit)} {r.mp.unit}
                                </span>
                            )} />
                            <Column header="Consumo Previsto" body={(r: any) => (
                                <span style={{ fontWeight: 700, color: '#6366f1' }}>
                                    {fmtQtd(r.consumoPrevisto, r.mp.unit)} {r.mp.unit}
                                </span>
                            )} />
                            <Column header="Saldo Após Produção" body={(r: any) => (
                                <span style={{ fontWeight: 800, color: r.saldoApos >= 0 ? '#16a34a' : '#dc2626' }}>
                                    {r.saldoApos >= 0 ? '+' : ''}{fmtQtd(r.saldoApos, r.mp.unit)} {r.mp.unit}
                                </span>
                            )} />
                            <Column header="Situação" body={(r: any) => (
                                r.deficit
                                    ? <Tag severity="danger" value={`Faltam ${fmtQtd(Math.abs(r.saldoApos), r.mp.unit)} ${r.mp.unit}`} />
                                    : <Tag severity="success" value="Estoque OK" />
                            )} />
                        </DataTable>
                    </div>
                </div>
            )}

            {/* ─── ORDENS DE PRODUÇÃO ─── */}
            <div className="col-12">
                <div className="card">
                    <div className="flex justify-content-between align-items-center mb-3">
                        <h5 className="m-0">Ordens de Produção</h5>
                        <div className="flex gap-2">
                            <Button label="Relatório de Desperdícios" icon="pi pi-chart-bar" severity="help" outlined
                                onClick={abrirRelatorioDesperdicios} />
                            <Button label="Relatório de Produção" icon="pi pi-chart-line" severity="help" outlined
                                onClick={() => router.push('/uikit/relatorios-produtos?aba=producao')} />
                            <Button label="Comanda" icon="pi pi-window-maximize" severity="secondary" outlined
                                onClick={() => setFullscreenAberto(true)}
                                disabled={ordensPendentesHoje.length === 0}
                                tooltip={ordensPendentesHoje.length === 0 ? 'Nenhuma ordem pendente hoje' : 'Visualizar comandas em tela cheia'} />
                            <Button label="Nova Ordem" icon="pi pi-plus" onClick={abrirNovaOrdem}
                                disabled={receitas.length === 0} tooltip={receitas.length === 0 ? 'Cadastre uma receita primeiro' : undefined} />
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-wrap align-items-center gap-2 mb-3">
                        <Dropdown
                            value={filtroStatus}
                            onChange={e => setFiltroStatus(e.value)}
                            options={[
                                { label: 'Todos os status', value: null },
                                { label: 'Pendentes', value: 'pendente' },
                                { label: 'Concluídas', value: 'concluida' },
                                { label: 'Canceladas', value: 'cancelada' },
                                { label: 'Desfeitas', value: 'desfeita' },
                            ]}
                            className="w-auto" style={{ minWidth: 160 }}
                        />
                        <Dropdown
                            value={filtroPeriodo}
                            onChange={e => setFiltroPeriodo(e.value ?? filtroPeriodo)}
                            options={[
                                { label: 'Hoje', value: 'hoje' },
                                { label: 'Ontem', value: 'ontem' },
                                { label: 'Todas as datas', value: 'todas' },
                                { label: 'Personalizado', value: 'personalizado' },
                            ]}
                            className="w-auto" style={{ minWidth: 150 }}
                        />
                        {filtroPeriodo === 'personalizado' && (
                            <>
                                <Calendar value={filtroDataInicio ? new Date(filtroDataInicio + 'T12:00:00') : null}
                                    onChange={e => setFiltroDataInicio(e.value ? (e.value as Date).toISOString().slice(0, 10) : '')}
                                    placeholder="Início" dateFormat="dd/mm/yy" showIcon
                                    style={{ width: 150 }} />
                                <Calendar value={filtroDataFim ? new Date(filtroDataFim + 'T12:00:00') : null}
                                    onChange={e => setFiltroDataFim(e.value ? (e.value as Date).toISOString().slice(0, 10) : '')}
                                    placeholder="Fim" dateFormat="dd/mm/yy" showIcon
                                    style={{ width: 150 }} />
                            </>
                        )}
                        <span className="text-sm text-color-secondary ml-auto">{ordensFiltradas.length} ordem(ns)</span>
                    </div>

                    <DataTable value={ordensFiltradas} loading={loadingO}
                        paginator rows={10} rowsPerPageOptions={[5, 10, 25, 50]}
                        emptyMessage="Nenhuma ordem de produção"
                        tableStyle={{ minWidth: '40rem' }}>
                        <Column header="Data" body={(o: OrdemProducao) => fmtData(o.created_at)} style={{ width: '8rem' }} />
                        <Column header="Receita" body={(o: OrdemProducao) => o.receita?.nome ?? '—'} sortable />
                        <Column header="Produto Final" body={(o: OrdemProducao) =>
                            o.receita?.produto?.name ?? <span className="text-color-secondary">—</span>} />
                        <Column field="quantidade" header="Qtd." style={{ width: '5rem' }} />
                        <Column header="Custo Est." body={custoOrdemBody} style={{ width: '110px' }} />
                        <Column header="Status" body={statusBody} style={{ width: '8rem' }} />
                        <Column body={acoesOrdemBody} style={{ width: '8rem' }} />
                    </DataTable>
                </div>
            </div>

            {/* ══ DIALOG: Receita ══ */}
            <Dialog
                header={editReceita ? 'Editar Receita' : 'Nova Receita'}
                visible={receitaDialog}
                style={{ width: '620px' }}
                modal
                onHide={() => setReceitaDialog(false)}
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" text onClick={() => setReceitaDialog(false)} disabled={salvando} />
                        <Button label="Salvar" icon="pi pi-check" onClick={salvarReceita} loading={salvando} />
                    </div>
                }
            >
                <div className="grid formgrid pt-2">
                    <div className="col-12 field">
                        <label className="font-semibold">Nome do Produto *</label>
                        <InputText value={recNome} onChange={e => setRecNome(e.target.value)}
                            className="w-full" placeholder="Ex: Mesa de Madeira" />
                        <small className="text-color-secondary">Este nome será o produto criado no estoque ao concluir a produção.</small>
                    </div>

                    <div className="col-12 md:col-6 field">
                        <label className="font-semibold">Valor unitário (R$)</label>
                        <InputNumber
                            value={recValorUnit}
                            onValueChange={e => setRecValorUnit(e.value ?? null)}
                            mode="currency" currency="BRL" locale="pt-BR"
                            placeholder="Ex: 150,00"
                            className="w-full" inputClassName="w-full"
                        />
                        <small className="text-color-secondary">Preço do produto no estoque ao produzir.</small>
                    </div>

                    <div className="col-12 md:col-6 field">
                        <label className="font-semibold">Rendimento por receita *</label>
                        <InputNumber
                            value={recRendimento}
                            onValueChange={e => setRecRendimento(e.value ?? null)}
                            min={0.001} minFractionDigits={0} maxFractionDigits={3}
                            placeholder="Ex.: 20"
                            className="w-full" inputClassName="w-full"
                        />
                        <small className="text-color-secondary">Quantidade total produzida por lote. Esse valor é necessário para calcular o custo unitário e o CMV.</small>
                    </div>

                    <div className="col-12 md:col-6 field">
                        <label className="font-semibold">Unidade de Medida</label>
                        <Dropdown value={recUnidade} options={unidadesOpcoes}
                            onChange={e => setRecUnidade(e.value)} className="w-full" />
                    </div>
                    <div className="col-12 md:col-6 field">
                        <label className="font-semibold mb-2 block">Opções</label>
                        <div className="flex align-items-center gap-2">
                            <input
                                id="recMP"
                                type="checkbox"
                                checked={recMateriaPrima}
                                onChange={e => setRecMateriaPrima(e.target.checked)}
                                style={{ width: 18, height: 18, accentColor: '#3b82f6', flex: '0 0 auto' }}
                            />
                            <label htmlFor="recMP" className="text-sm cursor-pointer">Também é matéria-prima</label>
                        </div>
                        <small className="text-color-secondary block mt-1">Disponível como ingrediente em outras receitas.</small>
                    </div>

                    <div className="col-12 field">
                        <label className="font-semibold">Descrição</label>
                        <InputTextarea value={recDescricao} onChange={e => setRecDescricao(e.target.value)}
                            rows={2} className="w-full" placeholder="Observações sobre o processo..." autoResize />
                    </div>

                    <div className="col-12 field">
                        <div className="flex justify-content-between align-items-center mb-2">
                            <label className="font-semibold m-0">Matérias-Primas *</label>
                            <Button label="+ Adicionar" text size="small"
                                onClick={() => setRecItens(prev => [...prev, { produto_id: 0, quantidade: 1 }])} />
                        </div>

                        {recItens.length === 0 && (
                            <div className="text-center text-color-secondary py-3 border-round"
                                style={{ border: '1px dashed #dee2e6' }}>
                                Clique em &quot;+ Adicionar&quot; para incluir ingredientes
                            </div>
                        )}

                        <div className="flex flex-column gap-2">
                            {recItens.map((item, idx) => {
                                const itemId = item.produto_id || item.raw_material_id;
                                const mp = materias.find(m => m.id === itemId);
                                const mpUnitUp = (mp?.unidade_medida || mp?.unit || '').toUpperCase();
                                const mpIsInt  = ['UN','CX','PC','DZ','CT'].includes(mpUnitUp);
                                return (
                                    <div key={idx} className="flex gap-2 align-items-center p-2 border-round"
                                        style={{ border: '1px solid #dee2e6' }}>
                                        <Dropdown
                                            value={itemId || null}
                                            onChange={e => setRecItens(prev => prev.map((it, i) => i === idx ? { ...it, produto_id: e.value, raw_material_id: undefined } : it))}
                                            options={materias.map(m => ({ label: `${m.name} (estoque: ${fmtQtd(m.currentQuantity, m.unit)} ${m.unit})`, value: m.id }))}
                                            placeholder="Selecionar matéria-prima"
                                            className="flex-1" filter
                                        />
                                        <InputNumber
                                            value={item.quantidade}
                                            onValueChange={e => setRecItens(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: e.value ?? 1 } : it))}
                                            min={mpIsInt ? 1 : 0.001} step={mpIsInt ? 1 : 0.001}
                                            minFractionDigits={0} maxFractionDigits={mpIsInt ? 0 : 3}
                                            suffix={mp ? ` ${mp.unit}` : ''}
                                            style={{ width: '130px' }} inputClassName="w-full"
                                        />
                                        <Button icon="pi pi-trash" text severity="danger" size="small"
                                            onClick={() => setRecItens(prev => prev.filter((_, i) => i !== idx))} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* ══ DIALOG: Nova Ordem ══ */}
            <Dialog
                header="Nova Ordem de Produção"
                visible={ordemDialog}
                style={{ width: 'min(720px, 95vw)' }}
                modal
                onHide={() => setOrdemDialog(false)}
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" text onClick={() => setOrdemDialog(false)} disabled={salvando} />
                        <Button label="Criar Ordem" icon="pi pi-plus" onClick={salvarOrdem} loading={salvando} />
                    </div>
                }
            >
                <div className="grid formgrid pt-2">
                    <div className="col-12 field">
                        <label className="font-semibold">Receita *</label>
                        <Dropdown
                            value={ordReceitaId}
                            onChange={e => {
                                setOrdReceitaId(e.value);
                                setOrdQtdFinal(sugestaoRendimento(e.value, ordQtd));
                            }}
                            options={receitas.map(r => ({ label: r.nome, value: r.id }))}
                            placeholder="Selecione a receita"
                            className="w-full" filter
                        />
                    </div>

                    <div className="col-12 field">
                        <label className="font-semibold">Quantidade de receitas *</label>
                        <InputNumber
                            value={ordQtd}
                            onValueChange={e => {
                                const next = e.value ?? 1;
                                setOrdQtd(prev => {
                                    setOrdQtdFinal(final => final === sugestaoRendimento(ordReceitaId, prev) ? sugestaoRendimento(ordReceitaId, next) : final);
                                    return next;
                                });
                            }}
                            min={1} minFractionDigits={0} maxFractionDigits={3}
                            className="w-full" inputClassName="w-full"
                        />
                        <small className="text-color-secondary">Quantas vezes a receita será preparada. Define o consumo dos ingredientes.</small>
                    </div>

                    <div className="col-12 field">
                        <label className="font-semibold">Produtos finais que vão entrar no estoque *</label>
                        <InputNumber
                            value={ordQtdFinal}
                            onValueChange={e => setOrdQtdFinal(e.value ?? 1)}
                            min={1} minFractionDigits={0} maxFractionDigits={3}
                            className="w-full" inputClassName="w-full"
                        />
                        <small className="text-color-secondary">Rendimento previsto pela ficha: {fmtQtd(sugestaoRendimento(ordReceitaId, ordQtd), receitas.find(r => r.id === ordReceitaId)?.produto?.unidade_medida)}. Ajuste apenas se a previsão da ordem for diferente.</small>
                    </div>

                    {previewConsumo()}

                    <div className="col-12 field">
                        <label className="font-semibold">Observação</label>
                        <InputTextarea value={ordObs} onChange={e => setOrdObs(e.target.value)}
                            rows={2} className="w-full" placeholder="Opcional..." autoResize />
                    </div>
                </div>
            </Dialog>

            {/* ══ DIALOG: Concluir Produção (baixa de ingredientes) ══ */}
            <Dialog
                header={
                    <div className="flex align-items-center gap-2">
                        <i className="pi pi-check-circle" style={{ color: '#16a34a' }} />
                        <span>Concluir Produção — {concluirOrdemObj?.receita?.nome}</span>
                    </div>
                }
                visible={concluirDialog}
                style={{ width: 'min(760px, 95vw)' }}
                baseZIndex={12000}
                modal
                blockScroll
                onHide={() => { if (!salvando) setConcluirDialog(false); }}
                footer={
                    <div className="flex justify-content-between align-items-center">
                        <div className="text-sm">
                            {concluirItens.some(it => it.quantidade_real > it.quantidade_receita) && (
                                <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                                    <i className="pi pi-exclamation-triangle mr-1" />
                                    Classifique o excedente antes de confirmar
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button label="Cancelar" text onClick={() => setConcluirDialog(false)} disabled={salvando} />
                            <Button label="Confirmar Produção" icon="pi pi-check" severity="success" onClick={confirmarConclusao} loading={salvando} />
                        </div>
                    </div>
                }
            >
                <div className="flex flex-column gap-1 pt-2">
                    <div className="text-sm text-color-secondary mb-3">
                        Confira e ajuste as quantidades reais utilizadas na produção de <strong>{concluirOrdemObj?.quantidade}x {concluirOrdemObj?.receita?.nome}</strong>.
                    </div>

                    <div className="p-3 border-round mb-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                        <label className="font-semibold block mb-2">Quanto foi produzido de verdade?</label>
                        <InputNumber
                            value={concluirQtdFinal}
                            onValueChange={e => setConcluirQtdFinal(e.value ?? 0)}
                            min={0.001} minFractionDigits={0} maxFractionDigits={3}
                            suffix={concluirOrdemObj?.receita?.produto?.unidade_medida ? ` ${concluirOrdemObj.receita.produto.unidade_medida}` : ''}
                            className="w-full" inputClassName="w-full"
                        />
                        <small className="text-color-secondary block mt-2">
                            Esperado pela ficha: {fmtQtd(concluirOrdemObj ? sugestaoRendimento(concluirOrdemObj.receita_id, Number(concluirOrdemObj.quantidade)) : 0, concluirOrdemObj?.receita?.produto?.unidade_medida)}.
                            Ajuste se rendeu menos ou mais; esse valor será lançado no estoque.
                        </small>
                    </div>

                    {concluirItens.some(it => it.quantidade_real > it.quantidade_receita) && (
                        <div className="p-3 border-round mb-3" style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
                            <label className="font-semibold block mb-2">Como classificar o material excedente?</label>
                            <Dropdown
                                value={concluirClassificacao}
                                onChange={e => setConcluirClassificacao(e.value)}
                                options={[
                                    { label: 'Rendimento excedente (virou produto)', value: 'rendimento_excedente' },
                                    { label: 'Avaria / desperdício real', value: 'desperdicio_real' },
                                    { label: 'Outro', value: 'outro' },
                                ]}
                                className="w-full mb-2"
                            />
                            <InputTextarea
                                value={concluirObsDesperdicio}
                                onChange={e => setConcluirObsDesperdicio(e.target.value)}
                                rows={2}
                                autoResize
                                className="w-full"
                                placeholder="Observação que aparecerá no relatório (opcional)"
                            />
                        </div>
                    )}

                    <div className="flex gap-2 mb-2 px-2" style={{ fontWeight: 700, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <span style={{ flex: 1 }}>Ingrediente</span>
                        <span style={{ width: 110, textAlign: 'center' }}>Receita</span>
                        <span style={{ width: 130, textAlign: 'center' }}>Utilizado</span>
                    </div>

                    {concluirItens.map((item, idx) => {
                        const excedente = item.quantidade_real > item.quantidade_receita;
                        const mpUnitUp = (item.unidade ?? '').toUpperCase();
                        const isInt = ['UN','CX','PC','DZ','CT','PCT'].includes(mpUnitUp);
                        return (
                            <div key={idx} className="flex align-items-center gap-2 p-2 border-round"
                                style={{ border: `1px solid ${excedente ? '#fbbf24' : '#e5e7eb'}`, background: excedente ? '#fffbeb' : 'transparent' }}>
                                <div style={{ flex: 1 }}>
                                    <span className="font-semibold text-sm">{item.nome}</span>
                                    {excedente && (
                                        <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 2 }}>
                                            +{fmtQtd(item.quantidade_real - item.quantidade_receita, item.unidade)} {item.unidade} excedente
                                        </div>
                                    )}
                                </div>
                                <div style={{ width: 110, textAlign: 'center' }}>
                                    <span className="text-sm text-color-secondary">{fmtQtd(item.quantidade_receita, item.unidade)} {item.unidade}</span>
                                </div>
                                <div style={{ width: 130 }}>
                                    <InputNumber
                                        value={item.quantidade_real}
                                        onValueChange={e => setConcluirItens(prev => prev.map((it, i) => i === idx ? { ...it, quantidade_real: e.value ?? 0 } : it))}
                                        min={0} step={isInt ? 1 : 0.001}
                                        minFractionDigits={0} maxFractionDigits={isInt ? 0 : 3}
                                        suffix={` ${item.unidade}`}
                                        className="w-full" inputClassName="w-full"
                                        inputStyle={{ textAlign: 'center', fontWeight: 700 }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Dialog>

            {/* ══ TELA CHEIA — COMANDAS ══ */}
            {fullscreenAberto && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: '#111827', color: '#f9fafb',
                    display: 'flex', flexDirection: 'column',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '16px 32px', borderBottom: '1px solid #374151', flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <i className="pi pi-list" style={{ fontSize: 24, color: '#60a5fa' }} />
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 800 }}>Comandas do Dia</div>
                                <div style={{ fontSize: 13, color: '#9ca3af' }}>
                                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} — {ordensPendentesHoje.length} pendente(s)
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setFullscreenAberto(false)}
                            style={{
                                background: '#374151', border: 'none', borderRadius: 8,
                                color: '#f9fafb', width: 48, height: 48, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 20,
                            }}
                        >
                            <i className="pi pi-times" />
                        </button>
                    </div>

                    {/* Grid de comandas */}
                    <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
                        {ordensPendentesHoje.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
                                <i className="pi pi-check-circle" style={{ fontSize: 64, marginBottom: 16, color: '#374151' }} />
                                <div style={{ fontSize: 24, fontWeight: 700 }}>Nenhuma comanda pendente</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
                                {ordensPendentesHoje.map(ordem => (
                                    <div key={ordem.id} style={{
                                        background: '#1f2937', borderRadius: 14, border: '1px solid #374151',
                                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                                    }}>
                                        {/* Cabeçalho da comanda */}
                                        <div style={{
                                            padding: '14px 20px', borderBottom: '1px solid #374151',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            background: '#1e3a5f',
                                        }}>
                                            <div>
                                                <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    #{ordem.id} — {fmtData(ordem.created_at)}
                                                </div>
                                                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{ordem.receita?.nome}</div>
                                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                                    {(ordem.receita?.itens ?? []).map(it => resolverMP(it)?.name ?? '?').join(', ')}
                                                </div>
                                            </div>
                                            <div style={{
                                                background: '#3b82f6', borderRadius: 10, padding: '6px 16px',
                                                fontSize: 28, fontWeight: 900, lineHeight: 1,
                                            }}>
                                                {isUnidadeInteira(ordem.receita?.produto?.unidade_medida) ? Math.round(Number(ordem.quantidade)) : ordem.quantidade}x
                                            </div>
                                        </div>

                                        {/* Ingredientes */}
                                        <div style={{ padding: '14px 20px', flex: 1 }}>
                                            {(ordem.receita?.itens ?? []).map((item, i) => {
                                                const mp = resolverMP(item);
                                                const un = mp?.unit ?? mp?.unidade_medida ?? '';
                                                const consumo = Number(item.quantidade) * Number(ordem.quantidade);
                                                return (
                                                    <div key={i} style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: '6px 0', borderBottom: i < (ordem.receita?.itens ?? []).length - 1 ? '1px solid #374151' : 'none',
                                                    }}>
                                                        <span style={{ fontSize: 16, fontWeight: 600 }}>{mp?.name ?? '?'}</span>
                                                        <span style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>
                                                            {fmtQtd(consumo, un)} {un}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Observação */}
                                        {ordem.observacao && (
                                            <div style={{ padding: '8px 20px', borderTop: '1px solid #374151', fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
                                                {ordem.observacao}
                                            </div>
                                        )}

                                        {/* Botão concluir */}
                                        <div style={{ padding: '10px 20px', borderTop: '1px solid #374151' }}>
                                            <button
                                                type="button"
                                                onClick={() => abrirConcluirOrdem(ordem)}
                                                style={{
                                                    width: '100%', background: '#16a34a', border: 'none', borderRadius: 8,
                                                    color: '#fff', padding: '10px', fontSize: 15, fontWeight: 700,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                                }}
                                            >
                                                <i className="pi pi-check" /> Concluir
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══ DIALOG: Relatório de Desperdícios ══ */}
            <Dialog
                header={<div className="flex align-items-center gap-2"><i className="pi pi-chart-bar" style={{ color: '#8b5cf6' }} /><span>Relatório de Desperdícios</span></div>}
                visible={desperdicioDialog}
                style={{ width: '980px', maxWidth: '96vw' }}
                modal
                onHide={() => setDesperdicioDialog(false)}
            >
                <div className="flex flex-wrap align-items-end gap-2 mb-3">
                    <div className="field m-0">
                        <label className="block text-sm font-semibold mb-1">Período</label>
                        <Dropdown
                            value={desperdicioPeriodo}
                            onChange={e => setDesperdicioPeriodo(e.value)}
                            options={[
                                { label: 'Dia atual', value: 'dia' },
                                { label: 'Semana atual', value: 'semana' },
                                { label: 'Mês atual', value: 'mes' },
                                { label: 'Personalizado', value: 'personalizado' },
                            ]}
                            style={{ minWidth: 170 }}
                        />
                    </div>
                    {desperdicioPeriodo === 'personalizado' && (
                        <>
                            <div className="field m-0">
                                <label className="block text-sm font-semibold mb-1">Início</label>
                                <Calendar
                                    value={desperdicioDataInicio ? new Date(`${desperdicioDataInicio}T12:00:00`) : null}
                                    onChange={e => setDesperdicioDataInicio(e.value ? toDateOnly(e.value as Date) : '')}
                                    placeholder="Data inicial" dateFormat="dd/mm/yy" showIcon
                                />
                            </div>
                            <div className="field m-0">
                                <label className="block text-sm font-semibold mb-1">Fim</label>
                                <Calendar
                                    value={desperdicioDataFim ? new Date(`${desperdicioDataFim}T12:00:00`) : null}
                                    onChange={e => setDesperdicioDataFim(e.value ? toDateOnly(e.value as Date) : '')}
                                    placeholder="Data final" dateFormat="dd/mm/yy" showIcon
                                />
                            </div>
                        </>
                    )}
                    <Button label="Consultar" icon="pi pi-search" onClick={() => void consultarDesperdicios()} loading={loadingDesperdicio} />
                </div>

                {desperdicioRelatorio && (
                    <div className="flex flex-wrap gap-3 mb-3">
                        <div className="p-3 border-round border-1 surface-border" style={{ minWidth: 170 }}>
                            <div className="text-sm text-color-secondary">Ocorrências</div>
                            <div className="text-2xl font-bold">{desperdicioRelatorio.resumo.totalOcorrencias}</div>
                        </div>
                        <div className="p-3 border-round border-1 surface-border" style={{ minWidth: 220 }}>
                            <div className="text-sm text-color-secondary">Período consultado</div>
                            <div className="font-bold">{desperdicioRelatorio.dataInicio.split('-').reverse().join('/')} a {desperdicioRelatorio.dataFim.split('-').reverse().join('/')}</div>
                        </div>
                        <div className="p-3 border-round border-1 surface-border" style={{ minWidth: 230 }}>
                            <div className="text-sm text-color-secondary">Produtos afetados</div>
                            <div className="text-2xl font-bold">{desperdicioRelatorio.resumo.porProduto.length}</div>
                        </div>
                        <div className="p-3 border-round border-1 surface-border" style={{ minWidth: 250 }}>
                            <div className="text-sm text-color-secondary">Classificação do excedente</div>
                            <div className="font-bold">{fmtQtd(desperdicioRelatorio.resumo.totalRendimentoExcedente)} rendimento / {fmtQtd(desperdicioRelatorio.resumo.totalDesperdicioReal)} desperdício real</div>
                        </div>
                    </div>
                )}

                {desperdicioRelatorio && desperdicioRelatorio.resumo.porProduto.length > 0 && (
                    <>
                        <h6 className="mt-0 mb-2">Resumo por produto</h6>
                        <DataTable value={desperdicioRelatorio.resumo.porProduto} className="p-datatable-sm mb-4">
                            <Column field="produtoNome" header="Produto / MP" />
                            <Column header="Quantidade desperdiçada" body={(item: DesperdicioRelatorio['resumo']['porProduto'][number]) => <span style={{ color: '#dc2626', fontWeight: 700 }}>{fmtQtd(item.quantidade, item.unidade)} {item.unidade}</span>} />
                            <Column field="ocorrencias" header="Ocorrências" />
                        </DataTable>
                        <h6 className="mb-2">Detalhamento</h6>
                    </>
                )}

                <DataTable
                    value={desperdicioRelatorio?.itens ?? []}
                    loading={loadingDesperdicio}
                    paginator rows={10} rowsPerPageOptions={[5, 10, 25, 50]}
                    emptyMessage="Nenhum desperdício encontrado no período"
                    className="p-datatable-sm"
                    tableStyle={{ minWidth: '760px' }}
                >
                    <Column header="Data" body={(item: DesperdicioItem) => fmtDataHora(item.data)} sortable />
                    <Column header="Produto / MP" body={(item: DesperdicioItem) => <span className="font-semibold">{item.produtoNome}</span>} sortable />
                    <Column header="Quantidade" body={(item: DesperdicioItem) => <span style={{ color: '#dc2626', fontWeight: 700 }}>{fmtQtd(item.quantidade, item.unidade)} {item.unidade}</span>} sortable />
                    <Column header="Receita" body={(item: DesperdicioItem) => item.receitaNome} />
                    <Column header="Ordem" body={(item: DesperdicioItem) => item.ordemId ? `#${item.ordemId}` : '—'} />
                    <Column header="Classificação" body={(item: DesperdicioItem) => (
                        <Tag value={item.classificacaoLabel || labelClassificacaoDesperdicio(item.classificacao)} severity={item.classificacao === 'rendimento_excedente' ? 'info' : item.classificacao === 'outro' ? 'warning' : 'danger'} />
                    )} />
                    <Column field="motivo" header="Motivo" />
                    <Column header="Observação" body={(item: DesperdicioItem) => item.observacao || '—'} />
                </DataTable>
                <small className="block text-color-secondary mt-3">
                    O relatório é somente leitura e inclui registros históricos já gravados no histórico de movimentações.
                </small>
            </Dialog>

            {/* ══ DIALOG: Consumo real da ordem ══ */}
            <Dialog
                header={<div className="flex align-items-center gap-2"><i className="pi pi-list" style={{ color: '#2563eb' }} /><span>Insumos utilizados — Ordem #{consumoOrdem?.ordemId ?? ''}</span></div>}
                visible={consumoDialog}
                style={{ width: '820px', maxWidth: '96vw' }}
                modal
                onHide={() => setConsumoDialog(false)}
            >
                {loadingConsumo ? (
                    <div className="flex justify-content-center p-4"><i className="pi pi-spin pi-spinner" style={{ fontSize: 24 }} /></div>
                ) : !consumoOrdem ? (
                    <div className="text-center text-color-secondary py-4">Não foi possível carregar o consumo desta ordem.</div>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-4 mb-3 p-3 border-round" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                            <div><div className="text-xs text-color-secondary">Receitas produzidas</div><strong>{fmtQtd(consumoOrdem.quantidadeReceitas, null)}</strong></div>
                            <div><div className="text-xs text-color-secondary">Produto final</div><strong>{consumoOrdem.quantidadeProduzida == null ? '—' : fmtQtd(consumoOrdem.quantidadeProduzida, null)}</strong></div>
                            <div><div className="text-xs text-color-secondary">Itens registrados</div><strong>{consumoOrdem.itens.length}</strong></div>
                            <div className="ml-auto"><Tag value={consumoOrdem.status === 'desfeita' ? 'Produção desfeita' : 'Produção concluída'} severity={consumoOrdem.status === 'desfeita' ? 'info' : 'success'} /></div>
                        </div>
                        <DataTable value={consumoOrdem.itens} className="p-datatable-sm" responsiveLayout="scroll" emptyMessage="Nenhum insumo registrado">
                            <Column field="nome" header="Insumo" body={(item: ConsumoItem) => <span className="font-semibold">{item.nome}</span>} />
                            <Column header="Previsto na ficha" body={(item: ConsumoItem) => item.quantidade_ficha == null ? '—' : `${fmtQtd(item.quantidade_ficha, item.unidade)} ${item.unidade}`} />
                            <Column header="Utilizado" body={(item: ConsumoItem) => <strong style={{ color: '#2563eb' }}>{fmtQtd(item.quantidade_real, item.unidade)} {item.unidade}</strong>} />
                            <Column header="Desperdício / excedente" body={(item: ConsumoItem) => item.quantidade_desperdicio > 0 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{fmtQtd(item.quantidade_desperdicio, item.unidade)} {item.unidade}</span> : '—'} />
                        </DataTable>
                        <small className="block text-color-secondary mt-3">
                            A quantidade utilizada representa o consumo real informado na conclusão da produção. Quando houver desperdício ou excedente, ele aparece separado, mas continua incluído no total retirado do estoque.
                            {consumoOrdem.fonte === 'movimentos_historicos' && ' Esta ordem é antiga e foi detalhada a partir do histórico de movimentações.'}
                        </small>
                    </>
                )}
            </Dialog>

            {/* ══ DIALOG: Histórico de Ordens por Receita ══ */}
            <Dialog
                header={
                    <div className="flex align-items-center gap-2">
                        <i className="pi pi-history" style={{ color: '#6366f1' }} />
                        <span>Histórico — {histReceita?.nome}</span>
                    </div>
                }
                visible={histDialog}
                style={{ width: '680px' }}
                modal
                onHide={() => setHistDialog(false)}
            >
                {loadingHist ? (
                    <div className="flex justify-content-center p-4">
                        <i className="pi pi-spin pi-spinner" style={{ fontSize: 24 }} />
                    </div>
                ) : histOrdens.length === 0 ? (
                    <div className="text-center text-color-secondary py-4">
                        <i className="pi pi-inbox text-3xl block mb-2" />
                        Nenhuma ordem de produção para esta receita
                    </div>
                ) : (
                    <>
                        {/* Totais resumidos */}
                        <div className="flex gap-4 mb-3 p-3 border-round" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                            {[
                                { label: 'Total produzido', valor: `${fmtQtd(histOrdens.filter(o => o.status === 'concluida').reduce((acc, o) => acc + Number(o.quantidade_produzida ?? o.quantidade_final ?? o.quantidade), 0), histReceita?.produto?.unidade_medida)} ${histReceita?.produto?.unidade_medida ?? 'UN'}`, cor: '#16a34a' },
                                { label: 'Ordens concluídas', valor: histOrdens.filter(o => o.status === 'concluida').length, cor: '#16a34a' },
                                { label: 'Pendentes', valor: histOrdens.filter(o => o.status === 'pendente').length, cor: '#f59e0b' },
                                { label: 'Canceladas', valor: histOrdens.filter(o => o.status === 'cancelada').length, cor: '#ef4444' },
                            ].map((m, i) => (
                                <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{ fontSize: 11, color: '#6b7280' }}>{m.label}</div>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: m.cor }}>{m.valor}</div>
                                </div>
                            ))}
                        </div>

                        <DataTable value={histOrdens} paginator rows={8}
                            emptyMessage="Nenhuma ordem" className="p-datatable-sm">
                            <Column header="Data" body={(o: OrdemProducao) => fmtData(o.created_at)} style={{ width: '8rem' }} />
                            <Column header="Receitas" body={(o: OrdemProducao) => fmtQtd(o.quantidade, null)} style={{ width: '6rem' }} />
                            <Column header="Produzido" body={(o: OrdemProducao) => o.status === 'concluida'
                                ? `${fmtQtd(Number(o.quantidade_produzida ?? o.quantidade_final ?? o.quantidade), histReceita?.produto?.unidade_medida)} ${histReceita?.produto?.unidade_medida ?? 'UN'}`
                                : '—'} style={{ width: '8rem' }} />
                            <Column header="Custo Est." body={(o: OrdemProducao) => {
                                const custo = calcularCusto(histReceita ?? undefined, Number(o.quantidade));
                                return custo > 0 ? <span style={{ fontWeight: 700 }}>{fmtCurrency(custo)}</span> : <span className="text-color-secondary">—</span>;
                            }} style={{ width: '110px' }} />
                            <Column header="Status" body={statusBody} style={{ width: '8rem' }} />
                            <Column field="observacao" header="Observação" body={(o: OrdemProducao) =>
                                o.observacao ? <span className="text-sm">{o.observacao}</span> : <span className="text-color-secondary">—</span>} />
                            <Column header="Ações" body={(o: OrdemProducao) => (
                                <div className="flex gap-2">
                                    {(o.status === 'concluida' || o.status === 'desfeita') && (
                                        <Button icon="pi pi-eye" size="small" text tooltip="Ver insumos utilizados"
                                            tooltipOptions={{ position: 'top' }} onClick={() => void abrirDetalhesConsumo(o)} />
                                    )}
                                    {o.status === 'concluida' && (
                                        <Button icon="pi pi-undo" size="small" severity="warning" text tooltip="Desfazer produção"
                                            tooltipOptions={{ position: 'top' }} onClick={() => desfazerOrdem(o)} />
                                    )}
                                </div>
                            )} style={{ width: '7rem' }} />
                        </DataTable>
                    </>
                )}
            </Dialog>
        </div>
    );
};

export default ProducaoPage;
