'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAnalise, refreshAnalises, Access, Commercial, Filters, Point, Product } from '../shared/analises';
import { FilterBar, Metric, Panel, Empty, Failure, Loading, Bars, moeda, numero, dataBR } from '../shared/Widgets';
import { CustomerTable, ProductTable } from '../shared/DetailTables';
import s from '../shared/Analises.module.scss';
const Evolution = dynamic(() => import('../shared/Evolution'), { ssr: false, loading: () => <Loading /> });

export default function Comercial() {
    const access = useAnalise<Access>('acesso');
    if (access.loading) return <Loading />;
    if (!access.data?.comercial)
        return (
            <main className={s.dashboard}>
                <h1>Comercial</h1>
                <Failure error={access.error || 'Sem permissão para esta visão da Central de Gestão.'} retry={access.retry} />
            </main>
        );
    return <CommercialContent key={access.session} empresa={access.data.empresaId} />;
}
function CommercialContent({ empresa }: { empresa: number }) {
    const [filters, setFilters] = useState<Filters>({ periodo: 'mes', diasSem: '30' }),
        [granularity, setGranularity] = useState('dia'),
        [group, setGroup] = useState(''),
        [selected, setSelected] = useState<Product | null>(null);
    const result = useAnalise<Commercial>('comercial', 'resumo', filters);
    const data = result.data;
    const serie = useAnalise<{ empresaId: number; serie: Point[] }>('comercial', 'serie-produto', { ...filters, produto: selected?.chave }, !!selected);
    const apply = (f: Filters) => {
        setFilters(f);
        setSelected(null);
        setGroup('');
    };
    return (
        <main className={s.dashboard}>
            <header className={s.heading}>
                <div>
                    <span>CENTRAL DE GESTÃO</span>
                    <h1>Comercial</h1>
                    <p>Vendas, clientes e produtos em uma visão objetiva da operação.</p>
                </div>
                <span className={s.company}>Empresa #{empresa}</span>
            </header>
            <FilterBar view="comercial" value={filters} onApply={apply} onRefresh={() => refreshAnalises('comercial')} refreshing={result.refreshing} />
            <p className={s.note}>
                Produto selecionado filtra as vendas que contêm esse item; os cards de vendas mantêm o valor integral dessas vendas. Novos cadastros e orçamentos respeitam cliente e período, sem filtro de produto. RFM considera somente compras
                registradas.
            </p>
            {result.error && <Failure error={result.error} retry={result.retry} stale={!!data} />}
            {result.loading ? (
                <Loading />
            ) : (
                data && (
                    <>
                        <div className={s.period}>
                            <span>
                                {dataBR(data.periodo.inicio)} — {dataBR(data.periodo.fim)}
                            </span>
                            <span>
                                Anterior: {dataBR(data.periodo.anteriorInicio)} — {dataBR(data.periodo.anteriorFim)}
                            </span>
                            <span>{result.refreshing ? 'Atualizando…' : `Atualizado às ${new Date(data.atualizadoEm).toLocaleTimeString('pt-BR')}`}</span>
                        </div>
                        <div className={s.metrics}>
                            <Metric label="Vendas registradas" value={moeda(data.resumo.total)} note={`Anterior: ${moeda(data.resumo.anterior)}`} icon="pi-shopping-bag" />
                            <Metric label="Quantidade de vendas" value={numero(data.resumo.quantidade)} note="Cada venda contada uma vez" icon="pi-shopping-cart" />
                            <Metric label="Ticket médio" value={moeda(data.resumo.ticket)} note="Valor registrado por venda" icon="pi-ticket" />
                            <Metric label="Clientes com compras" value={numero(data.clientes)} note="Clientes identificados" icon="pi-users" />
                            <Metric label="Novos cadastros" value={numero(data.novosClientes)} note="Não equivale a primeira compra" icon="pi-user-plus" />
                            <Metric label="Orçamentos criados" value={numero(data.orcamentos)} note="Não comprova envio ou conversão" icon="pi-file" />
                        </div>
                        <div className={s.mainGrid}>
                            <Panel
                                title="Evolução das vendas"
                                note="Períodos equivalentes alinhados pela posição relativa dos dias."
                                action={
                                    <label className={s.compactLabel}>
                                        Agrupar
                                        <select value={granularity} onChange={(e) => setGranularity(e.target.value)}>
                                            <option value="dia">Dia</option>
                                            <option value="semana">Semana</option>
                                            <option value="mes">Mês</option>
                                        </select>
                                    </label>
                                }
                            >
                                {data.resumo.quantidade === 0 ? (
                                    <Empty text="Nenhuma venda encontrada no período." />
                                ) : (
                                    <Evolution points={data.serie} previous={data.serieAnterior} previousStart={data.periodo.anteriorInicio} currentStart={data.periodo.inicio} granularity={granularity} />
                                )}
                            </Panel>
                            <Panel title="ABC por valor vendido" note="População completa elegível · valor dos produtos, sem entrega.">
                                {data.abc === null ? (
                                    <Empty text="ABC indisponível: existem valores inconsistentes." />
                                ) : data.abc.length ? (
                                    <>
                                        <Bars rows={data.abc.map((a) => ({ label: `Classe ${a.classe} · ${a.produtos} produtos`, value: Number(a.percentual), text: `${numero(a.percentual)}% · ${moeda(a.valor)}` }))} />
                                        <p className={s.note}>
                                            Convenção: A até {data.abcLimites.a}%, B até {data.abcLimites.b}%, C restante. O item que cruza o limite fica na classe em que começou. Empates ordenados pela chave do SKU.
                                        </p>
                                    </>
                                ) : (
                                    <Empty text="Sem valor vendido elegível para classificar." />
                                )}
                                <p className={s.note}>
                                    {numero(data.abcSemValor)} produtos sem valor vendido ficam fora das classes. {numero(data.itensSemCatalogo)} itens sem catálogo elegível, fora da análise.
                                </p>
                            </Panel>
                        </div>
                        <div className={s.attentionGrid}>
                            <Panel
                                title="Sem compra há X dias"
                                action={
                                    <select aria-label="Dias sem compra" value={filters.diasSem || '30'} onChange={(e) => setFilters((f) => ({ ...f, diasSem: e.target.value }))}>
                                        {[30, 60, 90, 120].map((v) => (
                                            <option key={v} value={v}>
                                                {v}+ dias
                                            </option>
                                        ))}
                                    </select>
                                }
                            >
                                <strong className={s.bigNumber}>{numero(data.semCompra)}</strong>
                                <p className={s.note}>
                                    Até {dataBR(data.periodo.fim)}. {numero(data.semHistorico)} clientes sem histórico ficam separados.
                                </p>
                                <button className={s.link} onClick={() => setGroup('sem-compra')}>
                                    Ver clientes
                                </button>
                            </Panel>
                            <Panel title="Compraram antes, não agora">
                                <strong className={s.bigNumber}>{numero(data.antesSemAgora)}</strong>
                                <p className={s.note}>Comparação com o período anterior equivalente. Não significa cliente perdido.</p>
                                <button className={s.link} onClick={() => setGroup('antes')}>
                                    Ver clientes
                                </button>
                            </Panel>
                            <Panel title="Compras identificadas">
                                <p className={s.note}>Recência: última compra registrada. Frequência e valor: janela selecionada. Sem scores ou estimativas de recorrência.</p>
                                <p className={s.note}>
                                    {numero(data.resumo.sem_cliente)} vendas sem cliente · {numero(data.resumo.vinculo_invalido)} com vínculo indisponível.
                                </p>
                                <button className={s.link} onClick={() => setGroup('')}>
                                    Explorar RFM simples
                                </button>
                            </Panel>
                        </div>
                        <div className={s.twoGrid}>
                            <Panel title="Ranking de clientes" note="Valor comprado no período">
                                <Bars rows={data.rankingClientes.map((c) => ({ label: `${c.nome} · ${numero(c.compras)} compras`, value: Number(c.valor || 0), text: moeda(c.valor) }))} />
                            </Panel>
                            <Panel title="Produtos em destaque" note="Participação no total de vendas registradas do recorte">
                                <Bars rows={data.rankingProdutos.map((p) => ({ label: p.nome, value: Number(p.valor || 0), text: moeda(p.valor) }))} />
                                {data.rankingProdutos.map((p) => (
                                    <p className={s.note} key={p.chave}>
                                        {p.nome}: {p.valor != null && Number(data.resumo.total) > 0 ? `${numero((Number(p.valor) / Number(data.resumo.total)) * 100)}%` : 'participação indisponível'}
                                    </p>
                                ))}
                                <p className={s.note}>Serviços, entrega e itens não elegíveis podem impedir a soma de 100%.</p>
                            </Panel>
                        </div>
                        <CustomerTable key={`c:${JSON.stringify(filters)}:${group}`} filters={filters} group={group} onGroup={setGroup} />
                        <ProductTable key={`p:${JSON.stringify(filters)}`} view="comercial" filters={filters} onSelect={setSelected} />
                        {selected && (
                            <Panel title={`Evolução · ${selected.nome}`} note={`Quantidades em ${selected.unidade}. Valor dos itens, após desconto.`} action={<button onClick={() => setSelected(null)}>Fechar</button>}>
                                {serie.error ? (
                                    <Failure error={serie.error} retry={serie.retry} />
                                ) : serie.loading ? (
                                    <Loading />
                                ) : serie.data?.serie.length ? (
                                    <Evolution points={serie.data.serie} quantityLabel={selected.unidade} />
                                ) : (
                                    <Empty text="Nenhuma venda desse produto no período." />
                                )}
                            </Panel>
                        )}
                    </>
                )
            )}
        </main>
    );
}

