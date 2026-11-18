'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import api from '../../services/api/baseApi';

type Aba = 'vendas' | 'financeiro' | 'producao';
type PeriodoRapido = 'hoje' | 'semana' | 'mes' | 'personalizado';
type VariacaoResumo = { nome: string; quantidade: number };
type LinhaRelatorio = {
    id: string;
    produto: string;
    categoria: string;
    unidade: string;
    quantidade: number;
    valorVendido?: number;
    precoVendaMedio?: number;
    custoUnitario?: number;
    custoTotal?: number;
    lucroBruto?: number;
    fonteCusto?: 'ficha_tecnica' | 'cadastro_produto';
    vendas?: number;
    ordens?: number;
    variacoes?: VariacaoResumo[];
};
type RespostaRelatorio = {
    periodo: { dataInicio: string; dataFim: string };
    linhas: LinhaRelatorio[];
    categorias: string[];
    totais: { quantidade: number; valorVendido?: number; custoTotal?: number; lucroBruto?: number; produtosSemCusto?: number; produtos: number; vendas?: number; ordens?: number };
    avisos?: string[];
};

const dataLocal = (date: Date) => {
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
};

const periodoDatas = (tipo: PeriodoRapido) => {
    const hoje = new Date();
    if (tipo === 'hoje') return { inicio: dataLocal(hoje), fim: dataLocal(hoje) };
    if (tipo === 'semana') {
        const inicio = new Date(hoje);
        const diaSemana = hoje.getDay() || 7;
        inicio.setDate(hoje.getDate() - diaSemana + 1);
        return { inicio: dataLocal(inicio), fim: dataLocal(hoje) };
    }
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { inicio: dataLocal(inicio), fim: dataLocal(hoje) };
};

const formatarQuantidade = (valor: number, unidade?: string) => {
    const inteira = ['UN', 'CX', 'PC', 'DZ', 'CT', 'PCT', 'G', ''].includes(String(unidade ?? '').toUpperCase());
    return Number(valor || 0).toLocaleString('pt-BR', inteira
        ? { maximumFractionDigits: 0 }
        : { minimumFractionDigits: 0, maximumFractionDigits: 3 });
};
const formatarMoeda = (valor: number) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatarData = (valor: string) => {
    const [ano, mes, dia] = valor.split('-');
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
};

