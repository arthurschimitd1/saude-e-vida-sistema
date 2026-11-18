'use client';
import { useState, useEffect, ReactNode } from 'react';
import { moeda, numero, dataBR } from '../components/DetalhesDialog';
import { useAnalise, Options, View, Filters } from './analises';
import s from './Analises.module.scss';
export { moeda, numero, dataBR };
export const statusLabel: Record<string, string> = { normal: 'Normal', baixo: 'Abaixo do mínimo', zero: 'Sem estoque', infinito: 'Estoque infinito', indisponivel: 'Indisponível' };
export function Metric({ label, value, note, icon = 'pi-chart-bar' }: { label: string; value: ReactNode; note: string; icon?: string }) {
    return (
        <article className={s.metric}>
            <span>
                {label}
                <i className={`pi ${icon}`} aria-hidden="true" />
            </span>
            <strong>{value}</strong>
            <small>{note}</small>
        </article>
    );
}
export function Panel({ title, note, children, action }: { title: string; note?: string; children: ReactNode; action?: ReactNode }) {
    return (
        <section className={s.panel}>
            <header>
                <div>
                    <h2>{title}</h2>
                    {note && <p>{note}</p>}
                </div>
                {action}
            </header>
            {children}
        </section>
    );
}
export function Empty({ text = 'Nenhum registro neste recorte.' }: { text?: string }) {
    return (
        <p className={s.empty}>
            <i className="pi pi-inbox" aria-hidden="true" />
            {text}
        </p>
    );
}
export function Loading() {
    return (
        <div className={s.loading} aria-busy="true" aria-label="Carregando indicadores">
            <div />
            <div />
            <div />
        </div>
    );
}
export function Failure({ error, retry, stale = false }: { error: string; retry: () => void; stale?: boolean }) {
    return (
        <div role="alert" className={s.error}>
            <span>
                {error}
                {stale && ' Exibindo a última consulta bem-sucedida.'}
            </span>
            <button onClick={retry}>Tentar novamente</button>
        </div>
    );
}
export function Pagination({ total, page, onPage, size = 10 }: { total: number; page: number; onPage: (p: number) => void; size?: number }) {
    return (
        <div className={s.pagination}>
            <span>
                {numero(total)} registros · Página {page} de {Math.max(1, Math.ceil(total / size))}
            </span>
            <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
                Anterior
            </button>
            <button disabled={page * size >= total} onClick={() => onPage(page + 1)}>
                Próxima
            </button>
        </div>
    );
}
export function FilterBar({ view, value, onApply, onRefresh, refreshing }: { view: View; value: Filters; onApply: (f: Filters) => void; onRefresh: () => void; refreshing: boolean }) {
    const [draft, setDraft] = useState(value),
        [search, setSearch] = useState(''),
        [query, setQuery] = useState(''),
        [error, setError] = useState('');
    useEffect(() => {
        const id = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(id);
    }, [search]);
    const options = useAnalise<Options>(view, 'opcoes', { busca: query });
    const update = (key: keyof Filters, v: string) => setDraft((d) => ({ ...d, [key]: v }));
    return (
        <form
            className={s.filters}
            aria-label={`Filtros de ${view}`}
            onSubmit={(e) => {
                e.preventDefault();
                if (draft.periodo === 'personalizado' && (!draft.inicio || !draft.fim || draft.inicio > draft.fim)) {
                    setError('Informe datas válidas.');
                    return;
                }
                setError('');
                onApply({ ...draft });
            }}
        >
            <label>
                Período {view === 'estoque' ? 'das vendas' : ''}
                <select value={draft.periodo} onChange={(e) => update('periodo', e.target.value)}>
                    {[
                        ['hoje', 'Hoje'],
                        ['mes', 'Este mês'],
                        ['mes-anterior', 'Mês anterior'],
                        ['30-dias', 'Últimos 30 dias'],
                        ['60-dias', 'Últimos 60 dias'],
                        ['90-dias', 'Últimos 90 dias'],
                        ['ano', 'Este ano'],
                        ['personalizado', 'Personalizado']
                    ].map(([v, l]) => (
                        <option key={v} value={v}>
                            {l}
                        </option>
                    ))}
                </select>
            </label>
            {draft.periodo === 'personalizado' && (
                <>
                    <label>
                        Início
                        <input type="date" value={draft.inicio || ''} required onChange={(e) => update('inicio', e.target.value)} />
                    </label>
                    <label>
                        Fim
                        <input type="date" value={draft.fim || ''} required onChange={(e) => update('fim', e.target.value)} />
                    </label>
                </>
            )}
            <label>
                Buscar opções
                <input type="search" value={search} placeholder="Nome ou código…" onChange={(e) => setSearch(e.target.value)} />
            </label>
            {view === 'comercial' && (
                <label>
                    Cliente
                    <select value={draft.cliente || ''} onChange={(e) => update('cliente', e.target.value)}>
                        <option value="">Todos, incluindo não identificados</option>
                        {draft.cliente && !options.data?.clientes.some((c) => String(c.id) === draft.cliente) && <option value={draft.cliente}>Cliente selecionado #{draft.cliente}</option>}
                        {options.data?.clientes.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.nome}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <label>
                Produto
                <select value={draft.produto || ''} onChange={(e) => update('produto', e.target.value)}>
                    <option value="">Todos os produtos</option>
                    {draft.produto && !options.data?.produtos.some((p) => p.chave === draft.produto) && <option value={draft.produto}>Produto selecionado ({draft.produto})</option>}
                    {options.data?.produtos.map((p) => (
                        <option key={p.chave} value={p.chave}>
                            {p.nome} · {p.unidade}
                        </option>
                    ))}
                </select>
            </label>
            {view === 'estoque' && (
                <>
                    <label>
                        Família
                        <select value={draft.familia || ''} onChange={(e) => update('familia', e.target.value)}>
                            <option value="">Todas</option>
                            {['Produtos', 'Matérias-primas', 'Variações de roupas'].map((v) => (
                                <option key={v}>{v}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Unidade
                        <select value={draft.unidade || ''} onChange={(e) => update('unidade', e.target.value)}>
                            <option value="">Todas, separadamente</option>
                            {options.data?.unidades.map((v) => (
                                <option key={v}>{v}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Status
                        <select value={draft.status || ''} onChange={(e) => update('status', e.target.value)}>
                            <option value="">Todos</option>
                            {Object.entries(statusLabel).map(([v, l]) => (
                                <option key={v} value={v}>
                                    {l}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Código / nome
                        <input value={draft.busca || ''} onChange={(e) => update('busca', e.target.value)} placeholder="Filtrar resultados" />
                    </label>
                </>
            )}
            <button className={s.primary} type="submit">
                Aplicar
            </button>
            <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Atualizar indicadores">
                <i className={`pi pi-refresh ${refreshing ? 'pi-spin' : ''}`} />
            </button>
            {options.error && (
                <span role="status">
                    Não foi possível carregar opções.{' '}
                    <button type="button" onClick={options.retry}>
                        Repetir
                    </button>
                </span>
            )}
            {error && <span role="alert">{error}</span>}
        </form>
    );
}
export function Bars({ rows }: { rows: { label: string; value: number; text: string }[] }) {
    const max = Math.max(0, ...rows.map((r) => r.value));
    return rows.length ? (
        <ol className={s.bars}>
            {rows.map((r, i) => (
                <li key={`${r.label}-${i}`}>
                    <div>
                        <span>{r.label}</span>
                        <b>{r.text}</b>
                    </div>
                    <div className={s.track}>
                        <span style={{ width: `${max > 0 ? (r.value / max) * 100 : 0}%` }} />
                    </div>
                </li>
            ))}
        </ol>
    ) : (
        <Empty />
    );
}

