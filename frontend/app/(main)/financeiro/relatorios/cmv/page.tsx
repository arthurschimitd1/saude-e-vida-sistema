'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { TabPanel, TabView } from 'primereact/tabview';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { useRouter } from 'next/navigation';
import api from '../../../services/api/baseApi';

type LinhaComparativo = {
    produtoId: number; produto: string; categoria: string; unidade: string;
    estoqueInicial: number; compras: number; estoqueFinal: number;
    consumoReal: number; consumoTeorico: number; custoReferencia: number;
    valorFinanceiro: number; valorReal: number; valorTeorico: number;
    diferencaQuantidade: number; diferencaValor: number;
};
type LinhaVenda = {
    produtoId: number; produto: string; categoria: string; unidade: string;
    quantidadeVendida: number; custoUnitarioReal: number; valorRealCompetencia: number;
    valorTeorico: number; diferencaValor: number; fonteCusto: string;
};
type Compra = {
    id: number; importacaoId: number; produto: string; dataEmissao: string;
    dataOriginalDisponivel: boolean; nota: string | null; chaveAcesso: string | null;
    fornecedor: string; quantidade: number; unidade: string; custoUnitario: number; valorTotal: number;
};
type Ficha = {
    produtoId: number; produto: string; quantidadeVendida: number; rendimento: number;
    rendimentoInferido?: boolean;
    receita: string; valorTeorico: number;
    ingredientes: { produtoId: number; produto: string; quantidade: number; unidade: string; valor: number }[];
};
type SemFicha = { produtoId: number; produto: string; quantidadeVendida: number; motivo?: 'rendimento_pendente' };
type RespostaCMV = {
    periodo: { dataInicio: string; dataFim: string };
    resumo: {
        financeiro: { valor: number; notas: number; fornecedores: number; itens: number };
        real: { valor: number; estoqueInicial: number; compras: number; estoqueFinal: number };
        realCompetencia: { valor: number; produtos: number; unidadesVendidas: number };
        teorico: { valor: number; coberturaPercentual: number; unidadesVendidas: number; unidadesComFicha: number; produtosSemFicha: number };
        teoricoCompetencia: { valor: number };
        divergencia: { valor: number; percentual: number | null };
        divergenciaCompetencia: { valor: number; percentual: number | null };
    };
    comparativo: LinhaComparativo[]; vendas: LinhaVenda[]; compras: Compra[]; fichas: Ficha[]; semFicha: SemFicha[]; avisos: string[];
};

const dataLocal = (data: Date) => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
const moeda = (valor: number) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const quantidade = (valor: number) => Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dataBr = (valor: string) => new Date(valor).toLocaleDateString('pt-BR');
const vazio = (inicio: string, fim: string): RespostaCMV => ({
    periodo: { dataInicio: inicio, dataFim: fim },
    resumo: {
        financeiro: { valor: 0, notas: 0, fornecedores: 0, itens: 0 },
        real: { valor: 0, estoqueInicial: 0, compras: 0, estoqueFinal: 0 },
        realCompetencia: { valor: 0, produtos: 0, unidadesVendidas: 0 },
        teorico: { valor: 0, coberturaPercentual: 100, unidadesVendidas: 0, unidadesComFicha: 0, produtosSemFicha: 0 },
        teoricoCompetencia: { valor: 0 },
        divergencia: { valor: 0, percentual: null },
        divergenciaCompetencia: { valor: 0, percentual: null },
    },
    comparativo: [], vendas: [], compras: [], fichas: [], semFicha: [], avisos: [],
});

