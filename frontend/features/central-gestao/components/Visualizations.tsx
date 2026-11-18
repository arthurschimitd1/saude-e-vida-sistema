'use client';
import type { Linha, Visao } from '../types';
import { moeda, numero } from './DetalhesDialog';
import styles from '../CentralGestao.module.scss';

export function Info({ text }: { text: string }) {
  return <span className={styles.info} tabIndex={0} role="note" aria-label={text}>i<span role="tooltip">{text}</span></span>;
}
export function Empty({ text = 'Sem registros no período.' }: { text?: string }) {
  return <p className={styles.empty}><i className="pi pi-inbox" aria-hidden="true" />{text}</p>;
}
const numeric = (value: unknown) => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const percent = (value: number) => `${Math.max(0, Math.min(100, value))}%`;

export function VisualRanking({ rows, quantity = false, sales = false }: { rows: Linha[]; quantity?: boolean; sales?: boolean }) {
  if (!rows.length) return <Empty />;
  // Escala visual relativa ao maior item, sempre dentro da mesma unidade.
  const maxima = new Map<string, number>();
  for (const row of rows) {
    const group = quantity ? row.unidade ?? '' : '';
    maxima.set(group, Math.max(maxima.get(group) ?? 0, numeric(quantity ? row.quantidade : row.valor) ?? 0));
  }
  return <ol className={styles.ranking}>{rows.map((row, index) => {
    const value = numeric(quantity ? row.quantidade : row.valor);
    const maximum = maxima.get(quantity ? row.unidade ?? '' : '') ?? 0;
    return <li key={row.chave ?? row.id ?? `${row.nome}-${index}`}>
      <span className={styles.rank}>{row.posicao ?? index + 1}</span>
      <div className={styles.rankBody}>
        <div className={styles.rankTop}><strong>{row.nome}</strong><b>{quantity ? numero(row.quantidade) : moeda(row.valor)}</b></div>
        <div className={styles.track} aria-hidden="true"><span style={{ width: percent(value !== null && maximum > 0 ? value / maximum * 100 : 0) }} /></div>
        <small>{row.unidade ? `Unidade: ${row.unidade}` : row.classificacao ?? (row.quantidade != null ? `${numero(row.quantidade)} ${sales ? 'vendas' : 'registros'}` : '')}{row.percentual != null ? ` · ${numero(row.percentual)}% do total` : ''}{row.status ? ` · ${row.status}` : ''}{value === 0 ? ' · Zero registrado' : ''}</small>
      </div>
    </li>;
  })}</ol>;
}

export function ReceivableBars({ data }: { data: Visao['recebiveis'] }) {
  if (data.invalidos > 0) return <Empty text="Valores indisponíveis: existem títulos com dados inconsistentes." />;
  return <div className={styles.aging}>{data.aging.map(row => <div key={row.faixa} className={row.faixa === 'Vencidos' ? styles.overdueBar : undefined}>
    <div className={styles.barLabel}><span>{row.faixa}</span><b>{moeda(row.valor)}</b></div>
    <div className={styles.agingLine}><div className={styles.track} title={`${row.faixa}: ${moeda(row.valor)} · ${numero(row.quantidade)} títulos`}><span style={{ width: percent(Number(row.percentual ?? 0)) }} /></div><small>{row.percentual == null ? '—' : `${numero(row.percentual)}%`}</small></div>
  </div>)}</div>;
}

