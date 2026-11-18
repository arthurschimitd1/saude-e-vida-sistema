'use client';
import React, { useState, useEffect } from 'react';
import api from '../../services/api/baseApi';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { InputNumber } from '@/app/(main)/components/MobileFriendlyInputNumber';
import { Dropdown } from 'primereact/dropdown';
import { Divider } from 'primereact/divider';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const vendaCancelada = (venda: any) =>
    ['cancelado', 'cancelada'].includes(String(venda?.status_loja ?? '').trim().toLowerCase());

const estimarPagamentosRecorrencia = (r: any): { qtd: number; total: number } => {
    const inicio = new Date(r.dataInicio ?? r.data_inicio).getTime();
    const fim = r.ultimoPagamento ?? r.ultimo_pagamento
        ? new Date(r.ultimoPagamento ?? r.ultimo_pagamento).getTime()
        : Date.now();
    if (isNaN(inicio)) return { qtd: 0, total: 0 };
    const diasDecorridos = Math.max(0, Math.floor((fim - inicio) / 86400000));
    const freq = r.tempoRecorrencia ?? r.tempo_recorrencia;
    const sub  = r.subtipoRecorrencia ?? r.subtipo_recorrencia;
    let diasPorCiclo = 30;
    if (freq === 'TRIMESTRAL')  diasPorCiclo = 90;
    else if (freq === 'SEMESTRAL') diasPorCiclo = 180;
    else if (freq === 'ANUAL')     diasPorCiclo = 365;
    else if (freq === 'PERSONALIZADO') {
        if (sub === 'SEMANAL')   diasPorCiclo = 7;
        else if (sub === 'QUINZENAL') diasPorCiclo = 15;
        else if (sub === 'DIARIO')    diasPorCiclo = 1;
    }
    const qtd = Math.max(1, Math.floor(diasDecorridos / diasPorCiclo) + 1);
    const total = qtd * Number(r.valorMes ?? r.valor_mes ?? 0);
    return { qtd, total };
};

const calcRFM = (clientes: any[], vendas: any[], recorrencias: any[], config: { ativo: number; risco: number; inativo: number; perdido: number }) => {
    const hoje = Date.now();
    return clientes.map(c => {
        const vendasCliente = vendas.filter(v => v.cliente_id === c.id);
        const recorrsCliente = recorrencias.filter(r => (r.cliente_id ?? r.clienteId) === c.id);
        const temRecorrAtiva = recorrsCliente.some(r => r.ativo === true);

        // Datas de referência: vendas + ultimoPagamento das recorrências
        const datasVendas = vendasCliente.map(v => new Date(v.data ?? v.createdAt).getTime());
        const datasRecorr = recorrsCliente
            .map(r => r.ultimoPagamento ?? r.ultimo_pagamento)
            .filter(Boolean)
            .map((d: string) => new Date(d).getTime());
        const todasDatas = [...datasVendas, ...datasRecorr].filter(d => !isNaN(d)).sort((a, b) => a - b);

        if (todasDatas.length === 0 && !temRecorrAtiva) {
            return { ...c, ultimaCompra: null, diasSemComprar: null, totalCompras: 0, totalGasto: 0, ticketMedio: 0, frequenciaMedia: null, produtoFavorito: '-', scoreR: 1, scoreF: 1, scoreM: 1, classificacao: 'Sem compras', status: 'Sem compras', temRecorrAtiva: false };
        }

        const ultimaCompra = todasDatas.length > 0 ? new Date(Math.max(...todasDatas)) : new Date();
        const diasSemComprar = Math.floor((hoje - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24));

        // Total compras e gasto: vendas + estimativa das recorrências
        const totalVendas = vendasCliente.length;
        const gastoVendas = vendasCliente.reduce((s, v) => s + Number(v.valor_total ?? 0), 0);
        const { qtd: qtdRecorr, total: gastoRecorr } = recorrsCliente.reduce(
            (acc, r) => { const p = estimarPagamentosRecorrencia(r); return { qtd: acc.qtd + p.qtd, total: acc.total + p.total }; },
            { qtd: 0, total: 0 }
        );
        const totalCompras = totalVendas + qtdRecorr;
        const totalGasto   = gastoVendas + gastoRecorr;
        const ticketMedio  = totalCompras > 0 ? totalGasto / totalCompras : 0;

        let frequenciaMedia: number | null = null;
        if (todasDatas.length > 1) {
            const intervalos = todasDatas.slice(1).map((d, i) => (d - todasDatas[i]) / 86400000);
            frequenciaMedia = intervalos.reduce((s, v) => s + v, 0) / intervalos.length;
        }

        const contProdutos: Record<string, number> = {};
        vendasCliente.forEach(v => {
            (v.itens ?? []).forEach((it: any) => {
                const nome = it.produto?.name ?? it.Product?.name ?? `#${it.produto_id}`;
                contProdutos[nome] = (contProdutos[nome] ?? 0) + Number(it.quantidade ?? 1);
            });
        });
        recorrsCliente.forEach(r => {
            const nome = r.produto ?? 'Recorrência';
            contProdutos[nome] = (contProdutos[nome] ?? 0) + 1;
        });
        const produtoFavorito = Object.entries(contProdutos).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

        const scoreR = diasSemComprar <= 7 ? 5 : diasSemComprar <= 15 ? 4 : diasSemComprar <= 30 ? 3 : diasSemComprar <= 60 ? 2 : 1;
        const scoreF = totalCompras >= 20 ? 5 : totalCompras >= 10 ? 4 : totalCompras >= 5 ? 3 : totalCompras >= 2 ? 2 : 1;
        const scoreM = ticketMedio >= 500 ? 5 : ticketMedio >= 200 ? 4 : ticketMedio >= 100 ? 3 : ticketMedio >= 50 ? 2 : 1;

        let classificacao = '';
        if (scoreR >= 4 && scoreF >= 4 && scoreM >= 4) classificacao = 'VIP';
        else if (scoreF >= 3 && scoreR >= 3) classificacao = 'Frequente';
        else if (totalCompras === 1 && diasSemComprar <= 30) classificacao = 'Novo';
        else if (temRecorrAtiva) classificacao = 'Ativo'; // recorrência ativa protege de Perdido/Inativo
        else if (diasSemComprar > config.perdido) classificacao = 'Perdido';
        else if (diasSemComprar > config.inativo) classificacao = 'Inativo';
        else if (diasSemComprar > config.risco) classificacao = 'Em Risco';
        else classificacao = 'Ativo';

        let status = '';
        if (temRecorrAtiva && diasSemComprar <= config.perdido) status = 'Ativo'; // recorrência ativa = ativo
        else if (diasSemComprar <= config.ativo) status = 'Ativo';
        else if (diasSemComprar <= config.risco) status = 'Em Risco';
        else if (diasSemComprar <= config.inativo) status = 'Inativo';
        else if (diasSemComprar <= config.perdido) status = 'Perdido';
        else status = 'Perdido';

        return { ...c, ultimaCompra, diasSemComprar, totalCompras, totalGasto, ticketMedio, frequenciaMedia, produtoFavorito, scoreR, scoreF, scoreM, classificacao, status, temRecorrAtiva };
    });
};