export default function CMVPage() {
    const router = useRouter();
    const toast = useRef<Toast>(null);
    const padrao = useMemo(() => {
        const hoje = new Date();
        return { inicio: dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: dataLocal(hoje) };
    }, []);
    const [dataInicio, setDataInicio] = useState(padrao.inicio);
    const [dataFim, setDataFim] = useState(padrao.fim);
    const [produto, setProduto] = useState('');
    const [loading, setLoading] = useState(false);
    const [dados, setDados] = useState<RespostaCMV>(vazio(padrao.inicio, padrao.fim));

    const carregar = useCallback(async () => {
        if (!dataInicio || !dataFim) return;
        setLoading(true);
        try {
            const resposta = await api.get('/financeiro/cmv', { params: { dataInicio, dataFim, produto: produto.trim() || undefined } });
            setDados(resposta.data);
        } catch (erro: any) {
            toast.current?.show({ severity: 'error', summary: 'Não foi possível calcular o CMV', detail: erro?.message ?? 'Tente novamente.' });
        } finally {
            setLoading(false);
        }
    }, [dataFim, dataInicio, produto]);

    useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const exportarExcel = async () => {
        const XLSX = await import('xlsx');
        const arquivo = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(dados.comparativo.map((l) => ({
            Produto: l.produto, Categoria: l.categoria, Unidade: l.unidade,
            'Estoque inicial': l.estoqueInicial, Compras: l.compras, 'Estoque final': l.estoqueFinal,
            'Consumo real': l.consumoReal, 'Consumo teórico': l.consumoTeorico,
            'CMV financeiro': l.valorFinanceiro, 'CMV real': l.valorReal, 'CMV teórico': l.valorTeorico,
            'Divergência real x teórico': l.diferencaValor,
        }))), 'Comparativo');
        XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(dados.vendas.map((l) => ({
            Produto: l.produto, Categoria: l.categoria, 'Quantidade vendida': l.quantidadeVendida,
            'Custo real unitário': l.custoUnitarioReal, 'CMV real da competência': l.valorRealCompetencia,
            'CMV teórico das vendas': l.valorTeorico, 'Desvio real x teórico': l.diferencaValor,
        }))), 'CMV Real Competência');
        XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(dados.compras.map((l) => ({
            Data: dataBr(l.dataEmissao), Nota: l.nota || '', Fornecedor: l.fornecedor, Produto: l.produto,
            Quantidade: l.quantidade, Unidade: l.unidade, 'Valor unitário': l.custoUnitario, 'Valor total': l.valorTotal,
        }))), 'Compras');
        XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(dados.fichas.flatMap((f) => f.ingredientes.map((i) => ({
            'Produto vendido': f.produto, 'Quantidade vendida': f.quantidadeVendida, Ficha: f.receita,
            Rendimento: f.rendimento, Ingrediente: i.produto, 'Consumo esperado': i.quantidade, Unidade: i.unidade, Valor: i.valor,
        })))), 'CMV Teórico');
        XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(dados.semFicha.map((l) => ({ Produto: l.produto, 'Quantidade vendida': l.quantidadeVendida }))), 'Sem ficha técnica');
        XLSX.writeFile(arquivo, `cmv-${dataInicio}-${dataFim}.xlsx`);
    };

    const exportarPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFontSize(18); doc.setTextColor(30, 58, 95); doc.text('Relatório Comparativo de CMV', 14, 16);
        doc.setFontSize(9); doc.setTextColor(90); doc.text(`Período: ${dataBr(`${dados.periodo.dataInicio}T12:00:00`)} a ${dataBr(`${dados.periodo.dataFim}T12:00:00`)}`, 14, 22);
        doc.text(`Real competência: ${moeda(dados.resumo.realCompetencia.valor)}   |   Real estoque: ${moeda(dados.resumo.real.valor)}   |   Teórico: ${moeda(dados.resumo.teoricoCompetencia.valor)}   |   Desvio competência: ${moeda(dados.resumo.divergenciaCompetencia.valor)}`, 14, 28);
        autoTable(doc, {
            startY: 34,
            head: [['Produto', 'Un.', 'Est. inicial', 'Compras', 'Est. final', 'Consumo real', 'Consumo teórico', 'CMV real', 'CMV teórico', 'Divergência']],
            body: dados.comparativo.map((l) => [l.produto, l.unidade, quantidade(l.estoqueInicial), quantidade(l.compras), quantidade(l.estoqueFinal), quantidade(l.consumoReal), quantidade(l.consumoTeorico), moeda(l.valorReal), moeda(l.valorTeorico), moeda(l.diferencaValor)]),
            styles: { fontSize: 7 }, headStyles: { fillColor: [30, 58, 95] },
        });
        doc.save(`cmv-${dataInicio}-${dataFim}.pdf`);
    };

    return (
        <div className="grid">
            <Toast ref={toast} />
            <div className="col-12">
                <div className="card">
                    <div className="flex flex-column md:flex-row md:align-items-center justify-content-between gap-3 mb-4">
                        <div className="flex align-items-center gap-3">
                            <Button icon="pi pi-arrow-left" text rounded aria-label="Voltar" onClick={() => router.push('/financeiro/relatorios')} />
                            <div>
                                <h3 className="m-0 mb-1">Comparativo de CMV</h3>
                                <span className="text-color-secondary">Vendas da competência × custo real histórico × custo esperado pelas fichas técnicas.</span>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Button label="Excel" icon="pi pi-file-excel" severity="success" outlined onClick={exportarExcel} disabled={loading} />
                            <Button label="PDF" icon="pi pi-file-pdf" severity="danger" outlined onClick={exportarPdf} disabled={loading} />
                        </div>
                    </div>

                    <div className="surface-ground border-round p-3 mb-4">
                        <div className="grid formgrid align-items-end">
                            <div className="field col-12 sm:col-6 md:col-3">
                                <label htmlFor="cmv-inicio" className="font-medium">Data inicial</label>
                                <InputText id="cmv-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full" />
                            </div>
                            <div className="field col-12 sm:col-6 md:col-3">
                                <label htmlFor="cmv-fim" className="font-medium">Data final</label>
                                <InputText id="cmv-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full" />
                            </div>
                            <div className="field col-12 md:col-4">
                                <label htmlFor="cmv-produto" className="font-medium">Produto ou categoria</label>
                                <InputText id="cmv-produto" value={produto} onChange={(e) => setProduto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void carregar(); }} placeholder="Todos os produtos" className="w-full" />
                            </div>
                            <div className="field col-12 md:col-2">
                                <Button label="Calcular" icon="pi pi-calculator" onClick={carregar} loading={loading} className="w-full" />
                            </div>
                        </div>
                    </div>

                    <div className="grid mb-3">
                        {[
                            { titulo: 'CMV Financeiro', valor: dados.resumo.financeiro.valor, detalhe: `${dados.resumo.financeiro.notas} notas de compra`, cor: '#2563eb', icone: 'pi-shopping-cart' },
                            { titulo: 'CMV Real · Competência', valor: dados.resumo.realCompetencia.valor, detalhe: `${quantidade(dados.resumo.realCompetencia.unidadesVendidas)} unidades vendidas`, cor: '#0891b2', icone: 'pi-chart-line' },
                            { titulo: 'CMV Real · Estoque', valor: dados.resumo.real.valor, detalhe: 'Inicial + compras − final', cor: '#ea580c', icone: 'pi-box' },
                            { titulo: 'CMV Teórico · Vendas', valor: dados.resumo.teoricoCompetencia.valor, detalhe: `${quantidade(dados.resumo.teorico.coberturaPercentual)}% das vendas cobertas`, cor: '#7c3aed', icone: 'pi-book' },
                            { titulo: 'Desvio · Competência', valor: dados.resumo.divergenciaCompetencia.valor, detalhe: dados.resumo.divergenciaCompetencia.percentual == null ? 'Sem base teórica' : `${quantidade(dados.resumo.divergenciaCompetencia.percentual)}% sobre o teórico`, cor: dados.resumo.divergenciaCompetencia.valor > 0 ? '#dc2626' : '#16a34a', icone: 'pi-chart-line' },
                        ].map((card) => (
                            <div key={card.titulo} className="col-12 sm:col-6 lg:col-4 xl:col-3">
                                <div className="surface-card border-1 surface-border border-round p-3 h-full" style={{ borderLeft: `4px solid ${card.cor}` }}>
                                    <div className="flex justify-content-between align-items-start">
                                        <div><div className="text-color-secondary text-sm mb-2">{card.titulo}</div><div className="text-2xl font-bold">{moeda(card.valor)}</div></div>
                                        <i className={`pi ${card.icone}`} style={{ color: card.cor, fontSize: '1.4rem' }} />
                                    </div>
                                    <div className="text-color-secondary text-xs mt-2">{card.detalhe}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid mb-3">
                        <div className="col-12 lg:col-8">
                            <div className="surface-ground border-round p-3 h-full">
                                <div className="font-semibold mb-2">CMV real por estoque (controle)</div>
                                <div className="flex flex-wrap align-items-center gap-2 text-lg">
                                    <span>{moeda(dados.resumo.real.estoqueInicial)}</span><b>+</b><span>{moeda(dados.resumo.real.compras)}</span><b>−</b><span>{moeda(dados.resumo.real.estoqueFinal)}</span><b>=</b><strong style={{ color: '#ea580c' }}>{moeda(dados.resumo.real.valor)}</strong>
                                </div>
                                <div className="text-xs text-color-secondary mt-2">Estoque inicial + compras do período − estoque final.</div>
                            </div>
                        </div>
                        <div className="col-12 lg:col-4">
                            <div className="surface-ground border-round p-3 h-full flex flex-column justify-content-center">
                                <div className="flex justify-content-between mb-2"><span>Cobertura das fichas</span><strong>{quantidade(dados.resumo.teorico.coberturaPercentual)}%</strong></div>
                                <div style={{ height: 9, borderRadius: 8, background: '#e2e8f0', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, dados.resumo.teorico.coberturaPercentual)}%`, height: '100%', background: dados.resumo.teorico.coberturaPercentual >= 90 ? '#16a34a' : '#f59e0b' }} /></div>
                                <div className="text-xs text-color-secondary mt-2">{quantidade(dados.resumo.teorico.unidadesComFicha)} de {quantidade(dados.resumo.teorico.unidadesVendidas)} unidades vendidas.</div>
                            </div>
                        </div>
                    </div>

                    <div className="surface-ground border-round p-3 mb-4">
                        <div className="font-semibold mb-2">CMV real da competência</div>
                        <div className="flex flex-wrap align-items-center gap-2 text-lg">
                            <span>{quantidade(dados.resumo.realCompetencia.unidadesVendidas)} unidades vendidas</span><b>×</b><span>custo real histórico dos produtos</span><b>=</b><strong style={{ color: '#0891b2' }}>{moeda(dados.resumo.realCompetencia.valor)}</strong>
                        </div>
                        <div className="text-xs text-color-secondary mt-2">Baseado nas vendas do período. O desvio financeiro é calculado contra o CMV teórico dessas mesmas vendas.</div>
                    </div>

                    {!!dados.avisos.length && <div className="flex flex-column gap-2 mb-4">{dados.avisos.map((aviso) => <Message key={aviso} severity="warn" text={aviso} className="w-full justify-content-start" />)}</div>}

                    <TabView>
                        <TabPanel header="Comparativo" leftIcon="pi pi-chart-bar mr-2">
                            <DataTable value={dados.comparativo} loading={loading} paginator rows={15} rowsPerPageOptions={[15, 30, 50]} responsiveLayout="scroll" stripedRows emptyMessage="Sem movimentações para calcular neste período.">
                                <Column field="produto" header="Produto / insumo" sortable frozen />
                                <Column field="unidade" header="Un." style={{ width: 75 }} />
                                <Column field="estoqueInicial" header="Estoque inicial" body={(l: LinhaComparativo) => quantidade(l.estoqueInicial)} sortable />
                                <Column field="compras" header="Compras" body={(l: LinhaComparativo) => quantidade(l.compras)} sortable />
                                <Column field="estoqueFinal" header="Estoque final" body={(l: LinhaComparativo) => quantidade(l.estoqueFinal)} sortable />
                                <Column field="consumoReal" header="Consumo real" body={(l: LinhaComparativo) => <strong>{quantidade(l.consumoReal)}</strong>} sortable />
                                <Column field="consumoTeorico" header="Consumo teórico" body={(l: LinhaComparativo) => quantidade(l.consumoTeorico)} sortable />
                                <Column field="valorReal" header="CMV real" body={(l: LinhaComparativo) => moeda(l.valorReal)} sortable />
                                <Column field="valorTeorico" header="CMV teórico" body={(l: LinhaComparativo) => moeda(l.valorTeorico)} sortable />
                                <Column field="diferencaValor" header="Divergência" body={(l: LinhaComparativo) => <Tag value={moeda(l.diferencaValor)} severity={l.diferencaValor > 0 ? 'danger' : l.diferencaValor < 0 ? 'success' : 'info'} />} sortable />
                            </DataTable>
                        </TabPanel>
                        <TabPanel header="CMV Real · Vendas" leftIcon="pi pi-chart-line mr-2">
                            <DataTable value={dados.vendas} loading={loading} paginator rows={15} responsiveLayout="scroll" stripedRows emptyMessage="Nenhum produto vendido neste período.">
                                <Column field="produto" header="Produto vendido" sortable frozen />
                                <Column field="categoria" header="Categoria" sortable />
                                <Column field="quantidadeVendida" header="Quantidade vendida" body={(l: LinhaVenda) => `${quantidade(l.quantidadeVendida)} ${l.unidade}`} sortable />
                                <Column field="custoUnitarioReal" header="Custo real unitário" body={(l: LinhaVenda) => moeda(l.custoUnitarioReal)} sortable />
                                <Column field="valorRealCompetencia" header="CMV real competência" body={(l: LinhaVenda) => <strong>{moeda(l.valorRealCompetencia)}</strong>} sortable />
                                <Column field="valorTeorico" header="CMV teórico" body={(l: LinhaVenda) => moeda(l.valorTeorico)} sortable />
                                <Column field="diferencaValor" header="Desvio" body={(l: LinhaVenda) => <Tag value={moeda(l.diferencaValor)} severity={l.diferencaValor > 0 ? 'danger' : l.diferencaValor < 0 ? 'success' : 'info'} />} sortable />
                            </DataTable>
                        </TabPanel>
                        <TabPanel header="CMV Financeiro · Compras" leftIcon="pi pi-shopping-cart mr-2">
                            <DataTable value={dados.compras} loading={loading} paginator rows={15} responsiveLayout="scroll" stripedRows emptyMessage="Nenhuma nota de entrada importada neste período.">
                                <Column field="dataEmissao" header="Emissão" body={(l: Compra) => <div>{dataBr(l.dataEmissao)}{!l.dataOriginalDisponivel && <div className="text-xs text-orange-600">data da importação</div>}</div>} sortable />
                                <Column field="nota" header="NF" body={(l: Compra) => l.nota || 'Não registrada'} />
                                <Column field="fornecedor" header="Fornecedor" sortable />
                                <Column field="produto" header="Produto comprado" sortable />
                                <Column field="quantidade" header="Quantidade" body={(l: Compra) => `${quantidade(l.quantidade)} ${l.unidade}`} sortable />
                                <Column field="custoUnitario" header="Valor unitário" body={(l: Compra) => moeda(l.custoUnitario)} sortable />
                                <Column field="valorTotal" header="Valor total" body={(l: Compra) => <strong>{moeda(l.valorTotal)}</strong>} sortable />
                            </DataTable>
                        </TabPanel>
                        <TabPanel header="CMV Real · Estoques" leftIcon="pi pi-box mr-2">
                            <DataTable value={dados.comparativo} loading={loading} paginator rows={15} responsiveLayout="scroll" stripedRows emptyMessage="Sem estoque movimentado neste período.">
                                <Column field="produto" header="Produto / insumo" sortable />
                                <Column field="categoria" header="Categoria" sortable />
                                <Column field="estoqueInicial" header="Estoque inicial" body={(l: LinhaComparativo) => `${quantidade(l.estoqueInicial)} ${l.unidade}`} sortable />
                                <Column field="compras" header="Compras" body={(l: LinhaComparativo) => `${quantidade(l.compras)} ${l.unidade}`} sortable />
                                <Column field="estoqueFinal" header="Estoque final" body={(l: LinhaComparativo) => `${quantidade(l.estoqueFinal)} ${l.unidade}`} sortable />
                                <Column field="custoReferencia" header="Custo de referência" body={(l: LinhaComparativo) => moeda(l.custoReferencia)} sortable />
                                <Column field="valorReal" header="CMV real" body={(l: LinhaComparativo) => <strong>{moeda(l.valorReal)}</strong>} sortable />
                            </DataTable>
                        </TabPanel>
                        <TabPanel header="CMV Teórico · Fichas" leftIcon="pi pi-book mr-2">
                            <DataTable value={dados.fichas} loading={loading} paginator rows={10} responsiveLayout="scroll" stripedRows emptyMessage="Nenhuma venda com ficha técnica neste período.">
                                <Column field="produto" header="Produto vendido" sortable />
                                <Column field="quantidadeVendida" header="Quantidade vendida" body={(l: Ficha) => quantidade(l.quantidadeVendida)} sortable />
                                <Column field="receita" header="Ficha técnica" />
                                <Column field="rendimento" header="Rendimento" body={(l: Ficha) => <div>
                                    <span>{quantidade(l.rendimento)}</span>
                                    {l.rendimentoInferido && <Tag value="inferido" severity="warning" className="ml-2" />}
                                </div>} />
                                <Column header="Consumo esperado" body={(l: Ficha) => <div className="flex flex-column gap-1">{l.ingredientes.map((i) => <span key={`${l.produtoId}-${i.produtoId}`}>{i.produto}: <b>{quantidade(i.quantidade)} {i.unidade}</b></span>)}</div>} />
                                <Column field="valorTeorico" header="CMV teórico" body={(l: Ficha) => <strong>{moeda(l.valorTeorico)}</strong>} sortable />
                            </DataTable>
                            {!!dados.semFicha.length && <div className="mt-4"><h5>Produtos fora do cálculo teórico</h5><DataTable value={dados.semFicha} size="small" responsiveLayout="scroll"><Column field="produto" header="Produto" /><Column field="quantidadeVendida" header="Quantidade vendida" body={(l: SemFicha) => quantidade(l.quantidadeVendida)} /><Column header="Motivo" body={(l: SemFicha) => l.motivo === 'rendimento_pendente' ? 'Rendimento da ficha pendente' : 'Sem ficha técnica'} /></DataTable></div>}
                        </TabPanel>
                    </TabView>
                </div>
            </div>
        </div>
    );
}
