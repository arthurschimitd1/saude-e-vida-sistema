'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useContextoCentral, useVisaoCentral } from '../useCentralGestao';
import type { Filtros, TipoDetalhe } from '../types';
import DetalhesDialog, { moeda, numero, dataBR } from './DetalhesDialog';
import { Empty, Info, OutgoingComposition, ReceivableBars, StockSummary, VisualRanking } from './Visualizations';
import styles from '../CentralGestao.module.scss';

const VendasChart = dynamic(() => import('./VendasChart'), { ssr: false, loading: () => <div className={styles.skeleton} aria-label="Carregando gráfico" /> });
const periodos = [['hoje','Hoje'],['ontem','Ontem'],['semana','Esta semana'],['mes','Este mês'],['mes-anterior','Mês anterior'],['30-dias','Últimos 30 dias'],['ano','Este ano'],['personalizado','Personalizado']];
const initial: Filtros = { periodo: 'mes', carteira: 'periodo' };
function Card({ label, value, note, icon, tone = 'teal' }: { label: string; value: string; note: string; icon: string; tone?: string }) {
  return <article className={styles.metric} data-tone={tone}><div className={styles.metricLabel}><span>{label}</span><i className={`pi ${icon}`} aria-hidden="true" /></div><strong>{value}</strong><span>{note}</span></article>;
}
function SmallCard({ label, value, note, risk = false }: { label: string; value: string; note: string; risk?: boolean }) {
  return <article className={styles.operationalCard} data-risk={risk}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
function Panel({ title, info, subtitle, children, action, className = '' }: { title: string; info?: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return <section className={`${styles.panel} ${className}`}><div className={styles.panelHeader}><div><h2>{title}{info && <Info text={info} />}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}

export default function VisaoGeral() {
  const access = useContextoCentral();
  const [draft, setDraft] = useState<Filtros>(initial); const [filters, setFilters] = useState<Filtros>(initial);
  const [filterError, setFilterError] = useState(''); const [tipo, setTipo] = useState<TipoDetalhe | null>(null);
  const [productView, setProductView] = useState<'valor' | 'quantidade' | 'menos'>('valor');
  const { dados, error, loading, refreshing, retry } = useVisaoCentral(access.contexto, filters, access.key);
  const details = (key: TipoDetalhe) => <button className={styles.textButton} onClick={() => setTipo(key)} aria-label={`Ver registros de ${key}`}>Detalhes <i className="pi pi-arrow-up-right" aria-hidden="true" /></button>;
  const aplicar = (event: React.FormEvent) => {
    event.preventDefault(); setFilterError('');
    if (draft.periodo === 'personalizado' && (!draft.inicio || !draft.fim || draft.inicio > draft.fim)) { setFilterError('Informe um início e um fim válidos.'); return; }
    setTipo(null); setFilters({ ...draft });
  };
  const variation = dados?.vendas.variacao;
  const variationText = variation == null ? 'Sem base percentual' : `${Number(variation) > 0 ? '+' : ''}${numero(variation)}%`;
  return <main className={styles.central}>
    <header className={styles.header}><div><span className={styles.eyebrow}>VISÃO GERAL</span><h1>Central de Gestão</h1><p>Visão completa e estratégica da sua operação</p></div>{access.contexto && <span className={styles.company}><i className="pi pi-building" aria-hidden="true" /> Empresa #{access.contexto.empresaId}</span>}</header>
    {access.loading ? <Loading /> : !access.contexto ? <section className={styles.accessState} role="alert"><i className="pi pi-lock" aria-hidden="true" /><h2>Acesso à Central de Gestão</h2><p>{access.error}</p><p className={styles.note}>Se você é MASTER, selecione uma empresa no topo para consultar seus indicadores.</p><button onClick={access.retry}>Verificar novamente</button></section> : <>
      <form className={styles.filters} onSubmit={aplicar} aria-label="Filtros da Central de Gestão">
        <label>Período<select value={draft.periodo} onChange={e => setDraft(d => ({ ...d, periodo: e.target.value }))}>{periodos.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {draft.periodo === 'personalizado' && <><label>Início<input type="date" value={draft.inicio ?? ''} onChange={e => setDraft(d => ({ ...d, inicio: e.target.value }))} required /></label><label>Fim<input type="date" value={draft.fim ?? ''} onChange={e => setDraft(d => ({ ...d, fim: e.target.value }))} required /></label></>}
        <label>Recebíveis <Info text="Situação atual dos títulos, selecionados pelo vencimento. Não reconstrói a posição histórica." /><select value={draft.carteira} onChange={e => setDraft(d => ({ ...d, carteira: e.target.value as Filtros['carteira'] }))}><option value="periodo">Vencimentos no período</option><option value="completa">Carteira atual completa</option></select></label>
        <button className={styles.primaryButton} type="submit" disabled={loading}>Aplicar <i className="pi pi-arrow-right" aria-hidden="true" /></button>
        <button type="button" className={styles.refresh} onClick={retry} disabled={loading || refreshing} aria-label="Atualizar indicadores"><i className={`pi pi-refresh ${refreshing ? 'pi-spin' : ''}`} aria-hidden="true" /></button>
      </form>
      {filterError && <p role="alert" className={styles.warning}>{filterError}</p>}
      {error && <div className={styles.errorBanner} role="alert"><div><strong>{dados ? 'Não foi possível atualizar os indicadores' : 'Não foi possível carregar os indicadores'}</strong><p>{error}{dados && ' Os dados abaixo são da última consulta bem-sucedida.'}</p></div><button onClick={retry}>Tentar novamente</button></div>}
      {access.error && access.contexto && <p className={styles.warning} role="status">Não foi possível revalidar o acesso agora. {access.error}</p>}
      {loading ? <Loading /> : dados && <>
        <div className={styles.periodLine}><span><i className="pi pi-calendar" aria-hidden="true" /> {dataBR(dados.periodo.inicio)} — {dataBR(dados.periodo.fim)}</span><span>Anterior: {dataBR(dados.periodo.anteriorInicio)} — {dataBR(dados.periodo.anteriorFim)}</span><span role="status">{refreshing ? 'Atualizando…' : `Atualizado às ${new Date(dados.atualizadoEm).toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' })}`}</span></div>
        <div className={styles.metrics}>
          <Card label="Vendas registradas" value={moeda(dados.vendas.total)} note={`${variationText} · período anterior`} icon="pi-shopping-bag" />
          <Card label="Quantidade de vendas" value={numero(dados.vendas.quantidade)} note={`${numero(dados.vendas.quantidadeAnterior)} no período anterior`} icon="pi-shopping-cart" tone="blue" />
          <Card label="Ticket médio" value={moeda(dados.vendas.ticket)} note="Valor registrado por venda" icon="pi-ticket" tone="sage" />
          <Card label="Títulos em aberto" value={moeda(dados.recebiveis.total)} note={`${numero(dados.recebiveis.quantidade)} títulos · ${filters.carteira === 'completa' ? 'carteira completa' : 'vencimentos no período'}`} icon="pi-wallet" tone="slate" />
        </div>
        <div className={styles.operational}>
          <SmallCard label="Vencidos" value={moeda(dados.recebiveis.vencidos)} note={dados.recebiveis.invalidos ? 'Dados inconsistentes' : `${numero(dados.recebiveis.quantidadeVencidos)} títulos · ${dados.recebiveis.inadimplencia == null ? 'Taxa não aplicável' : `${numero(dados.recebiveis.inadimplencia)}% inadimplência`}`} risk={Number(dados.recebiveis.vencidos) > 0} />
          <SmallCard label="Vence hoje" value={moeda(dados.recebiveis.venceHoje)} note="Títulos do recorte" />
          <SmallCard label="A vencer" value={moeda(dados.recebiveis.aVencer)} note="Títulos do recorte" />
          <SmallCard label="Clientes com compras" value={numero(dados.clientes.comCompras)} note={`${numero(dados.clientes.novos)} novos cadastros`} />
          <SmallCard label="Estoque baixo" value={`${numero(dados.estoque.baixos)} SKUs`} note="Posição atual" />
          <SmallCard label="Sem estoque" value={`${numero(dados.estoque.zerados)} SKUs`} note="Posição atual" />
        </div>
        {dados.vendas.invalidos > 0 && <p className={styles.warning}>Total de vendas indisponível: há registros com valores inconsistentes.</p>}
        <div className={styles.mainGrid}>
          <Panel title="Ritmo de vendas" className={styles.salesPanel} info="Valores registrados por data da venda, incluindo ajustes. Não representam recebimentos bancários." action={details('vendas')}>
            <div className={styles.chartSummary}><div><small>Período atual</small><strong>{moeda(dados.vendas.total)}</strong></div><div><small>Período anterior</small><b>{moeda(dados.vendas.anterior)}</b></div><span className={styles.change} data-negative={Number(variation) < 0}>{variationText}</span></div>
            {dados.vendas.quantidade === 0 ? <Empty text="Sem vendas registradas no período." /> : <VendasChart serie={dados.vendas.serie} />}
            <p className={styles.chartFootnote}><span><i />Período atual</span><span>Comparação anterior disponível somente no total. <Info text="A API atual não fornece a série diária do período anterior. Nenhuma linha anterior é estimada." /></span></p>
          </Panel>
          <Panel title="Recebíveis por prazo" info="Aging e inadimplência mantêm as regras atuais. Inadimplência = saldo vencido / saldo aberto dos títulos selecionados." action={details('recebiveis')}>
            <div className={styles.receivableTotal}><strong>{moeda(dados.recebiveis.total)}</strong><span>{numero(dados.recebiveis.quantidade)} títulos em aberto</span></div>
            <ReceivableBars data={dados.recebiveis} />
            <p className={styles.note}>Situação atual · {filters.carteira === 'completa' ? 'carteira completa' : 'vencimentos no período'}. Sem somar cobranças recorrentes.</p>
          </Panel>
          <Panel title="Pontos de atenção" className={styles.alertPanel}>
            {!dados.alertas.length ? <p className={styles.positive}><i className="pi pi-check-circle" aria-hidden="true" />Nenhum alerta no recorte consultado.</p> : <div className={styles.alerts}>{dados.alertas.map(alert => <article key={alert.titulo} data-severity={alert.tipo}><i className={`pi ${alert.tipo === 'atencao' ? 'pi-exclamation-circle' : 'pi-info-circle'}`} aria-hidden="true" /><div><h3>{alert.titulo}</h3><p>{alert.texto}</p></div></article>)}</div>}
            <p className={styles.note}>Estoque: posição atual. Recebíveis: títulos selecionados.</p>
          </Panel>
        </div>
        <div className={styles.overviewGrid}>
          <Panel title="Saídas registradas" info="Lançamentos por data do registro. Podem incluir sangrias e retiradas; não equivalem a despesas apuradas." action={details('saidas')}>
            {(dados.saidas.quantidade === 0 || dados.saidas.total == null) && <div className={styles.sectionValue}>{moeda(dados.saidas.total)}</div>}
            <OutgoingComposition data={dados.saidas} />
            {dados.saidas.quantidade > 0 && <p className={styles.note}>{numero(dados.saidas.quantidade)} registros · {numero(dados.saidas.naoClassificados)} não classificados.</p>}
            {dados.saidas.maiores.length > 0 && <details className={styles.disclosure}><summary>Top 5 maiores saídas</summary><VisualRanking rows={dados.saidas.maiores} /></details>}
            {(dados.saidas.centros.length > 0 || dados.saidas.estados.length > 0) && <details className={styles.disclosure}><summary>Centros de custo e status</summary><h3 className={styles.subheading}>Por centro de custo</h3><VisualRanking rows={dados.saidas.centros} />{dados.saidas.centrosOmitidos > 0 && <p className={styles.note}>Exibidos os 12 maiores centros.</p>}<div className={styles.tags}>{dados.saidas.estados.map(row => <span key={row.nome}>{row.nome}: {moeda(row.valor)}</span>)}</div></details>}
          </Panel>
          <Panel title="Clientes" info="Clientes com compras identificadas na empresa. Vendas sem cliente e vínculos inconsistentes ficam separados.">
            <div className={styles.pairMetrics}><div><span>Com compras</span><strong>{numero(dados.clientes.comCompras)}</strong></div><div><span>Novos cadastros</span><strong>{numero(dados.clientes.novos)}</strong></div></div>
            <h3 className={styles.subheading}>Top clientes por vendas</h3><VisualRanking rows={dados.clientes.ranking} sales />
            <p className={styles.note}><strong>Sem cliente identificado:</strong> {numero(dados.clientes.semCliente)} vendas · {moeda(dados.clientes.valorSemCliente)}.{dados.clientes.vinculoInvalido > 0 && ` ${numero(dados.clientes.vinculoInvalido)} venda(s) com vínculo indisponível, fora do ranking.`}</p>
            <div className={styles.recorrencias}><i className="pi pi-sync" aria-hidden="true" /><span><strong>{numero(dados.clientes.novasRecorrencias)}</strong> novos cadastros de recorrência <Info text="Criados no período. Não representam receita recorrente, MRR ou novos clientes." /></span></div>
          </Panel>
          <Panel title="Produtos em destaque" info="Valor dos itens após rateio do desconto geral, sem entrega. Quantidades comparadas somente dentro da mesma unidade.">
            <div className={styles.tabs} role="group" aria-label="Ranking de produtos">{[['valor','Por valor'],['quantidade','Quantidade'],['menos','Menos vendidos']].map(([value, label]) => <button key={value} aria-pressed={productView === value} onClick={() => setProductView(value as typeof productView)}>{label}</button>)}</div>
            <div className={styles.rankingScroll}>{productView === 'valor' && dados.produtos.valoresIndisponiveis > 0 ? <Empty text="Ranking por valor indisponível: há itens com dados inconsistentes." /> : <VisualRanking rows={productView === 'valor' ? dados.produtos.porValor : productView === 'quantidade' ? dados.produtos.porQuantidade : dados.produtos.menosVendidos} quantity={productView !== 'valor'} />}</div>
            <p className={styles.note}>{productView === 'valor' ? 'Cinco maiores valores registrados.' : 'Até 5 itens por unidade, limitados a 30 linhas. Sem vendas inclui cadastros até o fim do período.'}{dados.produtos.itensSemCatalogo > 0 && ` ${numero(dados.produtos.itensSemCatalogo)} item(ns) sem catálogo elegível, fora dos rankings.`}</p>
          </Panel>
          <Panel title="Estoque agora" subtitle="POSIÇÃO ATUAL" info="Não representa o estoque histórico do período selecionado." action={details('estoque')}><StockSummary data={dados.estoque} /></Panel>
        </div>
        <footer className={styles.footer}><span><i className="pi pi-shield" aria-hidden="true" /> Dados da empresa selecionada</span><span>Registros gerenciais · sem alterar a operação</span></footer>
        <DetalhesDialog tipo={tipo} filters={filters} empresaId={dados.empresaId} onClose={() => setTipo(null)} />
      </>}
    </>}
  </main>;
}
export function Loading() { return <div aria-busy="true" aria-label="Carregando Central de Gestão"><div className={styles.metrics}>{[0,1,2,3].map(key => <div key={key} className={styles.skeleton} />)}</div><div className={styles.skeleton} style={{ height: 250, marginTop: 12 }} /></div>; }