const CRMPage = () => {
    const [clientes, setClientes] = useState<any[]>([]);
    const [vendas, setVendas] = useState<any[]>([]);
    const [recorrencias, setRecorrencias] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({ ativo: 15, risco: 20, inativo: 30, perdido: 60 });
    const [filtrosVisiveis, setFiltrosVisiveis] = useState(false);
    const [fRecencia, setFRecencia] = useState<string | null>(null);
    const [fDiasMin, setFDiasMin] = useState<number | null>(null);
    const [fDiasMax, setFDiasMax] = useState<number | null>(null);
    const [fFreqMin, setFFreqMin] = useState<number | null>(null);
    const [fFreqMax, setFFreqMax] = useState<number | null>(null);
    const [fFreqFaixa, setFFreqFaixa] = useState<string | null>(null);
    const [fTicketMin, setFTicketMin] = useState<number | null>(null);
    const [fTicketMax, setFTicketMax] = useState<number | null>(null);
    const [fTotalMin, setFTotalMin] = useState<number | null>(null);
    const [fTotalMax, setFTotalMax] = useState<number | null>(null);
    const [fProduto, setFProduto] = useState<string | null>(null);
    const [fProdutoTipo, setFProdutoTipo] = useState<'comprou' | 'nunca' | 'recente'>('comprou');
    const [cruzamento, setCruzamento] = useState<string | null>(null);
    const [fRecorrStatus, setFRecorrStatus] = useState<string | null>(null);
    const [fRecorrTipo, setFRecorrTipo] = useState<string | null>(null);
    const [fRecorrValorMin, setFRecorrValorMin] = useState<number | null>(null);
    const [fRecorrValorMax, setFRecorrValorMax] = useState<number | null>(null);
    const [fRecorrVencimento, setFRecorrVencimento] = useState<string | null>(null);
    const [clienteDetalhe, setClienteDetalhe] = useState<any | null>(null);

    useEffect(() => {
        const carregar = async () => {
            setLoading(true);
            try {
                const [resC, resV, resR] = await Promise.all([api.get('/clientes'), api.get('/vendas'), api.get('/recorrencias').catch(() => ({ data: [] }))]);
                const listaClientes = Array.isArray(resC.data) ? resC.data : (resC.data?.clientes ?? resC.data?.data ?? []);
                setClientes(listaClientes);
                const vendasCarregadas = Array.isArray(resV.data) ? resV.data : [];
                // Mantém uma proteção no cliente caso a API antiga/cache ainda
                // devolva pedidos online cancelados.
                setVendas(vendasCarregadas.filter(venda => !vendaCancelada(venda)));
                setRecorrencias(Array.isArray(resR.data) ? resR.data : (resR.data?.recorrencias ?? resR.data?.data ?? []));
            } finally {
                setLoading(false);
            }
        };
        carregar();
    }, []);

    const dadosRFM = calcRFM(clientes, vendas, recorrencias, config);

    const cruzamentos = [
        { label: 'Inativos +20d com ticket > R$100', value: 'inativo_ticket' },
        { label: 'VIP sem compra há +10 dias',        value: 'vip_semcompra'  },
        { label: 'Compraram só 1 vez',                value: 'apenas_uma'     },
        { label: 'Ticket acima de R$200',             value: 'ticket_200'     },
        { label: 'Mais de 10 compras',                value: 'freq_10'        },
        { label: 'Gastaram mais de R$1.000',          value: 'total_1000'     },
        { label: 'Novos sem segunda compra',          value: 'novos_sem2'     },
        { label: 'Em risco com ticket > R$50',        value: 'risco_ticket'   },
    ];

    const produtosUnicos = Array.from(
        new Set(vendas.flatMap(v => (v.itens ?? []).map((it: any) => it.produto?.name ?? it.Product?.name ?? '').filter(Boolean)))
    ).sort().map(p => ({ label: p, value: p }));

    const recenciaOpcoes = [
        { label: 'Hoje', value: 'hoje' },
        { label: 'Últimos 7 dias', value: '7' },
        { label: 'Últimos 15 dias', value: '15' },
        { label: 'Últimos 30 dias', value: '30' },
        { label: 'Últimos 60 dias', value: '60' },
        { label: 'Últimos 90 dias', value: '90' },
        { label: 'Mais de 90 dias', value: '+90' },
    ];

    const freqFaixaOpcoes = [
        { label: 'Apenas 1 vez', value: '1' },
        { label: 'Entre 2 e 5 vezes', value: '2-5' },
        { label: 'Entre 6 e 10 vezes', value: '6-10' },
        { label: 'Mais de 10 vezes', value: '+10' },
        { label: 'Mais de 20 vezes', value: '+20' },
    ];

    const recorrStatusOpcoes = [
        { label: 'Com recorrência ativa', value: 'ativa' },
        { label: 'Com recorrência inativa', value: 'inativa' },
        { label: 'Sem nenhuma recorrência', value: 'sem' },
        { label: 'Qualquer recorrência', value: 'qualquer' },
    ];

    const recorrTipoOpcoes = [
        { label: 'Mensal', value: 'MENSAL' },
        { label: 'Trimestral', value: 'TRIMESTRAL' },
        { label: 'Semestral', value: 'SEMESTRAL' },
        { label: 'Anual', value: 'ANUAL' },
        { label: 'Personalizado', value: 'PERSONALIZADO' },
    ];

    const recorrVencimentoOpcoes = [
        { label: 'Vence em 7 dias', value: '7' },
        { label: 'Vence em 15 dias', value: '15' },
        { label: 'Vence em 30 dias', value: '30' },
        { label: 'Vencido (atrasado)', value: 'vencido' },
    ];

    const dadosFiltrados = dadosRFM.filter(c => {
        if (fRecencia) {
            const dias = c.diasSemComprar ?? 9999;
            if (fRecencia === 'hoje' && dias > 0) return false;
            else if (fRecencia === '+90' && dias <= 90) return false;
            else if (fRecencia !== 'hoje' && fRecencia !== '+90' && dias > Number(fRecencia)) return false;
        }
        if (fDiasMin !== null && (c.diasSemComprar ?? 9999) < fDiasMin) return false;
        if (fDiasMax !== null && (c.diasSemComprar ?? 0) > fDiasMax) return false;
        if (fFreqFaixa) {
            const t = c.totalCompras;
            if (fFreqFaixa === '1' && t !== 1) return false;
            else if (fFreqFaixa === '2-5' && (t < 2 || t > 5)) return false;
            else if (fFreqFaixa === '6-10' && (t < 6 || t > 10)) return false;
            else if (fFreqFaixa === '+10' && t <= 10) return false;
            else if (fFreqFaixa === '+20' && t <= 20) return false;
        }
        if (fFreqMin !== null && c.totalCompras < fFreqMin) return false;
        if (fFreqMax !== null && c.totalCompras > fFreqMax) return false;
        if (fTicketMin !== null && c.ticketMedio < fTicketMin) return false;
        if (fTicketMax !== null && c.ticketMedio > fTicketMax) return false;
        if (fTotalMin !== null && c.totalGasto < fTotalMin) return false;
        if (fTotalMax !== null && c.totalGasto > fTotalMax) return false;
        if (fProduto) {
            const vendasCliente = vendas.filter(v => v.cliente_id === c.id);
            const produtosComprados = vendasCliente.flatMap(v => (v.itens ?? []).map((it: any) => it.produto?.name ?? it.Product?.name ?? ''));
            if (fProdutoTipo === 'comprou' && !produtosComprados.includes(fProduto)) return false;
            if (fProdutoTipo === 'nunca'   &&  produtosComprados.includes(fProduto)) return false;
            if (fProdutoTipo === 'recente') {
                const compraRecente = vendasCliente
                    .filter(v => (v.itens ?? []).some((it: any) => (it.produto?.name ?? it.Product?.name) === fProduto))
                    .map(v => new Date(v.data ?? v.createdAt).getTime());
                const diasUltima = compraRecente.length > 0
                    ? Math.floor((Date.now() - Math.max(...compraRecente)) / 86400000)
                    : 9999;
                if (diasUltima > 30) return false;
            }
        }
        if (cruzamento) {
            if (cruzamento === 'inativo_ticket' && !((c.diasSemComprar ?? 0) > 20 && c.ticketMedio > 100)) return false;
            if (cruzamento === 'vip_semcompra'  && !(c.classificacao === 'VIP' && (c.diasSemComprar ?? 0) > 10)) return false;
            if (cruzamento === 'apenas_uma'     && c.totalCompras !== 1) return false;
            if (cruzamento === 'ticket_200'     && c.ticketMedio <= 200) return false;
            if (cruzamento === 'freq_10'        && c.totalCompras <= 10) return false;
            if (cruzamento === 'total_1000'     && c.totalGasto <= 1000) return false;
            if (cruzamento === 'novos_sem2'     && !(c.classificacao === 'Novo' && c.totalCompras === 1)) return false;
            if (cruzamento === 'risco_ticket'   && !(c.status === 'Em Risco' && c.ticketMedio > 50)) return false;
        }
        if (fRecorrStatus || fRecorrTipo || fRecorrValorMin !== null || fRecorrValorMax !== null || fRecorrVencimento) {
            const cRecorrs = recorrencias.filter(r => (r.cliente_id ?? r.clienteId) === c.id);
            if (fRecorrStatus === 'ativa'    && !cRecorrs.some(r => r.ativo === true)) return false;
            if (fRecorrStatus === 'inativa'  && !cRecorrs.some(r => r.ativo === false)) return false;
            if (fRecorrStatus === 'sem'      && cRecorrs.length > 0) return false;
            if (fRecorrStatus === 'qualquer' && cRecorrs.length === 0) return false;
            if (fRecorrTipo) {
                const campo = (r: any) => r.tempoRecorrencia ?? r.tempo_recorrencia;
                if (!cRecorrs.some(r => campo(r) === fRecorrTipo)) return false;
            }
            if (fRecorrValorMin !== null) {
                const totalMes = cRecorrs.reduce((s, r) => s + Number(r.valorMes ?? r.valor_mes ?? 0), 0);
                if (totalMes < fRecorrValorMin) return false;
            }
            if (fRecorrValorMax !== null) {
                const totalMes = cRecorrs.reduce((s, r) => s + Number(r.valorMes ?? r.valor_mes ?? 0), 0);
                if (totalMes > fRecorrValorMax) return false;
            }
            if (fRecorrVencimento) {
                const hoje2 = Date.now();
                const temVencimento = cRecorrs.some(r => {
                    const venc = r.proximoVencimento ?? r.proximo_vencimento;
                    if (!venc) return false;
                    const diff = Math.floor((new Date(venc).getTime() - hoje2) / 86400000);
                    if (fRecorrVencimento === 'vencido') return diff < 0;
                    return diff >= 0 && diff <= Number(fRecorrVencimento);
                });
                if (!temVencimento) return false;
            }
        }
        return true;
    });

    const exportarPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const hoje = new Date().toLocaleDateString('pt-BR');

        doc.setFontSize(14);
        doc.setTextColor(30, 58, 95);
        doc.text('CRM / RFM — Análise de Clientes', 14, 15);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Gerado em ${hoje}  ·  ${dadosFiltrados.length} clientes`, 14, 22);

        autoTable(doc, {
            startY: 27,
            head: [['Nome', 'Telefone', 'Última Compra', 'Dias s/ comprar', 'Compras', 'Ticket Médio', 'Total Gasto', 'Prod. Favorito', 'RFM', 'Classificação', 'Status']],
            body: dadosFiltrados.map(c => [
                c.nomeCompleto,
                c.telefone ?? '-',
                c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR') : '-',
                c.diasSemComprar ?? '-',
                c.totalCompras,
                c.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                c.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                c.produtoFavorito,
                `R${c.scoreR} F${c.scoreF} M${c.scoreM}`,
                c.classificacao,
                c.status,
            ]),
            headStyles: { fillColor: [30, 58, 95], fontSize: 7, halign: 'center' },
            bodyStyles: { fontSize: 7 },
            alternateRowStyles: { fillColor: [241, 245, 249] },
            styles: { overflow: 'linebreak', cellPadding: 2 },
        });

        doc.save(`clientes_crm_${hoje.replace(/\//g, '-')}.pdf`);
    };

    const exportarExcel = () => {
        const dados = dadosFiltrados.map(c => ({
            'Nome':             c.nomeCompleto,
            'Telefone':         c.telefone ?? '-',
            'Última Compra':    c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR') : '-',
            'Dias sem comprar': c.diasSemComprar ?? '-',
            'Compras':          c.totalCompras,
            'Ticket Médio':     c.ticketMedio,
            'Total Gasto':      c.totalGasto,
            'Produto Favorito': c.produtoFavorito,
            'Score R':          c.scoreR,
            'Score F':          c.scoreF,
            'Score M':          c.scoreM,
            'Classificação':    c.classificacao,
            'Status':           c.status,
        }));
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
        XLSX.writeFile(wb, `clientes_crm_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
    };

    const limparFiltros = () => {
        setFRecencia(null);
        setFDiasMin(null); setFDiasMax(null);
        setFFreqMin(null); setFFreqMax(null); setFFreqFaixa(null);
        setFTicketMin(null); setFTicketMax(null);
        setFTotalMin(null); setFTotalMax(null);
        setFProduto(null); setFProdutoTipo('comprou');
        setCruzamento(null);
        setFRecorrStatus(null); setFRecorrTipo(null);
        setFRecorrValorMin(null); setFRecorrValorMax(null); setFRecorrVencimento(null);
    };

    const fmtM = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const totalGasto = dadosRFM.reduce((s, c) => s + (c.totalGasto ?? 0), 0);
    const totalComprasGeral = dadosRFM.reduce((s, c) => s + c.totalCompras, 0);
    const ticketGeral = totalComprasGeral > 0 ? totalGasto / totalComprasGeral : 0;
    const valorEmRisco = dadosRFM.filter(c => c.status === 'Em Risco').reduce((s, c) => s + (c.ticketMedio ?? 0), 0);

    const mediasDias = dadosRFM.filter(c => c.frequenciaMedia !== null);
    const mediaDiasEntreCompras = mediasDias.length > 0
        ? mediasDias.reduce((s, c) => s + c.frequenciaMedia!, 0) / mediasDias.length
        : 0;
    const semCompra7  = dadosRFM.filter(c => c.diasSemComprar !== null && c.diasSemComprar > 7).length;
    const semCompra15 = dadosRFM.filter(c => c.diasSemComprar !== null && c.diasSemComprar > 15).length;
    const semCompra30 = dadosRFM.filter(c => c.diasSemComprar !== null && c.diasSemComprar > 30).length;
    const ticketAtivos = dadosRFM.filter(c => c.status === 'Ativo');
    const ticketMedioAtivos = ticketAtivos.length > 0
        ? ticketAtivos.reduce((s, c) => s + c.ticketMedio, 0) / ticketAtivos.length
        : 0;

    // Seção 15 — Oportunidades
    const umaCompra30d = dadosRFM.filter(c => c.totalCompras === 1 && c.diasSemComprar !== null && c.diasSemComprar <= 30);
    const frequentesSumidos = dadosRFM.filter(c => c.scoreF >= 3 && (c.diasSemComprar ?? 0) > 20);
    const ativosTicketBaixo = dadosRFM.filter(c => c.status === 'Ativo' && c.ticketMedio > 0 && c.ticketMedio < 50);
    const melhorDia = (() => {
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const contagem: Record<string, number> = {};
        vendas.forEach(v => {
            const dia = diasSemana[new Date(v.data ?? v.createdAt).getDay()];
            contagem[dia] = (contagem[dia] ?? 0) + 1;
        });
        return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';
    })();

    const cards = [
        { label: 'VIP',                    value: dadosRFM.filter(c => c.classificacao === 'VIP').length,       icon: 'pi-star',                 color: '#f59e0b' },
        { label: 'Frequentes',             value: dadosRFM.filter(c => c.classificacao === 'Frequente').length, icon: 'pi-replay',               color: '#3b82f6' },
        { label: 'Novos',                  value: dadosRFM.filter(c => c.classificacao === 'Novo').length,      icon: 'pi-user-plus',            color: '#10b981' },
        { label: 'Em Risco',               value: dadosRFM.filter(c => c.status === 'Em Risco').length,         icon: 'pi-exclamation-triangle', color: '#f97316' },
        { label: 'Inativos',               value: dadosRFM.filter(c => c.status === 'Inativo').length,          icon: 'pi-clock',                color: '#ef4444' },
        { label: 'Perdidos',               value: dadosRFM.filter(c => c.status === 'Perdido').length,          icon: 'pi-times-circle',         color: '#7c3aed' },
        { label: 'Sem Compras',            value: dadosRFM.filter(c => c.totalCompras === 0).length,            icon: 'pi-ban',                  color: '#6b7280' },
        { label: 'Faturamento',            value: fmtM(totalGasto),                                             icon: 'pi-dollar',               color: '#1e3a5f' },
        { label: 'Ticket Médio',           value: fmtM(ticketGeral),                                            icon: 'pi-chart-line',           color: '#1e7d34' },
        { label: 'Valor em Risco',         value: fmtM(valorEmRisco),                                           icon: 'pi-shield',               color: '#dc2626' },
        { label: 'Ticket Médio Ativos',    value: fmtM(ticketMedioAtivos),                                      icon: 'pi-arrow-up',             color: '#059669' },
        { label: 'Média dias p/ comprar',  value: `${mediaDiasEntreCompras.toFixed(0)} dias`,                   icon: 'pi-calendar',             color: '#0284c7' },
        { label: 'Sem compra +7d',         value: semCompra7,                                                   icon: 'pi-clock',                color: '#d97706' },
        { label: 'Sem compra +15d',        value: semCompra15,                                                  icon: 'pi-clock',                color: '#ea580c' },
        { label: 'Sem compra +30d',        value: semCompra30,                                                  icon: 'pi-clock',                color: '#dc2626' },
    ];
        
    return (
        <div className="grid">

            {/* Título */}
            <div className="col-12">
                <div className="flex align-items-center justify-content-between mb-3">
                    <h4 className="m-0 font-bold" style={{ color: '#1e3a5f' }}>CRM / RFM — Análise de Clientes</h4>
                    {loading && <i className="pi pi-spin pi-spinner text-primary" />}
                </div>
            </div>

            {/* Cards */}
            {cards.map(card => (
                <div key={card.label} className="col-12 md:col-6 lg:col-3 xl:col-2">
                    <div className="surface-card border-round border-1 surface-border p-3">
                        <div className="flex align-items-center gap-2 mb-2">
                            <i className={`pi ${card.icon}`} style={{ color: card.color, fontSize: '1.1rem' }} />
                            <span className="text-sm text-color-secondary">{card.label}</span>
                        </div>
                        <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                    </div>
                </div>
            ))}

            {/* Seção 14 — Indicadores de Recuperação */}
            {(() => {
                const emRisco   = dadosRFM.filter(c => c.status === 'Em Risco');
                const inativos  = dadosRFM.filter(c => c.status === 'Inativo');
                const perdidos  = dadosRFM.filter(c => c.status === 'Perdido');

                const valorEmRiscoTotal   = emRisco.reduce((s, c) => s + c.ticketMedio, 0);
                const valorInativoTotal   = inativos.reduce((s, c) => s + c.totalGasto, 0);
                const potencial30pct      = valorEmRiscoTotal * 0.3;

                const topRecuperacao = [...emRisco, ...inativos]
                    .sort((a, b) => b.ticketMedio - a.ticketMedio)
                    .slice(0, 5);

                return (
                    <div className="col-12">
                        <div className="surface-card border-round border-1 surface-border p-3">
                            <div className="flex align-items-center gap-2 mb-3">
                                <i className="pi pi-heart" style={{ color: '#dc2626' }} />
                                <span className="font-bold" style={{ color: '#1e3a5f' }}>Indicadores de Recuperação</span>
                            </div>

                            {/* Métricas */}
                            <div className="grid mb-3">
                                {[
                                    { label: 'Clientes em risco',       value: emRisco.length,        sub: fmtM(valorEmRiscoTotal) + ' em ticket acumulado', color: '#f97316' },
                                    { label: 'Clientes inativos',        value: inativos.length,       sub: fmtM(valorInativoTotal) + ' já gastaram',          color: '#ef4444' },
                                    { label: 'Clientes perdidos',        value: perdidos.length,       sub: 'sem compra há muito tempo',                        color: '#7c3aed' },
                                    { label: 'Potencial se recuperar 30%', value: fmtM(potencial30pct), sub: 'dos clientes em risco',                           color: '#16a34a' },
                                ].map(item => (
                                    <div key={item.label} className="col-12 md:col-6 lg:col-3">
                                        <div className="border-round p-3 text-center" style={{ background: '#f8fafc', border: `1px solid #e2e8f0` }}>
                                            <div className="text-xs text-color-secondary mb-1">{item.label}</div>
                                            <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
                                            <div className="text-xs text-color-secondary mt-1">{item.sub}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Top 5 para acionar */}
                            {topRecuperacao.length > 0 && (
                                <>
                                    <div className="text-sm font-semibold mb-2" style={{ color: '#1e3a5f' }}>
                                        Top clientes para acionar (Em Risco + Inativos por ticket)
                                    </div>
                                    <div className="flex flex-column gap-1">
                                        {topRecuperacao.map((c, i) => (
                                            <div key={c.id} className="flex align-items-center justify-content-between border-round px-3 py-2"
                                                style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                <div className="flex align-items-center gap-2">
                                                    <span className="text-xs font-bold text-color-secondary" style={{ width: '1.2rem' }}>#{i + 1}</span>
                                                    <span className="text-sm font-semibold">{c.nomeCompleto}</span>
                                                    <Tag value={c.status} severity={c.status === 'Em Risco' ? 'warning' : 'danger'} style={{ fontSize: '0.7rem' }} />
                                                </div>
                                                <div className="flex gap-4 text-sm">
                                                    <span className="text-color-secondary">{c.diasSemComprar}d sem comprar</span>
                                                    <span className="font-bold" style={{ color: '#1e3a5f' }}>{fmtM(c.ticketMedio)} ticket</span>
                                                    {c.telefone && (
                                                        <Button icon="pi pi-whatsapp" size="small" text rounded
                                                            style={{ color: '#25d366', padding: '2px 6px' }}
                                                            onClick={() => window.open(`https://wa.me/55${c.telefone.replace(/\D/g, '')}`, '_blank')}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Seção 15 — Oportunidades */}
            <div className="col-12">
                <div className="surface-card border-round border-1 surface-border p-3">
                    <div className="flex align-items-center gap-2 mb-3">
                        <i className="pi pi-star" style={{ color: '#f59e0b' }} />
                        <span className="font-bold" style={{ color: '#1e3a5f' }}>Oportunidades</span>
                    </div>

                    <div className="grid">
                        {/* Card 1 — Uma compra nos últimos 30d */}
                        <div className="col-12 md:col-6 lg:col-3">
                            <div className="border-round p-3 h-full" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                <div className="flex align-items-center gap-2 mb-2">
                                    <i className="pi pi-user-plus" style={{ color: '#16a34a' }} />
                                    <span className="text-sm font-bold" style={{ color: '#16a34a' }}>Converter para frequente</span>
                                </div>
                                <div className="text-3xl font-bold" style={{ color: '#16a34a' }}>{umaCompra30d.length}</div>
                                <div className="text-xs text-color-secondary mt-1">compraram 1x nos últimos 30 dias</div>
                                {umaCompra30d.slice(0, 3).map(c => (
                                    <div key={c.id} className="flex justify-content-between align-items-center mt-2 text-xs">
                                        <span className="font-semibold">{c.nomeCompleto}</span>
                                        <span className="text-color-secondary">{c.diasSemComprar}d atrás</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Card 2 — Frequentes sumidos */}
                        <div className="col-12 md:col-6 lg:col-3">
                            <div className="border-round p-3 h-full" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                <div className="flex align-items-center gap-2 mb-2">
                                    <i className="pi pi-replay" style={{ color: '#3b82f6' }} />
                                    <span className="text-sm font-bold" style={{ color: '#3b82f6' }}>Frequentes sumidos</span>
                                </div>
                                <div className="text-3xl font-bold" style={{ color: '#3b82f6' }}>{frequentesSumidos.length}</div>
                                <div className="text-xs text-color-secondary mt-1">costumam comprar mas sumiram +20d</div>
                                {frequentesSumidos.slice(0, 3).map(c => (
                                    <div key={c.id} className="flex justify-content-between align-items-center mt-2 text-xs">
                                        <span className="font-semibold">{c.nomeCompleto}</span>
                                        <span className="text-color-secondary">{c.totalCompras} compras</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Card 3 — Upsell */}
                        <div className="col-12 md:col-6 lg:col-3">
                            <div className="border-round p-3 h-full" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                                <div className="flex align-items-center gap-2 mb-2">
                                    <i className="pi pi-arrow-up" style={{ color: '#f97316' }} />
                                    <span className="text-sm font-bold" style={{ color: '#f97316' }}>Potencial de upsell</span>
                                </div>
                                <div className="text-3xl font-bold" style={{ color: '#f97316' }}>{ativosTicketBaixo.length}</div>
                                <div className="text-xs text-color-secondary mt-1">ativos com ticket abaixo de R$ 50</div>
                                {ativosTicketBaixo.slice(0, 3).map(c => (
                                    <div key={c.id} className="flex justify-content-between align-items-center mt-2 text-xs">
                                        <span className="font-semibold">{c.nomeCompleto}</span>
                                        <span className="text-color-secondary">{fmtM(c.ticketMedio)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Card 4 — Melhor dia */}
                        <div className="col-12 md:col-6 lg:col-3">
                            <div className="border-round p-3 h-full" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                                <div className="flex align-items-center gap-2 mb-2">
                                    <i className="pi pi-calendar" style={{ color: '#7c3aed' }} />
                                    <span className="text-sm font-bold" style={{ color: '#7c3aed' }}>Melhor dia para acionar</span>
                                </div>
                                <div className="text-3xl font-bold" style={{ color: '#7c3aed' }}>{melhorDia}</div>
                                <div className="text-xs text-color-secondary mt-1">dia com mais vendas na base histórica</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cruzamentos Inteligentes */}
            <div className="col-12">
                <div className="surface-card border-round border-1 surface-border p-3">
                    <div className="flex align-items-center gap-2 mb-3">
                        <i className="pi pi-bolt" style={{ color: '#1e3a5f' }} />
                        <span className="font-bold" style={{ color: '#1e3a5f' }}>Cruzamentos Inteligentes</span>
                        <span className="text-sm text-color-secondary ml-2">atalhos rápidos</span>
                        {cruzamento && <Button label="Limpar" icon="pi pi-times" size="small" text onClick={() => setCruzamento(null)} />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {cruzamentos.map(c => (
                            <button key={c.value} type="button"
                                onClick={() => setCruzamento(cruzamento === c.value ? null : c.value)}
                                style={{
                                    padding: '6px 14px', fontSize: '0.8rem', borderRadius: 20,
                                    border: `1px solid ${cruzamento === c.value ? '#1e3a5f' : '#dee2e6'}`,
                                    cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
                                    background: cruzamento === c.value ? '#1e3a5f' : '#fff',
                                    color: cruzamento === c.value ? '#fff' : '#555',
                                }}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Configurações de Classificação */}
            <div className="col-12">
                <div className="surface-card border-round border-1 surface-border p-3">
                    <div className="flex align-items-center gap-2 mb-3">
                        <i className="pi pi-sliders-h" style={{ color: '#1e3a5f' }} />
                        <span className="font-bold" style={{ color: '#1e3a5f' }}>Configurações de Classificação</span>
                        <span className="text-sm text-color-secondary ml-2">(dias sem comprar)</span>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {[
                            { label: 'Ativo até',     field: 'ativo',   color: '#10b981' },
                            { label: 'Em Risco após', field: 'risco',   color: '#f97316' },
                            { label: 'Inativo após',  field: 'inativo', color: '#ef4444' },
                            { label: 'Perdido após',  field: 'perdido', color: '#7c3aed' },
                        ].map(item => (
                            <div key={item.field} className="flex flex-column gap-1" style={{ minWidth: '140px' }}>
                                <label className="text-sm font-semibold" style={{ color: item.color }}>{item.label}</label>
                                <InputNumber
                                    value={config[item.field as keyof typeof config]}
                                    onValueChange={e => setConfig(prev => ({ ...prev, [item.field]: e.value ?? prev[item.field as keyof typeof config] }))}
                                    suffix=" dias"
                                    min={1}
                                    showButtons
                                    style={{ width: '270px' }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Painel de filtros */}
            <div className="col-12">
                <div className="surface-card border-round border-1 surface-border p-3">
                    <div className="flex align-items-center justify-content-between">
                        <span className="font-bold" style={{ color: '#1e3a5f' }}>
                            <i className="pi pi-filter mr-2" />Filtros RFM
                        </span>
                        <div className="flex gap-2">
                            <Button label="Limpar" icon="pi pi-times" size="small" text onClick={limparFiltros} />
                            <Button
                                label={filtrosVisiveis ? 'Ocultar' : 'Expandir'}
                                icon={filtrosVisiveis ? 'pi pi-chevron-up' : 'pi pi-chevron-down'}
                                size="small" outlined
                                style={{ borderColor: '#1e3a5f', color: '#1e3a5f' }}
                                onClick={() => setFiltrosVisiveis(!filtrosVisiveis)}
                            />
                        </div>
                    </div>
                    {filtrosVisiveis && (
                        <>
                        <div className="grid mt-3">
                            <div className="col-12 md:col-4">
                                <div className="font-semibold mb-2 text-sm" style={{ color: '#1e3a5f' }}>R — Recência</div>
                                <Dropdown value={fRecencia} options={recenciaOpcoes} onChange={e => setFRecencia(e.value)} placeholder="Última compra" className="w-full mb-2" showClear />
                                <div className="flex gap-2">
                                    <InputNumber value={fDiasMin} onValueChange={e => setFDiasMin(e.value ?? null)} placeholder="Dias mín" className="w-full" />
                                    <InputNumber value={fDiasMax} onValueChange={e => setFDiasMax(e.value ?? null)} placeholder="Dias máx" className="w-full" />
                                </div>
                            </div>
                            <Divider layout="vertical" className="hidden md:flex" />
                            <div className="col-12 md:col-4">
                                <div className="font-semibold mb-2 text-sm" style={{ color: '#1e3a5f' }}>F — Frequência</div>
                                <Dropdown value={fFreqFaixa} options={freqFaixaOpcoes} onChange={e => setFFreqFaixa(e.value)} placeholder="Faixa de compras" className="w-full mb-2" showClear />
                                <div className="flex gap-2">
                                    <InputNumber value={fFreqMin} onValueChange={e => setFFreqMin(e.value ?? null)} placeholder="Mín compras" className="w-full" />
                                    <InputNumber value={fFreqMax} onValueChange={e => setFFreqMax(e.value ?? null)} placeholder="Máx compras" className="w-full" />
                                </div>
                            </div>
                            <Divider layout="vertical" className="hidden md:flex" />
                            <div className="col-12 md:col-3">
                                <div className="font-semibold mb-2 text-sm" style={{ color: '#1e3a5f' }}>M — Monetário</div>

                                <div className="flex gap-2 mb-2">
                                    <InputNumber value={fTicketMin} onValueChange={e => setFTicketMin(e.value ?? null)} placeholder="Ticket mín" mode="currency" currency="BRL" locale="pt-BR" className="w-full" />
                                    <InputNumber value={fTicketMax} onValueChange={e => setFTicketMax(e.value ?? null)} placeholder="Ticket máx" mode="currency" currency="BRL" locale="pt-BR" className="w-full" />
                                </div>
                                <div className="flex gap-2">
                                    <InputNumber value={fTotalMin} onValueChange={e => setFTotalMin(e.value ?? null)} placeholder="Total mín" mode="currency" currency="BRL" locale="pt-BR" className="w-full" />
                                    <InputNumber value={fTotalMax} onValueChange={e => setFTotalMax(e.value ?? null)} placeholder="Total máx" mode="currency" currency="BRL" locale="pt-BR" className="w-full" />
                                </div>
                            </div>
                            <Divider layout="vertical" className="hidden md:flex" />
                            <div className="col-12 md:col-3">
                                <div className="font-semibold mb-2 text-sm" style={{ color: '#1e3a5f' }}>Produto</div>
                                <Dropdown
                                    value={fProduto}
                                    options={produtosUnicos}
                                    onChange={e => setFProduto(e.value)}
                                    placeholder="Selecionar produto"
                                    className="w-full mb-2"
                                    showClear filter
                                />
                                {fProduto && (
                                    <div className="flex gap-1 flex-wrap">
                                        {(['comprou', 'nunca', 'recente'] as const).map(t => (
                                            <button key={t} type="button"
                                                onClick={() => setFProdutoTipo(t)}
                                                style={{
                                                    padding: '4px 8px', fontSize: '0.75rem', borderRadius: 4,
                                                    border: '1px solid #dee2e6', cursor: 'pointer', fontWeight: 600,
                                                    background: fProdutoTipo === t ? '#1e3a5f' : '#fff',
                                                    color: fProdutoTipo === t ? '#fff' : '#555',
                                                }}>
                                                {t === 'comprou' ? 'Comprou' : t === 'nunca' ? 'Nunca comprou' : 'Últimos 30d'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Filtros de recorrência — linha separada */}
                        <div className="grid mt-2" style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 12 }}>
                            <div className="col-12 mb-1">
                                <span className="font-semibold text-sm" style={{ color: '#16a34a' }}>
                                    <i className="pi pi-sync mr-1" />Recorrências
                                </span>
                            </div>
                            <div className="col-12 md:col-3">
                                <Dropdown
                                    value={fRecorrStatus}
                                    options={recorrStatusOpcoes}
                                    onChange={e => setFRecorrStatus(e.value)}
                                    placeholder="Status da recorrência"
                                    className="w-full"
                                    showClear
                                />
                            </div>
                            <div className="col-12 md:col-3">
                                <Dropdown
                                    value={fRecorrTipo}
                                    options={recorrTipoOpcoes}
                                    onChange={e => setFRecorrTipo(e.value)}
                                    placeholder="Tipo / frequência"
                                    className="w-full"
                                    showClear
                                />
                            </div>
                            <div className="col-12 md:col-3">
                                <div className="flex gap-2">
                                    <InputNumber
                                        value={fRecorrValorMin}
                                        onValueChange={e => setFRecorrValorMin(e.value ?? null)}
                                        placeholder="Valor mín/mês"
                                        mode="currency" currency="BRL" locale="pt-BR"
                                        className="w-full"
                                    />
                                    <InputNumber
                                        value={fRecorrValorMax}
                                        onValueChange={e => setFRecorrValorMax(e.value ?? null)}
                                        placeholder="Valor máx/mês"
                                        mode="currency" currency="BRL" locale="pt-BR"
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <div className="col-12 md:col-3">
                                <Dropdown
                                    value={fRecorrVencimento}
                                    options={recorrVencimentoOpcoes}
                                    onChange={e => setFRecorrVencimento(e.value)}
                                    placeholder="Próximo vencimento"
                                    className="w-full"
                                    showClear
                                />
                            </div>
                        </div>
                        </>
                    )}
                </div>
            </div>

            {/* Tabela */}
            <div className="col-12 mt-3">
                <div className="surface-card border-round border-1 surface-border p-3">
                    <div className="flex align-items-center justify-content-between mb-3">
                        <h6 className="m-0 font-bold" style={{ color: '#1e3a5f' }}>
                            Clientes <span className="text-sm font-normal text-color-secondary ml-2">— clique numa linha para ver detalhes</span>
                        </h6>
                        <div className="flex gap-2">
                            <Button
                                label="Excel"
                                icon="pi pi-file-excel"
                                size="small"
                                outlined
                                style={{ borderColor: '#16a34a', color: '#16a34a' }}
                                onClick={exportarExcel}
                            />
                            <Button
                                label="PDF"
                                icon="pi pi-file-pdf"
                                size="small"
                                outlined
                                style={{ borderColor: '#dc2626', color: '#dc2626' }}
                                onClick={exportarPDF}
                            />
                        </div>
                    </div>
                    <DataTable value={dadosFiltrados} paginator rows={10} rowsPerPageOptions={[10, 25, 50]}
                        emptyMessage="Nenhum cliente encontrado." tableStyle={{ minWidth: '60rem' }}
                        rowClassName={() => 'cursor-pointer'}
                        onRowClick={(e) => setClienteDetalhe(e.data)}>
                        <Column field="nomeCompleto" header="Nome" sortable />
                        <Column field="telefone" header="Telefone" />
                        <Column header="Última Compra" body={(r) => r.ultimaCompra ? new Date(r.ultimaCompra).toLocaleDateString('pt-BR') : '-'} sortable />
                        <Column field="diasSemComprar" header="Dias sem comprar" sortable body={(r) => r.diasSemComprar ?? '-'} />
                        <Column field="totalCompras" header="Compras" sortable />
                        <Column header="Ticket Médio" sortable body={(r) => r.ticketMedio > 0 ? r.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'} />
                        <Column header="Total Gasto" sortable body={(r) => r.totalGasto > 0 ? r.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'} />
                        <Column field="produtoFavorito" header="Produto Favorito" />
                        <Column header="RFM" body={(r) => `R${r.scoreR} F${r.scoreF} M${r.scoreM}`} />
                        <Column header="Status" body={(r) => {
                            type Sev = 'success' | 'warning' | 'danger' | 'secondary' | 'info' | undefined;
                            const cores: Record<string, Sev> = { 'Ativo': 'success', 'Em Risco': 'warning', 'Inativo': 'danger', 'Perdido': 'danger', 'Sem compras': 'secondary' };
                            return (
                                <div className="flex align-items-center gap-1">
                                    <Tag value={r.status} severity={cores[r.status] ?? 'secondary'} />
                                    {r.temRecorrAtiva && <i className="pi pi-sync text-xs" style={{ color: '#16a34a' }} title="Possui recorrência ativa" />}
                                </div>
                            );
                        }} />
                        <Column header="Ações" body={(r) => (
                            <div className="flex gap-1">
                                {r.telefone && (
                                    <Button icon="pi pi-whatsapp" size="small" text rounded
                                        style={{ color: '#25d366' }}
                                        tooltip="WhatsApp"
                                        onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${r.telefone.replace(/\D/g, '')}`, '_blank'); }}
                                    />
                                )}
                            </div>
                        )} />
                    </DataTable>
                </div>
            </div>

            {/* Dialog de detalhamento do cliente */}
            {clienteDetalhe && (() => {
                const vendasCliente = vendas.filter(v => v.cliente_id === clienteDetalhe.id)
                    .sort((a, b) => new Date(b.data ?? b.createdAt).getTime() - new Date(a.data ?? a.createdAt).getTime());

                const contProdutos: Record<string, { qtd: number; total: number }> = {};
                vendasCliente.forEach(v => {
                    (v.itens ?? []).forEach((it: any) => {
                        const nome = it.produto?.name ?? it.Product?.name ?? `#${it.produto_id}`;
                        if (!contProdutos[nome]) contProdutos[nome] = { qtd: 0, total: 0 };
                        contProdutos[nome].qtd   += Number(it.quantidade ?? 1);
                        contProdutos[nome].total += Number(it.quantidade ?? 1) * Number(it.valor_unitario ?? it.preco_unitario ?? 0);
                    });
                });
                const topProdutos = Object.entries(contProdutos)
                    .sort((a, b) => b[1].qtd - a[1].qtd)
                    .slice(0, 5);

                const coresClass: Record<string, string> = {
                    'VIP': '#f59e0b', 'Frequente': '#3b82f6', 'Novo': '#10b981',
                    'Em Risco': '#f97316', 'Inativo': '#ef4444', 'Perdido': '#7c3aed',
                    'Ativo': '#16a34a', 'Sem compras': '#6b7280'
                };
                const cor = coresClass[clienteDetalhe.classificacao] ?? '#6b7280';

                return (
                    <Dialog
                        header={
                            <div className="flex align-items-center gap-3">
                                <i className="pi pi-user" style={{ fontSize: '1.3rem', color: '#1e3a5f' }} />
                                <span style={{ color: '#1e3a5f' }}>{clienteDetalhe.nomeCompleto}</span>
                                <Tag value={clienteDetalhe.classificacao} style={{ background: cor, color: '#fff', fontSize: '0.75rem' }} />
                            </div>
                        }
                        visible={!!clienteDetalhe}
                        onHide={() => setClienteDetalhe(null)}
                        style={{ width: '680px' }}
                        maximizable
                        footer={
                            clienteDetalhe.telefone ? (
                                <Button
                                    label="Abrir WhatsApp"
                                    icon="pi pi-whatsapp"
                                    style={{ background: '#25d366', border: 'none' }}
                                    onClick={() => window.open(`https://wa.me/55${clienteDetalhe.telefone.replace(/\D/g, '')}`, '_blank')}
                                />
                            ) : undefined
                        }
                    >
                        {/* Scores RFM */}
                        <div className="flex gap-3 mb-4">
                            {[
                                { label: 'Recência', score: clienteDetalhe.scoreR, desc: `${clienteDetalhe.diasSemComprar ?? '?'} dias sem comprar` },
                                { label: 'Frequência', score: clienteDetalhe.scoreF, desc: `${clienteDetalhe.totalCompras} compras` },
                                { label: 'Monetário', score: clienteDetalhe.scoreM, desc: fmtM(clienteDetalhe.ticketMedio) + ' ticket' },
                            ].map(s => (
                                <div key={s.label} className="flex-1 text-center surface-ground border-round p-3">
                                    <div className="text-sm text-color-secondary mb-1">{s.label}</div>
                                    <div className="text-3xl font-bold" style={{ color: s.score >= 4 ? '#16a34a' : s.score >= 3 ? '#f59e0b' : '#dc2626' }}>{s.score}</div>
                                    <div className="text-xs text-color-secondary mt-1">{s.desc}</div>
                                </div>
                            ))}
                        </div>

                        {/* Dados gerais */}
                        <div className="grid mb-3">
                            {[
                                { label: 'Telefone',       value: clienteDetalhe.telefone ?? '-' },
                                { label: 'Total Gasto',    value: fmtM(clienteDetalhe.totalGasto) },
                                { label: 'Ticket Médio',   value: fmtM(clienteDetalhe.ticketMedio) },
                                { label: 'Última Compra',  value: clienteDetalhe.ultimaCompra ? new Date(clienteDetalhe.ultimaCompra).toLocaleDateString('pt-BR') : '-' },
                                { label: 'Freq. média',    value: clienteDetalhe.frequenciaMedia ? `${clienteDetalhe.frequenciaMedia.toFixed(0)} dias entre compras` : '-' },
                                { label: 'Status',         value: clienteDetalhe.status },
                            ].map(item => (
                                <div key={item.label} className="col-6 flex flex-column gap-1 mb-2">
                                    <span className="text-xs text-color-secondary">{item.label}</span>
                                    <span className="font-semibold text-sm">{item.value}</span>
                                </div>
                            ))}
                        </div>

                        <Divider />

                        {/* Top produtos */}
                        {topProdutos.length > 0 && (
                            <>
                                <div className="font-bold mb-2" style={{ color: '#1e3a5f' }}>Produtos mais comprados</div>
                                <div className="flex flex-column gap-1 mb-3">
                                    {topProdutos.map(([nome, dados], i) => (
                                        <div key={nome} className="flex align-items-center justify-content-between surface-ground border-round px-3 py-2">
                                            <div className="flex align-items-center gap-2">
                                                <span className="text-xs font-bold text-color-secondary">#{i + 1}</span>
                                                <span className="text-sm">{nome}</span>
                                            </div>
                                            <div className="flex gap-3 text-sm">
                                                <span className="text-color-secondary">{dados.qtd.toFixed(0)}x</span>
                                                <span className="font-semibold">{fmtM(dados.total)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Divider />
                            </>
                        )}

                        {/* Recorrências */}
                        {(() => {
                            const recorrsDialog = recorrencias.filter(r => (r.cliente_id ?? r.clienteId) === clienteDetalhe.id);
                            if (recorrsDialog.length === 0) return null;
                            return (
                                <>
                                    <Divider />
                                    <div className="font-bold mb-2" style={{ color: '#1e3a5f' }}>Recorrências</div>
                                    <div className="flex flex-column gap-2 mb-3">
                                        {recorrsDialog.map((r: any, i: number) => (
                                            <div key={r.id ?? i} className="flex align-items-center justify-content-between surface-ground border-round px-3 py-2">
                                                <div className="flex flex-column gap-1">
                                                    <span className="text-sm font-semibold">{r.produto ?? 'Recorrência'}</span>
                                                    <span className="text-xs text-color-secondary">{r.tempoRecorrencia ?? r.tempo_recorrencia} · {r.formaPagamento ?? r.forma_pagamento ?? '-'}</span>
                                                </div>
                                                <div className="flex flex-column align-items-end gap-1">
                                                    <span className="font-bold text-sm">{Number(r.valorMes ?? r.valor_mes ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês</span>
                                                    <Tag value={r.ativo ? 'Ativa' : 'Inativa'} style={{ background: r.ativo ? '#16a34a' : '#6b7280', color: '#fff', fontSize: '0.7rem' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}

                        {/* Histórico de compras */}
                        <div className="font-bold mb-2" style={{ color: '#1e3a5f' }}>Histórico de compras</div>
                        {vendasCliente.length === 0 ? (
                            <p className="text-sm text-color-secondary">Nenhuma compra registrada.</p>
                        ) : (
                            <DataTable value={vendasCliente} paginator rows={5} rowsPerPageOptions={[5, 10]}
                                tableStyle={{ minWidth: '100%' }} size="small">
                                <Column header="Data" body={(v) => new Date(v.data ?? v.createdAt).toLocaleDateString('pt-BR')} sortable />
                                <Column header="Valor" body={(v) => Number(v.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sortable />
                                <Column header="Itens" body={(v) => (v.itens ?? []).length} />
                                <Column header="Pagamento" field="forma_pagamento" />
                            </DataTable>
                        )}
                    </Dialog>
                );
            })()}

        </div>
    );
};

export default CRMPage;