const COLORS = ['#16847b', '#528daf', '#7eb3a1', '#97a6bd', '#bd9e6d', '#a0bcb7', '#547b82', '#7188a4', '#c2cfcc', '#8f9f83', '#699bb1', '#b7afa4'];
export function OutgoingComposition({ data }: { data: Visao['saidas'] }) {
  if (data.invalidos > 0 || data.total == null) return <Empty text="Composição indisponível: há valores inconsistentes." />;
  if (data.quantidade === 0) return <Empty text="Não há saídas registradas no período." />;
  let offset = 0;
  const segments = data.composicao.map((row, index) => {
    const length = Math.min(Math.max(Number(row.percentual ?? 0), 0), 100 - offset);
    const segment = { row, length, offset, color: COLORS[index % COLORS.length] }; offset += length; return segment;
  });
  return <div className={styles.composition}>
    {Number(data.total) > 0 && <div className={styles.donut}>
      <svg viewBox="0 0 120 120" role="img" aria-label="Composição das saídas registradas por classificação. Valores e percentuais na legenda.">
        <circle cx="60" cy="60" r="49" fill="none" stroke="#edf2f1" strokeWidth="12" />
        {segments.map(({ row, length, offset: start, color }) => <circle key={row.nome} cx="60" cy="60" r="49" fill="none" stroke={color} strokeWidth="12" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} transform="rotate(-90 60 60)"><title>{row.nome}: {moeda(row.valor)} · {numero(row.percentual)}%</title></circle>)}
      </svg><div><strong>{moeda(data.total)}</strong><span>Total de saídas</span></div>
    </div>}
    <ul className={styles.legend}>{segments.map(({ row, color }) => <li key={row.nome} tabIndex={0} title={`${row.nome}: ${moeda(row.valor)} · ${row.percentual == null ? 'Percentual não aplicável' : `${numero(row.percentual)}%`}`}>
      <i style={{ background: color }} aria-hidden="true" /><span>{row.nome}</span><b>{moeda(row.valor)}<small>{row.percentual == null ? '—' : `${numero(row.percentual)}%`}</small></b>
    </li>)}</ul>
    {data.categoriasOmitidas > 0 && <p className={styles.note}>12 maiores classificações exibidas. A faixa neutra corresponde às classificações não exibidas; consulte os registros.</p>}
  </div>;
}

export function StockSummary({ data }: { data: Visao['estoque'] }) {
  const segments = [{ name: 'Estoque baixo', value: data.baixos, color: '#c19348' }, { name: 'Sem estoque', value: data.zerados, color: '#c96c69' }, { name: 'Estoque infinito', value: data.infinitos, color: '#648fab' }];
  return <>
    <div className={styles.stockTotal}><strong>{numero(data.skus)}</strong><span>produtos / SKUs monitorados</span></div>
    {data.skus > 0 && <div className={styles.segmented} role="img" aria-label="Distribuição dos status cadastrados. A faixa neutra representa demais SKUs, sem afirmar estoque normal.">{segments.map(row => <span key={row.name} title={`${row.name}: ${numero(row.value)} SKUs`} style={{ width: percent(row.value / data.skus * 100), background: row.color }} />)}</div>}
    <dl className={styles.stockLegend}>{segments.map(row => <div key={row.name}><dt><i style={{ background: row.color }} />{row.name}</dt><dd>{numero(row.value)}</dd></div>)}</dl>
    <p className={styles.note}>Faixa neutra: demais SKUs. <Info text="A API não informa um total de estoque normal. A faixa neutra não classifica registros como normais. Estoque infinito não é somado às quantidades nem aos alertas." /></p>
    {data.invalidos > 0 && <p className={styles.warning}>{numero(data.invalidos)} registro(s) com quantidade ou mínimo indisponível.</p>}
    <details className={styles.disclosure}><summary>Por família e unidade</summary>
      {!data.grupos.length ? <Empty text="Nenhum produto com contexto empresarial válido." /> : <div className={styles.tableWrap}><table><thead><tr><th>Família</th><th>Unidade</th><th>SKUs</th><th>Quantidade controlada</th><th>Baixo</th><th>Sem estoque</th></tr></thead><tbody>{data.grupos.map(row => <tr key={`${row.familia}-${row.unidade}`}><td>{row.familia}</td><td>{row.unidade}</td><td>{numero(row.skus)}</td><td>{numero(row.quantidade)}</td><td>{numero(row.baixos)}</td><td>{numero(row.zerados)}</td></tr>)}</tbody></table></div>}
      <p className={styles.note}>Matérias-primas vinculadas não são somadas duas vezes. Unidades diferentes permanecem separadas.</p>
    </details>
  </>;
}

