'use client';
import { useState } from 'react';
import { useAnalise, Filters, View, Customer, Product, Page } from './analises';
import { Panel, Empty, Failure, Loading, Pagination, moeda, numero, dataBR, statusLabel, Bars } from './Widgets';
import s from './Analises.module.scss';

export function BestProducts({ filters }: { filters: Filters }) {
    const [order, setOrder] = useState('valor');
    const result = useAnalise<Page<Product>>('estoque', 'produtos', { ...filters, grupo: 'vendidos', ordem: order });
    const rows = result.data?.itens || [];
    const units = Array.from(new Set(rows.map((p) => p.unidade)));
    return (
        <Panel
            title="Produtos mais vendidos"
            note="Período selecionado nos filtros. Quantidades comparadas somente dentro da mesma unidade."
            action={
                <div className={s.tabs}>
                    <button aria-pressed={order === 'valor'} onClick={() => setOrder('valor')}>
                        Por valor
                    </button>
                    <button aria-pressed={order === 'quantidade'} onClick={() => setOrder('quantidade')}>
                        Por quantidade
                    </button>
                </div>
            }
        >
            {result.error && <Failure error={result.error} retry={result.retry} stale={!!result.data} />}
            {result.loading ? (
                <Loading />
            ) : rows.length ? (
                order === 'valor' ? (
                    <Bars rows={rows.slice(0, 5).map((p, i) => ({ label: `${i + 1}. ${p.nome} · ${numero(p.vendido)} ${p.unidade}`, value: Number(p.valor || 0), text: moeda(p.valor) }))} />
                ) : (
                    <div className={s.unitGrid}>
                        {units.map((unit) => (
                            <div key={unit}>
                                <strong>{unit}</strong>
                                <Bars rows={rows.filter((p) => p.unidade === unit).map((p, i) => ({ label: `${i + 1}. ${p.nome}`, value: Number(p.vendido || 0), text: `${numero(p.vendido)} ${unit}` }))} />
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <Empty text="Nenhuma venda de produto elegível no período." />
            )}
            {result.data && result.data.total > 10 && order === 'quantidade' && <p className={s.note}>Primeiros 10 resultados agrupados por unidade. Use o filtro de unidade para consultar cada ranking ou a tabela paginada abaixo.</p>}
        </Panel>
    );
}

export function CustomerTable({ filters, group, onGroup }: { filters: Filters; group: string; onGroup: (v: string) => void }) {
    const [page, setPage] = useState(1);
    const result = useAnalise<Page<Customer>>('comercial', 'clientes', { ...filters, grupo: group, pagina: page });
    return (
        <Panel title="Clientes · RFM simples" note="Frequência e valor no período. Recência até o fim do período, usando somente compras registradas.">
            <div className={s.tabs} role="group" aria-label="Recorte de clientes">
                {[
                    ['', 'Todos os clientes'],
                    ['antes', 'Compraram antes, não agora'],
                    ['sem-compra', `Sem compra há ${filters.diasSem || 30}+ dias`]
                ].map(([v, l]) => (
                    <button
                        key={v}
                        aria-pressed={group === v}
                        onClick={() => {
                            setPage(1);
                            onGroup(v);
                        }}
                    >
                        {l}
                    </button>
                ))}
            </div>
            {result.error && <Failure error={result.error} retry={result.retry} stale={!!result.data} />}
            {result.loading ? (
                <Loading />
            ) : (
                result.data && (
                    <>
                        {result.data.itens.length ? (
                            <div className={s.tableWrap} tabIndex={0} aria-label="Tabela de clientes">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Cliente</th>
                                            <th>Compras</th>
                                            <th>Valor comprado</th>
                                            <th>Ticket médio</th>
                                            <th>Última compra</th>
                                            <th>Dias sem compra</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.data.itens.map((c) => (
                                            <tr key={c.id}>
                                                <td>{c.nome}</td>
                                                <td>{numero(c.compras)}</td>
                                                <td>{moeda(c.valor)}</td>
                                                <td>{moeda(c.ticket)}</td>
                                                <td>{c.ultima ? dataBR(c.ultima) : 'Sem compra registrada'}</td>
                                                <td>{c.dias_sem == null ? 'Não aplicável' : numero(c.dias_sem)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <Empty text="Nenhum cliente neste recorte." />
                        )}
                        <Pagination total={result.data.total} page={page} onPage={setPage} />
                    </>
                )
            )}
        </Panel>
    );
}

export function ProductTable({ view, filters, onSelect }: { view: View; filters: Filters; onSelect?: (p: Product) => void }) {
    const [page, setPage] = useState(1),
        [group, setGroup] = useState(''),
        [order, setOrder] = useState('valor');
    const result = useAnalise<Page<Product>>(view, 'produtos', { ...filters, grupo: group, ordem: group === 'baixa' ? 'menor' : order, pagina: page });
    const stock = view === 'estoque';
    return (
        <Panel
            title={stock ? 'Produtos em atenção e desempenho' : 'Desempenho detalhado de produtos'}
            note={stock ? 'Saldos e mínimos: posição atual. Vendas: período selecionado.' : 'Valor dos itens após o desconto rateado, sem entrega. Selecione um produto para ver a evolução.'}
        >
            <div className={s.tableControls}>
                <div className={s.tabs} role="group" aria-label="Recorte de produtos">
                    {[
                        ['', 'Todos'],
                        ['sem-venda', 'Sem venda no período'],
                        ...(stock
                            ? [
                                  ['atencao', 'Abaixo do mínimo / sem estoque'],
                                  ['baixa', 'Baixa rotação observada']
                              ]
                            : [])
                    ].map(([v, l]) => (
                        <button
                            key={v}
                            aria-pressed={group === v}
                            onClick={() => {
                                setGroup(v);
                                setPage(1);
                            }}
                        >
                            {l}
                        </button>
                    ))}
                </div>
                <label>
                    Ordenação
                    <select
                        value={order}
                        disabled={group === 'baixa'}
                        onChange={(e) => {
                            setOrder(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="valor">Por valor vendido</option>
                        <option value="quantidade">Por quantidade · agrupada por unidade</option>
                        <option value="menor">Menor quantidade · por unidade</option>
                    </select>
                </label>
            </div>
            {result.error && <Failure error={result.error} retry={result.retry} stale={!!result.data} />}
            {result.loading ? (
                <Loading />
            ) : (
                result.data && (
                    <>
                        {result.data.itens.length ? (
                            <div className={s.tableWrap} tabIndex={0} aria-label="Tabela de produtos">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Produto / unidade</th>
                                            {stock && (
                                                <>
                                                    <th>Estoque atual</th>
                                                    <th>Mínimo</th>
                                                    <th>Necessidade</th>
                                                    <th>Status</th>
                                                </>
                                            )}
                                            <th>Qtd. vendida</th>
                                            <th>Valor vendido</th>
                                            <th>Última venda</th>
                                            <th>Dias sem venda</th>
                                            <th>Cadastro</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.data.itens.map((p, i) => (
                                            <tr key={p.chave}>
                                                <td>
                                                    <span className={s.rowLabel}>
                                                        {onSelect ? (
                                                            <button className={s.link} onClick={() => onSelect(p)}>
                                                                {p.nome}
                                                            </button>
                                                        ) : (
                                                            p.nome
                                                        )}
                                                    </span>
                                                    <small>
                                                        {order === 'valor' && group !== 'baixa' ? `${(page - 1) * 10 + i + 1}. ` : ''}
                                                        {p.codigo ? `${p.codigo} · ` : ''}
                                                        {p.unidade} · {p.familia}
                                                    </small>
                                                </td>
                                                {stock && (
                                                    <>
                                                        <td>{p.infinito ? 'Não controlado' : numero(p.quantidade)}</td>
                                                        <td>{p.infinito ? 'Não aplicável' : numero(p.minimo)}</td>
                                                        <td>{p.infinito ? 'Não aplicável' : numero(p.necessidade)}</td>
                                                        <td>
                                                            <span className={s.badge} data-status={p.status}>
                                                                {statusLabel[p.status]}
                                                            </span>
                                                        </td>
                                                    </>
                                                )}
                                                <td>
                                                    {numero(p.vendido)} {p.unidade}
                                                </td>
                                                <td>{moeda(p.valor)}</td>
                                                <td>{p.ultima ? dataBR(p.ultima) : 'Nunca vendido no histórico registrado'}</td>
                                                <td>{p.dias_sem == null ? 'Não aplicável' : numero(p.dias_sem)}</td>
                                                <td>
                                                    {numero(p.idade)} dias{p.novo_no_periodo && <small>Cadastro recente em relação ao período</small>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <Empty text="Não há produtos nessa condição." />
                        )}
                        <Pagination total={result.data.total} page={page} onPage={setPage} />
                    </>
                )
            )}
            {group === 'baixa' && <p className={s.note}>Ordenação pela menor quantidade vendida dentro de cada unidade, apenas com saldo positivo finito. Não representa giro. “Nunca vendido” é distinguido da última venda conhecida.</p>}
        </Panel>
    );
}