const RelatoriosProdutosPage = () => {
    const toast = useRef<Toast>(null);
    const padrao = useMemo(() => periodoDatas('mes'), []);
    const [aba, setAba] = useState<Aba>('vendas');
    const [periodoRapido, setPeriodoRapido] = useState<PeriodoRapido>('mes');
    const [dataInicio, setDataInicio] = useState(padrao.inicio);
    const [dataFim, setDataFim] = useState(padrao.fim);
    const [categoria, setCategoria] = useState<string | null>(null);
    const [produto, setProduto] = useState('');
    const [loading, setLoading] = useState(false);
    const [relatorio, setRelatorio] = useState<RespostaRelatorio>({
        periodo: { dataInicio: padrao.inicio, dataFim: padrao.fim },
        linhas: [],
        categorias: [],
        totais: { quantidade: 0, produtos: 0 },
    });

    useEffect(() => {
        const abaUrl = new URLSearchParams(window.location.search).get('aba');
        if (abaUrl === 'producao' || abaUrl === 'vendas' || abaUrl === 'financeiro') setAba(abaUrl);
    }, []);

    const carregar = useCallback(async () => {
        if (!dataInicio || !dataFim) {
            toast.current?.show({ severity: 'warn', summary: 'Período obrigatório', detail: 'Informe a data inicial e a data final.' });
            return;
        }
        setLoading(true);
        try {
            const response = await api.get(`/relatorios-produtos/${aba}`, {
                params: { dataInicio, dataFim, categoria: categoria || undefined, produto: produto.trim() || undefined },
            });
            setRelatorio(response.data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Não foi possível gerar o relatório', detail: error?.message ?? 'Tente novamente.' });
        } finally {
            setLoading(false);
        }
    }, [aba, categoria, dataFim, dataInicio, produto]);

    useEffect(() => { void carregar(); }, [aba]); // eslint-disable-line react-hooks/exhaustive-deps

    const selecionarPeriodo = (tipo: PeriodoRapido) => {
        setPeriodoRapido(tipo);
        if (tipo !== 'personalizado') {
            const datas = periodoDatas(tipo);
            setDataInicio(datas.inicio);
            setDataFim(datas.fim);
        }
    };

    const trocarAba = (novaAba: Aba) => {
        setAba(novaAba);
        setCategoria(null);
        setProduto('');
        window.history.replaceState(null, '', `/uikit/relatorios-produtos?aba=${novaAba}`);
    };

    const periodoLabel = `${formatarData(relatorio.periodo.dataInicio)} a ${formatarData(relatorio.periodo.dataFim)}`;

    const exportarExcel = async () => {
        if (!relatorio.linhas.length) return;
        const XLSX = await import('xlsx');
        const dados = relatorio.linhas.map((linha, index) => ({
            Posição: index + 1,
            Produto: linha.produto,
            Categoria: linha.categoria,
            [aba === 'producao' ? 'Quantidade produzida' : 'Quantidade vendida']: linha.quantidade,
            Unidade: linha.unidade,
            ...(aba === 'financeiro'
                ? { 'Custo unitário': linha.custoUnitario ?? 0, 'Custo total': linha.custoTotal ?? 0, 'Preço médio de venda': linha.precoVendaMedio ?? 0, 'Valor vendido': linha.valorVendido ?? 0 }
                : aba === 'vendas' ? { Vendas: linha.vendas ?? 0, 'Valor vendido': linha.valorVendido ?? 0 } : { 'Ordens de produção': linha.ordens ?? 0 }),
        }));
        const planilha = XLSX.utils.json_to_sheet(dados);
        planilha['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];
        const arquivo = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(arquivo, planilha, aba === 'vendas' ? 'Vendas por Produto' : 'Produção por Produto');
        XLSX.writeFile(arquivo, `relatorio-${aba}-por-produto-${dataInicio}-${dataFim}.xlsx`);
    };

    const exportarPdf = async () => {
        if (!relatorio.linhas.length) return;
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const titulo = aba === 'financeiro' ? 'Relatório Financeiro de Vendas' : aba === 'vendas' ? 'Vendas por Produto' : 'Produção por Produto';
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFontSize(17);
        doc.setTextColor(37, 99, 235);
        doc.text(titulo, 14, 16);
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text(`Período: ${periodoLabel}${categoria ? `  |  Categoria: ${categoria}` : ''}`, 14, 22);
        const cabecalho = aba === 'financeiro'
            ? [['Sabor / produto', 'Quantidade vendida', 'Preço de custo', 'Preço de venda']]
            : aba === 'vendas'
            ? [['#', 'Produto', 'Categoria', 'Quantidade', 'Unidade', 'Vendas', 'Valor vendido']]
            : [['#', 'Produto', 'Categoria', 'Quantidade', 'Unidade', 'Ordens']];
        const corpo = relatorio.linhas.map((linha, index) => aba === 'financeiro'
            ? [linha.produto, formatarQuantidade(linha.quantidade, linha.unidade), `${formatarMoeda(linha.custoTotal ?? 0)} (${formatarMoeda(linha.custoUnitario ?? 0)}/un.)`, `${formatarMoeda(linha.valorVendido ?? 0)} (${formatarMoeda(linha.precoVendaMedio ?? 0)}/un.)`]
            : aba === 'vendas'
            ? [index + 1, linha.produto, linha.categoria, formatarQuantidade(linha.quantidade, linha.unidade), linha.unidade, linha.vendas ?? 0, formatarMoeda(linha.valorVendido ?? 0)]
            : [index + 1, linha.produto, linha.categoria, formatarQuantidade(linha.quantidade, linha.unidade), linha.unidade, linha.ordens ?? 0]);
        autoTable(doc, { startY: 28, head: cabecalho, body: corpo, styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] } });
        if (aba === 'financeiro') {
            const y = (doc as any).lastAutoTable?.finalY ?? 28;
            doc.setFontSize(9);
            doc.text(`Custo total: ${formatarMoeda(relatorio.totais.custoTotal ?? 0)}   |   Venda total: ${formatarMoeda(relatorio.totais.valorVendido ?? 0)}   |   Margem bruta estimada: ${formatarMoeda(relatorio.totais.lucroBruto ?? 0)}`, 14, Math.min(y + 8, 200));
        }
        doc.save(`relatorio-${aba}-por-produto-${dataInicio}-${dataFim}.pdf`);
    };

    const exportarXml = () => {
        if (!relatorio.linhas.length) return;
        const xmlSeguro = (valor: unknown) => String(valor ?? '')
            .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
        const produtos = relatorio.linhas.map((linha) => `    <produto>\n      <sabor>${xmlSeguro(linha.produto)}</sabor>\n      <categoria>${xmlSeguro(linha.categoria)}</categoria>\n      <quantidade_vendida unidade="${xmlSeguro(linha.unidade)}">${Number(linha.quantidade || 0).toFixed(3)}</quantidade_vendida>\n      <preco_custo_unitario>${Number(linha.custoUnitario || 0).toFixed(2)}</preco_custo_unitario>\n      <preco_custo_total>${Number(linha.custoTotal || 0).toFixed(2)}</preco_custo_total>\n      <preco_venda_medio>${Number(linha.precoVendaMedio || 0).toFixed(2)}</preco_venda_medio>\n      <preco_venda_total>${Number(linha.valorVendido || 0).toFixed(2)}</preco_venda_total>\n      <lucro_bruto_estimado>${Number(linha.lucroBruto || 0).toFixed(2)}</lucro_bruto_estimado>\n    </produto>`).join('\n');
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<relatorio_financeiro_vendas moeda="BRL">\n  <periodo inicio="${relatorio.periodo.dataInicio}" fim="${relatorio.periodo.dataFim}" />\n  <totais>\n    <quantidade_vendida>${Number(relatorio.totais.quantidade || 0).toFixed(3)}</quantidade_vendida>\n    <preco_custo_total>${Number(relatorio.totais.custoTotal || 0).toFixed(2)}</preco_custo_total>\n    <preco_venda_total>${Number(relatorio.totais.valorVendido || 0).toFixed(2)}</preco_venda_total>\n    <lucro_bruto_estimado>${Number(relatorio.totais.lucroBruto || 0).toFixed(2)}</lucro_bruto_estimado>\n  </totais>\n  <produtos>\n${produtos}\n  </produtos>\n</relatorio_financeiro_vendas>`;
        const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio-financeiro-vendas-${dataInicio}-${dataFim}.xml`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const produtoBody = (linha: LinhaRelatorio) => (
        <div>
            <div className="font-semibold text-900">{linha.produto}</div>
            {!!linha.variacoes?.length && (
                <small className="text-color-secondary">
                    {linha.variacoes.map((variacao) => `${variacao.nome}: ${formatarQuantidade(variacao.quantidade, linha.unidade)}`).join('  •  ')}
                </small>
            )}
        </div>
    );

    const cards = aba === 'financeiro'
        ? [
            { label: 'Quantidade vendida', value: formatarQuantidade(relatorio.totais.quantidade), icon: 'pi-shopping-bag', color: '#2563eb' },
            { label: 'Preço de custo total', value: formatarMoeda(relatorio.totais.custoTotal ?? 0), icon: 'pi-wallet', color: '#ea580c' },
            { label: 'Preço de venda total', value: formatarMoeda(relatorio.totais.valorVendido ?? 0), icon: 'pi-dollar', color: '#16a34a' },
            { label: 'Margem bruta estimada', value: formatarMoeda(relatorio.totais.lucroBruto ?? 0), icon: 'pi-chart-line', color: '#7c3aed' },
        ]
        : aba === 'vendas'
        ? [
            { label: 'Unidades vendidas', value: formatarQuantidade(relatorio.totais.quantidade), icon: 'pi-shopping-bag', color: '#2563eb' },
            { label: 'Valor vendido', value: formatarMoeda(relatorio.totais.valorVendido ?? 0), icon: 'pi-dollar', color: '#16a34a' },
            { label: 'Produtos diferentes', value: String(relatorio.totais.produtos), icon: 'pi-box', color: '#7c3aed' },
            { label: 'Vendas consideradas', value: String(relatorio.totais.vendas ?? 0), icon: 'pi-receipt', color: '#ea580c' },
        ]
        : [
            { label: 'Unidades produzidas', value: formatarQuantidade(relatorio.totais.quantidade), icon: 'pi-cog', color: '#2563eb' },
            { label: 'Produtos produzidos', value: String(relatorio.totais.produtos), icon: 'pi-box', color: '#7c3aed' },
            { label: 'Ordens concluídas', value: String(relatorio.totais.ordens ?? 0), icon: 'pi-check-circle', color: '#16a34a' },
        ];

    return (
        <div className="grid">
            <Toast ref={toast} />
            <div className="col-12">
                <div className="card">
                    <div className="flex flex-column md:flex-row md:align-items-center justify-content-between gap-3 mb-4">
                        <div>
                            <h3 className="m-0 mb-1">Relatórios de Produtos</h3>
                            <span className="text-color-secondary">Compare vendas, valores financeiros e produção já compilados por produto.</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {aba === 'financeiro'
                                ? <Button label="Exportar XML" icon="pi pi-code" severity="success" outlined onClick={exportarXml} disabled={!relatorio.linhas.length} />
                                : <Button label="Exportar Excel" icon="pi pi-file-excel" severity="success" outlined onClick={exportarExcel} disabled={!relatorio.linhas.length} />}
                            <Button label="Exportar PDF" icon="pi pi-file-pdf" severity="danger" outlined onClick={exportarPdf} disabled={!relatorio.linhas.length} />
                        </div>
                    </div>

                    <div className="flex gap-2 flex-wrap mb-4 p-2 border-round" style={{ background: '#f1f5f9', width: 'fit-content' }}>
                        <Button label="Vendas por Produto" icon="pi pi-chart-bar" outlined={aba !== 'vendas'} onClick={() => trocarAba('vendas')} />
                        <Button label="Vendas Financeiras" icon="pi pi-dollar" outlined={aba !== 'financeiro'} onClick={() => trocarAba('financeiro')} />
                        <Button label="Produção por Produto" icon="pi pi-cog" outlined={aba !== 'producao'} onClick={() => trocarAba('producao')} />
                    </div>

                    <div className="surface-ground border-round p-3 mb-4">
                        <div className="flex gap-2 flex-wrap mb-3">
                            {([
                                ['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['personalizado', 'Personalizado'],
                            ] as [PeriodoRapido, string][]).map(([value, label]) => (
                                <Button key={value} label={label} size="small" outlined={periodoRapido !== value} severity={periodoRapido === value ? undefined : 'secondary'} onClick={() => selecionarPeriodo(value)} />
                            ))}
                        </div>
                        <div className="grid formgrid align-items-end">
                            <div className="field col-12 sm:col-6 md:col-2">
                                <label htmlFor="rel-inicio" className="font-medium">Data inicial</label>
                                <InputText id="rel-inicio" type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPeriodoRapido('personalizado'); }} className="w-full" />
                            </div>
                            <div className="field col-12 sm:col-6 md:col-2">
                                <label htmlFor="rel-fim" className="font-medium">Data final</label>
                                <InputText id="rel-fim" type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPeriodoRapido('personalizado'); }} className="w-full" />
                            </div>
                            <div className="field col-12 sm:col-6 md:col-3">
                                <label htmlFor="rel-categoria" className="font-medium">Categoria</label>
                                <Dropdown id="rel-categoria" value={categoria} onChange={(e) => setCategoria(e.value)} options={relatorio.categorias.map((item) => ({ label: item, value: item }))} placeholder="Todas as categorias" showClear className="w-full" />
                            </div>
                            <div className="field col-12 sm:col-6 md:col-3">
                                <label htmlFor="rel-produto" className="font-medium">Produto</label>
                                <InputText id="rel-produto" value={produto} onChange={(e) => setProduto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void carregar(); }} placeholder="Buscar pelo nome" className="w-full" />
                            </div>
                            <div className="field col-12 md:col-2">
                                <Button label="Aplicar filtros" icon="pi pi-filter" onClick={carregar} loading={loading} className="w-full" />
                            </div>
                        </div>
                    </div>

                    <div className="grid mb-2">
                        {cards.map((card) => (
                            <div key={card.label} className={`col-12 sm:col-6 ${cards.length === 4 ? 'xl:col-3' : 'lg:col-4'}`}>
                                <div className="surface-card border-1 surface-border border-round p-3 h-full flex align-items-center gap-3">
                                    <div className="flex align-items-center justify-content-center border-circle" style={{ width: 48, height: 48, background: `${card.color}18`, color: card.color }}>
                                        <i className={`pi ${card.icon}`} style={{ fontSize: '1.35rem' }} />
                                    </div>
                                    <div>
                                        <div className="text-color-secondary text-sm mb-1">{card.label}</div>
                                        <div className="text-2xl font-bold text-900">{card.value}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-content-between align-items-center mb-2">
                        <h5 className="m-0">{aba === 'financeiro' ? 'Relatório financeiro por sabor' : aba === 'vendas' ? 'Ranking de produtos vendidos' : 'Resumo da produção concluída'}</h5>
                        <span className="text-color-secondary text-sm">{periodoLabel}</span>
                    </div>
                    {aba === 'financeiro' && (relatorio.totais.produtosSemCusto ?? 0) > 0 && (
                        <div className="p-3 mb-3 border-round bg-yellow-50 text-yellow-900 border-1 border-yellow-200">
                            <i className="pi pi-exclamation-triangle mr-2" />
                            {relatorio.totais.produtosSemCusto} produto(s) estão sem custo na ficha técnica e no cadastro.
                        </div>
                    )}
                    {aba === 'financeiro' && (relatorio.totais.custoTotal ?? 0) > (relatorio.totais.valorVendido ?? 0) && (
                        <div className="p-3 mb-3 border-round bg-orange-50 text-orange-900 border-1 border-orange-200">
                            <i className="pi pi-info-circle mr-2" />
                            O custo calculado está acima das vendas. Revise principalmente as unidades, quantidades e rendimentos das fichas técnicas antes de enviar o relatório à contabilidade.
                        </div>
                    )}
                    <DataTable value={relatorio.linhas} loading={loading} paginator rows={15} rowsPerPageOptions={[15, 30, 50]} responsiveLayout="scroll" stripedRows emptyMessage={aba === 'producao' ? 'Nenhuma produção concluída nesse período.' : 'Nenhum produto vendido nesse período.'}>
                        {aba === 'financeiro' ? [
                            <Column key="produto-financeiro" field="produto" header="Sabor / produto" body={produtoBody} sortable />,
                            <Column key="quantidade-financeiro" field="quantidade" header="Quantidades vendidas" body={(linha: LinhaRelatorio) => <span className="font-semibold">{formatarQuantidade(linha.quantidade, linha.unidade)} {linha.unidade}</span>} sortable />,
                            <Column key="custo-financeiro" field="custoTotal" header="Preço de custo" body={(linha: LinhaRelatorio) => <div><strong>{formatarMoeda(linha.custoTotal ?? 0)}</strong><small className="block text-color-secondary">{formatarMoeda(linha.custoUnitario ?? 0)} por unidade · {linha.fonteCusto === 'ficha_tecnica' ? 'ficha técnica' : 'cadastro'}</small></div>} sortable />,
                            <Column key="venda-financeiro" field="valorVendido" header="Preço de venda" body={(linha: LinhaRelatorio) => <div><strong>{formatarMoeda(linha.valorVendido ?? 0)}</strong><small className="block text-color-secondary">média de {formatarMoeda(linha.precoVendaMedio ?? 0)} por unidade</small></div>} sortable />,
                        ] : [
                            <Column key="posicao" header="#" body={(_, options) => options.rowIndex + 1} style={{ width: 65 }} />,
                            <Column key="produto" field="produto" header="Produto" body={produtoBody} sortable />,
                            <Column key="categoria" field="categoria" header="Categoria" sortable />,
                            <Column key="quantidade" field="quantidade" header={aba === 'vendas' ? 'Quantidade vendida' : 'Quantidade produzida'} body={(linha: LinhaRelatorio) => <span className="font-semibold">{formatarQuantidade(linha.quantidade, linha.unidade)}</span>} sortable />,
                            <Column key="unidade" field="unidade" header="Unidade" style={{ width: 100 }} />,
                            aba === 'vendas'
                                ? <Column key="vendas" field="vendas" header="Vendas" sortable style={{ width: 100 }} />
                                : <Column key="ordens" field="ordens" header="Ordens" sortable style={{ width: 100 }} />,
                            ...(aba === 'vendas' ? [<Column key="valor-vendido" field="valorVendido" header="Valor vendido" body={(linha: LinhaRelatorio) => formatarMoeda(linha.valorVendido ?? 0)} sortable />] : []),
                        ]}
                    </DataTable>
                </div>
            </div>
        </div>
    );
};

export default RelatoriosProdutosPage;
