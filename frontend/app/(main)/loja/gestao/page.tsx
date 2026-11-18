'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LojaPedido, lojaOnlineService } from '@/app/(main)/services/api/lojaOnlineService';
import styles from './LojaGestao.module.scss';

const statusOptions = [
    { value: '', label: 'Todos', description: 'Todos os pedidos' },
    { value: 'novo', label: 'Recebido', description: 'Pedido recebido' },
    { value: 'separando', label: 'Em separação', description: 'Equipe preparando' },
    { value: 'enviado', label: 'Enviado', description: 'Saiu para entrega' },
    { value: 'concluido', label: 'Concluído', description: 'Pedido finalizado' },
    { value: 'cancelado', label: 'Cancelado', description: 'Pedido cancelado' },
];
const fluxo = statusOptions.filter((item) => item.value && item.value !== 'cancelado');
const statusLabel: Record<string, string> = Object.fromEntries(statusOptions.filter((item) => item.value).map((item) => [item.value, item.label]));
const dinheiro = (valor: number | string) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = (valor?: string | null) => valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const statusTone = (status: string) => styles[`tone${status.charAt(0).toUpperCase()}${status.slice(1)}`] || styles.toneNovo;

type PeriodoRelatorio = 'dia' | 'mes';
const PEDIDOS_POR_PAGINA = 5;

const dataDoPedido = (pedido: LojaPedido) => {
    const data = new Date(pedido.createdAt || pedido.data);
    return Number.isNaN(data.getTime()) ? null : data;
};

function agruparPedidos(pedidos: LojaPedido[], periodo: PeriodoRelatorio) {
    const grupos = new Map<string, { chave: string; label: string; pedidos: number; cancelados: number; receita: number; itens: number }>();
    pedidos.forEach((pedido) => {
        const data = dataDoPedido(pedido);
        if (!data) return;
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        const chave = periodo === 'dia' ? `${ano}-${mes}-${dia}` : `${ano}-${mes}`;
        const label = periodo === 'dia'
            ? data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
            : data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const grupo = grupos.get(chave) || { chave, label, pedidos: 0, cancelados: 0, receita: 0, itens: 0 };
        if (pedido.status_loja === 'cancelado') {
            grupo.cancelados += 1;
        } else {
            grupo.pedidos += 1;
            grupo.receita += Number(pedido.valor_total || 0);
            grupo.itens += pedido.itens.reduce((total, item) => total + Number(item.quantidade || 0), 0);
        }
        grupos.set(chave, grupo);
    });
    return Array.from(grupos.values()).sort((a, b) => b.chave.localeCompare(a.chave));
}

function historicoDoPedido(pedido: LojaPedido) {
    if (pedido.status_loja_historico?.length) return pedido.status_loja_historico;
    return [{ status: pedido.status_loja, em: pedido.status_loja_atualizado_em || pedido.createdAt || pedido.data, origem: 'legado' }];
}

