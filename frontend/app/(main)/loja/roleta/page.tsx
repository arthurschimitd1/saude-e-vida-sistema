'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { LojaPremio, LojaRoletaLead, lojaOnlineService } from '@/app/(main)/services/api/lojaOnlineService';
import styles from './RoletaGestao.module.scss';

const vazio = { nome: '', descricao: '', tipo: 'desconto_percentual' as LojaPremio['tipo'], valor: 10, pontos_custo: 10, produto_id: '', chance: 20, estoque: '' };

export default function RoletaGestaoPage() {
  const [leads, setLeads] = useState<LojaRoletaLead[]>([]);
  const [premios, setPremios] = useState<LojaPremio[]>([]);
  const [produtos, setProdutos] = useState<Array<{ id: number; name: string; price: number }>>([]);
  const [form, setForm] = useState(vazio);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    try {
      const [l, p, pr] = await Promise.all([lojaOnlineService.listarRoletaLeads(), lojaOnlineService.listarPremios(), lojaOnlineService.listarProdutosPremios()]);
      setLeads(l.data);
      setPremios(p.data);
      setProdutos(pr.data);
    } catch (error: any) {
      setErro(error?.response?.data?.message || error?.message || 'Não foi possível carregar a roleta.');
    }
  };

  useEffect(() => { void carregar(); }, []);

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    setErro('');
    try {
      await lojaOnlineService.criarPremio({ ...form, produto_id: form.produto_id ? Number(form.produto_id) : null, estoque: form.estoque === '' ? null : Number(form.estoque) });
      setForm(vazio);
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.message || error?.message || 'Não foi possível salvar o prêmio.');
    }
  };

  const decidir = async (id: number, cadastrar: boolean) => {
    try {
      await lojaOnlineService.decidirRoletaLead(id, cadastrar);
      await carregar();
    } catch (error: any) {
      setErro(error?.response?.data?.message || error?.message || 'Não foi possível atualizar o cadastro.');
    }
  };

  const excluir = async (id: number) => {
    if (!window.confirm('Desativar este prêmio?')) return;
    await lojaOnlineService.excluirPremio(id);
    await carregar();
  };

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <Link href="/loja/gestao" className={styles.back}>← Gestão da lojinha</Link>
          <small>RELACIONAMENTO COM CLIENTES</small>
          <h1>Roleta e pontos</h1>
          <p>Configure os prêmios e decida quais participantes entram no cadastro.</p>
        </div>
        <Link href="/roleta" target="_blank" className={styles.public}>Abrir roleta ↗</Link>
      </header>
      {erro && <div className={styles.error}>{erro}</div>}
      <div className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><div><small>PARTICIPANTES</small><h2>Leads da roleta</h2></div><span>{leads.length} registros</span></div>
          {!leads.length && <p className={styles.muted}>Ainda não há participantes.</p>}
          {leads.map((lead) => <article className={styles.lead} key={lead.id}><div><strong>{lead.nome}</strong><span>{lead.email} · {lead.telefone}</span><small>{lead.premio?.nome || 'Prêmio não informado'} {lead.codigo_premio ? `· ${lead.codigo_premio}` : ''}</small></div><div className={styles.status}><b>{lead.status}</b>{lead.status === 'pendente' && <><button onClick={() => decidir(lead.id, true)}>Cadastrar cliente</button><button className={styles.reject} onClick={() => decidir(lead.id, false)}>Não cadastrar</button></>}</div></article>)}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><div><small>CONFIGURAÇÃO</small><h2>Novo prêmio</h2></div></div>
          <form className={styles.form} onSubmit={salvar}>
            <label>Nome<input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Compre 1 e ganhe outro" /></label>
            <label>Descrição<textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Explique o benefício" /></label>
            <div className={styles.two}>
              <label>Tipo<select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as LojaPremio['tipo'] })}><option value="desconto_percentual">Desconto em %</option><option value="desconto_fixo">Desconto em R$</option><option value="produto">Produto grátis na compra</option></select></label>
              {form.tipo !== 'produto' && <label>Valor<input type="number" min="0" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} /></label>}
            </div>
            {form.tipo === 'produto' && <label>Produto específico (opcional)<select value={form.produto_id} onChange={(e) => setForm({ ...form, produto_id: e.target.value })}><option value="">Qualquer produto do carrinho</option>{produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.name}</option>)}</select><small>Deixe “Qualquer produto do carrinho” para o cliente comprar dois itens e ganhar uma unidade grátis, igual ou diferente.</small></label>}
            <div className={styles.two}>
              <label>Custo em pontos<input type="number" min="1" value={form.pontos_custo} onChange={(e) => setForm({ ...form, pontos_custo: Number(e.target.value) })} /></label>
              <label>Chance no giro<input type="number" min="0" value={form.chance} onChange={(e) => setForm({ ...form, chance: Number(e.target.value) })} /></label>
            </div>
            <label>Estoque opcional<input type="number" min="0" value={form.estoque} onChange={(e) => setForm({ ...form, estoque: e.target.value })} placeholder="Sem limite" /></label>
            <button className={styles.save}>Salvar prêmio</button>
          </form>
          <div className={styles.prizes}>{premios.map((premio) => <div className={styles.prize} key={premio.id}><div><strong>{premio.nome}</strong><span>{premio.pontos_custo} pontos · chance {premio.chance}</span></div><button onClick={() => excluir(premio.id)} aria-label={`Desativar ${premio.nome}`}>×</button></div>)}</div>
        </section>
      </div>
    </main>
  );
}
