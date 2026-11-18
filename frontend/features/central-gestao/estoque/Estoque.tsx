'use client';
import { useState } from 'react';
import { useAnalise, refreshAnalises, Access, Stock, Filters } from '../shared/analises';
import { FilterBar, Metric, Panel, Failure, Loading, Bars, numero, statusLabel, Empty } from '../shared/Widgets';
import { ProductTable, BestProducts } from '../shared/DetailTables';
import s from '../shared/Analises.module.scss';

export default function Estoque() {
    const access = useAnalise<Access>('acesso');
    if (access.loading) return <Loading />;
    if (!access.data?.estoque)
        return (
            <main className={s.dashboard}>
                <h1>Estoque</h1>
                <Failure error={access.error || 'Sem permissão para esta visão da Central de Gestão.'} retry={access.retry} />
            </main>
        );
    return <StockContent key={access.session} empresa={access.data.empresaId} />;
}
function StockContent({ empresa }: { empresa: number }) {
    const [filters, setFilters] = useState<Filters>({ periodo: '30-dias' });
    const result = useAnalise<Stock>('estoque', 'resumo', filters),
        data = result.data;
    const quantity = data?.grupos.length
        ? data.grupos.map((g) => (
              <span key={`${g.familia}:${g.unidade}`} className={s.quantityLine}>
                  {numero(g.quantidade)}{' '}
                  <small>
                      {g.unidade} · {g.familia}
                  </small>
              </span>
          ))
        : '0 SKUs';
    return (
        <main className={s.dashboard}>
            <header className={s.heading}>
                <div>
                    <span>CENTRAL DE GESTÃO</span>
                    <h1>Estoque</h1>
                    <p>Posição atual do estoque e desempenho observado nas vendas.</p>
                </div>
                <span className={s.company}>Empresa #{empresa}</span>
            </header>
            <FilterBar view="estoque" value={filters} onApply={setFilters} onRefresh={() => refreshAnalises('estoque')} refreshing={result.refreshing} />
            <p className={s.note}>O período filtra a atividade de vendas. Quantidades, mínimos e status representam a posição atual do estoque. Necessidade é apenas a quantidade para atingir o mínimo, não uma sugestão de compra.</p>
            {result.error && <Failure error={result.error} retry={result.retry} stale={!!data} />}
            {result.loading ? (
                <Loading />
            ) : (
                data && (
                    <>
                        <div className={s.period}>
                            <span>POSIÇÃO ATUAL DO ESTOQUE</span>
                            <span>{result.refreshing ? 'Atualizando…' : `Atualizado às ${new Date(data.atualizadoEm).toLocaleTimeString('pt-BR')}`}</span>
                        </div>
                        <div className={s.metrics}>
                            <Metric label="Produtos / SKUs" value={numero(data.skus)} note="Catálogo elegível monitorado" icon="pi-box" />
                            <Metric label="Quantidade atual" value={<span className={s.quantityList}>{quantity}</span>} note="Separada por família e unidade" icon="pi-list" />
                            <Metric label="Estoque baixo" value={numero(data.baixo)} note="Saldo positivo abaixo do mínimo" icon="pi-exclamation-circle" />
                            <Metric label="Sem estoque" value={numero(data.zero)} note="Saldo zero ou negativo" icon="pi-ban" />
                            <Metric label="Estoque infinito" value={numero(data.infinito)} note="Fora das somas de quantidade" icon="pi-sync" />
                            <Metric label="Necessidade de reposição" value={`${numero(data.reposicao)} SKUs`} note="Com falta para atingir o mínimo" icon="pi-arrow-up" />
                        </div>
                        <div className={s.threeGrid}>
                            <Panel title="Distribuição do estoque" note="Contagem de SKUs por status objetivo">
                                {data.skus ? (
                                    <>
                                        <div className={s.segment} aria-label="Distribuição por status">
                                            {(['normal', 'baixo', 'zero', 'infinito', 'indisponivel'] as const).map((k) => (
                                                <span key={k} data-status={k} title={`${statusLabel[k]}: ${data[k]}`} style={{ width: `${(data[k] / data.skus) * 100}%` }} />
                                            ))}
                                        </div>
                                        <ul className={s.legend}>
                                            {(['normal', 'baixo', 'zero', 'infinito', 'indisponivel'] as const).map((k) => (
                                                <li key={k}>
                                                    <span className={s.dot} data-status={k} />
                                                    <span>{statusLabel[k]}</span>
                                                    <b>{numero(data[k])}</b>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                ) : (
                                    <Empty text="Nenhum SKU neste recorte." />
                                )}
                            </Panel>
                            <Panel title="Distribuição por família" note="Famílias técnicas; quantidades não são misturadas">
                                <Bars rows={data.familias.map((g) => ({ label: g.familia, value: g.skus, text: `${numero(g.skus)} SKUs` }))} />
                            </Panel>
                            <Panel title="Insights do estoque">
                                <ul className={s.insights}>
                                    <li>
                                        <i className="pi pi-exclamation-circle" />
                                        {numero(data.baixo)} SKUs abaixo do mínimo.
                                    </li>
                                    <li>
                                        <i className="pi pi-minus-circle" />
                                        {numero(data.zero)} SKUs sem estoque.
                                    </li>
                                    <li>
                                        <i className="pi pi-calendar" />
                                        {numero(data.semVenda)} produtos sem venda no período.
                                    </li>
                                    <li>
                                        <i className="pi pi-plus-circle" />
                                        {numero(data.novos)} cadastros no período selecionado.
                                    </li>
                                    <li>
                                        <i className="pi pi-check-circle" />
                                        {numero(data.normal)} SKUs em condição normal.
                                    </li>
                                    {data.indisponivel > 0 && <li>{numero(data.indisponivel)} SKUs com dados indisponíveis.</li>}
                                </ul>
                            </Panel>
                        </div>
                        <Panel title="Quantidades e necessidade por unidade" note="Posição atual · estoque infinito excluído">
                            <div className={s.unitGrid}>
                                {data.grupos.map((g) => (
                                    <article key={`${g.familia}:${g.unidade}`}>
                                        <span>
                                            {g.familia} · {g.unidade}
                                        </span>
                                        <strong>
                                            {numero(g.quantidade)} <small>{g.unidade}</small>
                                        </strong>
                                        <p>
                                            {numero(g.skus)} SKUs · Falta para o mínimo:{' '}
                                            <b>
                                                {numero(g.necessidade)} {g.unidade}
                                            </b>
                                        </p>
                                    </article>
                                ))}
                            </div>
                            {!data.grupos.length && <Empty text="Não há produtos nessa condição." />}
                        </Panel>
                        <BestProducts key={`best:${JSON.stringify(filters)}`} filters={filters} />
                        <ProductTable key={`${JSON.stringify(filters)}`} view="estoque" filters={filters} />
                    </>
                )
            )}
        </main>
    );
}