export default function LojaGestaoPage() {
    const [pedidos, setPedidos] = useState<LojaPedido[]>([]);
    const [pedidosRelatorio, setPedidosRelatorio] = useState<LojaPedido[]>([]);
    const [isMaster, setIsMaster] = useState(false);
    const [filtro, setFiltro] = useState('');
    const [pagina, setPagina] = useState(1);
    const [periodoRelatorio, setPeriodoRelatorio] = useState<PeriodoRelatorio>('dia');
    const [carregando, setCarregando] = useState(true);
    const [atualizando, setAtualizando] = useState(false);
    const [acaoPedidoId, setAcaoPedidoId] = useState<number | null>(null);
    const [erro, setErro] = useState('');
    useEffect(() => {
        try {
            const usuario = JSON.parse(localStorage.getItem('user') ?? '{}');
            setIsMaster(usuario?.tipo === 'MASTER' || usuario?.email === 'admin@master.com');
        } catch {
            setIsMaster(false);
        }
    }, []);
    const carregar = useCallback(async (silencioso = false) => {
        if (!silencioso) setCarregando(true); else setAtualizando(true);
        setErro('');
        try {
            const resposta = await lojaOnlineService.listarPedidos(filtro);
            setPedidos(resposta.data);
            if (isMaster && filtro) {
                const historico = await lojaOnlineService.listarPedidos();
                setPedidosRelatorio(historico.data);
            } else if (isMaster) {
                setPedidosRelatorio(resposta.data);
            } else {
                setPedidosRelatorio([]);
            }
        } catch (e: any) { setErro(e?.response?.data?.message || e?.message || 'Não foi possível carregar os pedidos da loja.'); } finally { setCarregando(false); setAtualizando(false); }
    }, [filtro, isMaster]);
    useEffect(() => { carregar(); }, [carregar]);
    useEffect(() => {
        const intervalo = window.setInterval(() => { void carregar(true); }, 10000);
        return () => window.clearInterval(intervalo);
    }, [carregar]);
    useEffect(() => { setPagina(1); }, [filtro]);
    const totalPaginas = Math.max(1, Math.ceil(pedidos.length / PEDIDOS_POR_PAGINA));
    useEffect(() => { setPagina((atual) => Math.min(atual, totalPaginas)); }, [totalPaginas]);
    const pedidosVisiveis = useMemo(() => {
        const inicio = (pagina - 1) * PEDIDOS_POR_PAGINA;
        return pedidos.slice(inicio, inicio + PEDIDOS_POR_PAGINA);
    }, [pedidos, pagina]);
    const resumo = useMemo(() => {
        const pedidosValidos = pedidos.filter((pedido) => pedido.status_loja !== 'cancelado');
        return {
            novos: pedidos.filter((pedido) => pedido.status_loja === 'novo').length,
            total: pedidosValidos.reduce((soma, pedido) => soma + Number(pedido.valor_total || 0), 0),
            quantidade: pedidos.length,
            itens: pedidosValidos.reduce((soma, pedido) => soma + pedido.itens.reduce((total, item) => total + Number(item.quantidade || 0), 0), 0),
        };
    }, [pedidos]);
    const atualizarStatus = async (pedido: LojaPedido, status: string) => {
        if (status === 'cancelado') {
            if (!window.confirm(`Cancelar a venda #${pedido.id}? O estoque será devolvido.`)) return;
            await cancelarPedido(pedido, false);
            return;
        }
        try {
            await lojaOnlineService.atualizarStatus(pedido.id, status);
            await carregar(true);
        } catch (e: any) { setErro(e?.response?.data?.message || e?.message || 'Não foi possível atualizar o status.'); }
    };
    const gruposRelatorio = useMemo(() => agruparPedidos(pedidosRelatorio, periodoRelatorio), [pedidosRelatorio, periodoRelatorio]);
    const resumoRelatorio = useMemo(() => pedidosRelatorio.reduce((resumoAtual, pedido) => {
        if (pedido.status_loja === 'cancelado') {
            resumoAtual.cancelados += 1;
            return resumoAtual;
        }
        resumoAtual.pedidos += 1;
        resumoAtual.receita += Number(pedido.valor_total || 0);
        resumoAtual.itens += pedido.itens.reduce((total, item) => total + Number(item.quantidade || 0), 0);
        return resumoAtual;
    }, { pedidos: 0, cancelados: 0, receita: 0, itens: 0 }), [pedidosRelatorio]);
    const cancelarPedido = async (pedido: LojaPedido, reembolsar: boolean) => {
        const confirmacao = reembolsar
            ? `Cancelar a venda #${pedido.id} e solicitar o reembolso total de ${dinheiro(pedido.valor_total)} ao cliente pelo Mercado Pago?`
            : `Cancelar a venda #${pedido.id}? O estoque será devolvido.`;
        if (!window.confirm(confirmacao)) return;
        setAcaoPedidoId(pedido.id);
        setErro('');
        try {
            const resposta = await lojaOnlineService.cancelarPedido(pedido.id, { reembolsar });
            if (resposta.data?.mensagem) window.alert(resposta.data.mensagem);
            await carregar(true);
        } catch (e: any) {
            setErro(e?.response?.data?.message || e?.message || 'Não foi possível cancelar a venda.');
            await carregar(true);
        } finally { setAcaoPedidoId(null); }
    };

    return <main className={styles.page}>
        <header className={styles.heading}><div><span>OPERAÇÃO COMERCIAL</span><h1>Vendas da lojinha online</h1><p>Acompanhe cada pedido, cliente e baixa de estoque em um só lugar.</p></div><div className={styles.headerActions}><Link className={styles.publicLink} href="/loja/roleta">Roleta e pontos</Link><Link className={styles.publicLink} href="/loja" target="_blank">Abrir loja <i className="pi pi-external-link" /></Link></div></header>
        {erro && <div className={styles.error}>{erro}</div>}
        {isMaster && <section className={styles.metrics}><div className={styles.metric}><span>Pedidos no filtro</span><strong>{resumo.quantidade}</strong></div><div className={styles.metric}><span>Aguardando atendimento</span><strong>{resumo.novos}</strong></div><div className={styles.metric}><span>Faturamento</span><strong>{dinheiro(resumo.total)}</strong></div></section>}
        {isMaster && <section className={styles.reportPanel} aria-labelledby="relatorio-vendas-online">
            <div className={styles.reportHeading}>
                <div><span>ANÁLISE COMERCIAL</span><h2 id="relatorio-vendas-online">Relatório de vendas online</h2><p>Consolidação automática dos pedidos reais da lojinha, sem perder o histórico ao trocar o filtro de status.</p></div>
                <div className={styles.reportPeriod}><button className={periodoRelatorio === 'dia' ? styles.reportPeriodActive : ''} onClick={() => setPeriodoRelatorio('dia')}>Por dia</button><button className={periodoRelatorio === 'mes' ? styles.reportPeriodActive : ''} onClick={() => setPeriodoRelatorio('mes')}>Por mês</button></div>
            </div>
            <div className={styles.reportSummary}><div><span>Vendas válidas</span><strong>{resumoRelatorio.pedidos}</strong></div><div><span>Faturamento</span><strong>{dinheiro(resumoRelatorio.receita)}</strong></div><div><span>Ticket médio</span><strong>{dinheiro(resumoRelatorio.pedidos ? resumoRelatorio.receita / resumoRelatorio.pedidos : 0)}</strong></div><div><span>Canceladas</span><strong>{resumoRelatorio.cancelados}</strong></div></div>
            {gruposRelatorio.length === 0 ? <div className={styles.reportEmpty}>Ainda não há vendas online para gerar este relatório.</div> : <div className={styles.reportTableWrap}><table className={styles.reportTable}><thead><tr><th>{periodoRelatorio === 'dia' ? 'Dia' : 'Mês'}</th><th>Vendas válidas</th><th>Faturamento</th><th>Itens</th><th>Ticket médio</th><th>Canceladas</th></tr></thead><tbody>{gruposRelatorio.map((grupo) => <tr key={grupo.chave}><td><strong>{grupo.label}</strong></td><td>{grupo.pedidos}</td><td><strong>{dinheiro(grupo.receita)}</strong></td><td>{grupo.itens}</td><td>{dinheiro(grupo.pedidos ? grupo.receita / grupo.pedidos : 0)}</td><td>{grupo.cancelados}</td></tr>)}</tbody></table></div>}
        </section>}
        <div className={styles.toolbar}><div className={styles.tabs}>{statusOptions.map((opcao) => <button key={opcao.value} className={`${styles.tab} ${filtro === opcao.value ? styles.active : ''}`} onClick={() => setFiltro(opcao.value)}>{opcao.label}</button>)}</div><button className={styles.refresh} onClick={() => carregar(true)} disabled={atualizando}><i className="pi pi-refresh" /> {atualizando ? 'Atualizando…' : 'Atualizar'}</button></div>
        {carregando ? <div className={styles.loading}>Carregando pedidos…</div> : pedidos.length === 0 ? <div className={styles.empty}>Nenhum pedido da loja encontrado neste filtro.</div> : <><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Valor</th><th>Recebido em</th><th>Status e andamento</th></tr></thead><tbody>{pedidosVisiveis.map((pedido) => {
            const historico = historicoDoPedido(pedido);
            const atualIndex = pedido.status_loja === 'cancelado' ? -1 : fluxo.findIndex((item) => item.value === pedido.status_loja);
            const pagamentoOnline = pedido.forma_pagamento === 'mercado_pago' || Boolean(pedido.mercado_pago_payment_id);
            const podeReembolsar = pagamentoOnline && pedido.mercado_pago_reembolso_status !== 'estornado';
            const reembolsoLabel = pedido.mercado_pago_reembolso_status === 'estornado'
                ? 'Reembolso confirmado'
                : pedido.mercado_pago_reembolso_status === 'processando'
                    ? 'Reembolso em processamento'
                    : pedido.mercado_pago_reembolso_status === 'erro'
                        ? 'Reembolso pendente de nova tentativa'
                        : null;
            const formaEntregaLabel = pedido.forma_entrega === 'entrega' ? 'Entrega' : 'Retirada na loja';
            return <tr key={pedido.id}><td><strong>#{pedido.id}</strong><br /><small>{pedido.forma_pagamento}</small></td><td className={styles.customer}><strong>{pedido.cliente?.nomeCompleto || 'Cliente não informado'}</strong><div className={styles.customerLine}>{pedido.cliente?.telefone || 'Sem telefone'}{pedido.cliente?.cidade ? ` · ${pedido.cliente.cidade}/${pedido.cliente.estado || ''}` : ''}</div><div className={styles.customerLine}>{pedido.cliente?.email || 'Sem e-mail'}</div><div className={styles.customerLine}><strong>{formaEntregaLabel}</strong></div><div className={styles.customerLine}>{pedido.endereco_entrega || 'Endereço não informado'}</div></td><td className={styles.items}>{pedido.itens.map((item) => <div className={styles.item} key={item.id}><strong>{item.nome_item || item.Product?.name || 'Produto'}</strong><small>{item.quantidade} × {dinheiro(item.valor_unitario)}</small></div>)}</td><td><strong>{dinheiro(pedido.valor_total)}</strong></td><td>{dataHora(pedido.createdAt || pedido.data)}</td><td className={styles.statusCell}><div className={`${styles.statusHeader} ${statusTone(pedido.status_loja)}`}><span className={styles.statusDot} /> <strong>{statusLabel[pedido.status_loja] || pedido.status_loja}</strong><small>Atualizado {dataHora(pedido.status_loja_atualizado_em || historico[historico.length - 1]?.em)}</small></div>{pedido.status_loja !== 'cancelado' ? <div className={styles.statusTimeline}>{fluxo.map((etapa, index) => <span className={`${styles.timelineStep} ${index < atualIndex ? styles.timelineStepDone : ''} ${index === atualIndex ? styles.timelineStepActive : ''}`} key={etapa.value}><i />{etapa.label}</span>)}</div> : <div className={styles.cancelledNote}>Este pedido não volta ao fluxo após o cancelamento.</div>}<select className={styles.statusSelect} aria-label={`Atualizar status do pedido ${pedido.id}`} value={pedido.status_loja} onChange={(event) => atualizarStatus(pedido, event.target.value)}>{statusOptions.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{pedido.status_loja !== 'cancelado' && <button className={styles.cancelButton} disabled={acaoPedidoId === pedido.id} onClick={() => cancelarPedido(pedido, false)}><i className="pi pi-times" /> Cancelar venda</button>}{podeReembolsar && <button className={styles.refundButton} disabled={acaoPedidoId === pedido.id || pedido.mercado_pago_reembolso_status === 'processando'} onClick={() => cancelarPedido(pedido, true)}><i className="pi pi-replay" /> {pedido.mercado_pago_reembolso_status === 'erro' ? 'Tentar reembolso novamente' : pedido.status_loja === 'cancelado' ? 'Reembolsar cliente' : 'Cancelar e reembolsar'}</button>}{reembolsoLabel && <span className={styles.refundStatus}><i className="pi pi-info-circle" /> {reembolsoLabel}</span>}<details className={styles.history}><summary>Ver histórico ({historico.length})</summary><div>{historico.map((evento, index) => <p key={`${evento.em}-${index}`}><strong>{statusLabel[evento.status] || evento.status}</strong><span>{dataHora(evento.em)} · {evento.origem === 'gestao' ? 'gestão' : 'loja'}</span></p>)}</div></details></td></tr>;
        })}</tbody></table></div><nav className={styles.pagination} aria-label="Paginação dos pedidos"><button type="button" disabled={pagina === 1} onClick={() => setPagina((atual) => Math.max(1, atual - 1))}>Anterior</button><span>Página {pagina} de {totalPaginas}</span><button type="button" disabled={pagina === totalPaginas} onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}>Próxima</button></nav></>}
    </main>;
}
