'use client';

import { CSSProperties, FormEvent, useState } from 'react';
import Link from 'next/link';
import { LojaPremio, lojaOnlineService } from '@/app/(main)/services/api/lojaOnlineService';
import styles from './Roleta.module.scss';

const initial = { nome: '', data_nascimento: '', telefone: '', email: '', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' };
const cores = ['#08705d', '#e88925', '#1d8159', '#d86736', '#236b8d', '#e1a72e', '#5b4b9a', '#1b9a72'];
const esperar = (tempo: number) => new Promise<void>((resolve) => window.setTimeout(resolve, tempo));

export default function RoletaPage() {
  const [dados, setDados] = useState(initial);
  const [etapa, setEtapa] = useState(0);
  const [token, setToken] = useState('');
  const [premios, setPremios] = useState<LojaPremio[]>([]);
  const [premio, setPremio] = useState<LojaPremio | null>(null);
  const [codigo, setCodigo] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [erro, setErro] = useState('');
  const [girando, setGirando] = useState(false);
  const [contagem, setContagem] = useState(4);
  const [rotacao, setRotacao] = useState(0);
  const [statusGiro, setStatusGiro] = useState('Pronta para sortear');

  const alterar = (campo: keyof typeof initial, valor: string) => setDados((atual) => ({ ...atual, [campo]: valor }));

  const buscarCep = async () => {
    const cep = dados.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const endereco = await resposta.json();
      if (!endereco.erro) setDados((atual) => ({ ...atual, rua: endereco.logradouro || '', bairro: endereco.bairro || '', cidade: endereco.localidade || '', estado: endereco.uf || '' }));
    } catch { /* o cliente pode preencher manualmente */ }
  };

  const continuar = async (event: FormEvent) => {
    event.preventDefault();
    setErro('');
    if (etapa < 2) { setEtapa(etapa + 1); return; }
    try {
      const resposta = await lojaOnlineService.iniciarRoleta('saude-e-vida', dados);
      setToken(resposta.data.token);
      setPremios(resposta.data.premios || []);
      setStatusGiro(`${resposta.data.premios?.length || 0} prêmio(s) disponíveis`);
      setEtapa(3);
    } catch (error: any) {
      setErro(error?.response?.data?.message || error?.message || 'Não foi possível iniciar a roleta.');
    }
  };

  const girar = async () => {
    if (!token || girando) return;
    setGirando(true);
    setErro('');
    setContagem(4);
    setStatusGiro('Sorteando seu prêmio…');
    let relogio: number | undefined;
    try {
      const resposta = await lojaOnlineService.girarRoleta('saude-e-vida', token);
      const listaPremios = premios.length ? premios : [resposta.data.premio];
      const indice = Math.max(0, listaPremios.findIndex((item) => Number(item.id) === Number(resposta.data.premio_id)));
      const anguloDoSegmento = 360 / listaPremios.length;
      const centroDoSegmento = indice * anguloDoSegmento + anguloDoSegmento / 2;
      const voltaFinal = (360 - centroDoSegmento) % 360;
      const rotacaoAtual = ((rotacao % 360) + 360) % 360;
      const ajuste = (voltaFinal - rotacaoAtual + 360) % 360;
      setRotacao(rotacao + (6 + Math.floor(Math.random() * 3)) * 360 + ajuste);
      setStatusGiro('A roleta está girando…');
      relogio = window.setInterval(() => setContagem((atual) => Math.max(0, atual - 1)), 1000);
      await esperar(4000);
      setPremio(resposta.data.premio);
      setCodigo(resposta.data.codigo);
      setEmailStatus(resposta.data.email_status);
      setEtapa(4);
    } catch (error: any) {
      setErro(error?.response?.data?.message || error?.message || 'Não foi possível sortear seu prêmio.');
      setStatusGiro('Não foi possível concluir o giro');
    } finally {
      if (relogio) window.clearInterval(relogio);
      setGirando(false);
    }
  };

  const camposPessoais = [['nome', 'Nome completo', 'text'], ['data_nascimento', 'Data de nascimento', 'date'], ['telefone', 'Celular com DDD', 'tel'], ['email', 'Seu melhor e-mail', 'email']] as const;
  const camposEndereco = [['cep', 'CEP', 'text'], ['rua', 'Rua', 'text'], ['numero', 'Número', 'text'], ['complemento', 'Complemento', 'text'], ['bairro', 'Bairro', 'text'], ['cidade', 'Cidade', 'text'], ['estado', 'UF', 'text']] as const;
  const segmento = premios.length ? 100 / premios.length : 100;
  const wheelStyle = {
    background: premios.length ? `conic-gradient(${premios.map((_, indice) => `${cores[indice % cores.length]} ${indice * segmento}% ${(indice + 1) * segmento}%`).join(', ')})` : '#08705d',
    transform: `rotate(${rotacao}deg)`,
    transition: girando ? 'transform 4s cubic-bezier(.12,.72,.15,1)' : 'none',
  } as CSSProperties;

  return <main className={styles.page}><div className={styles.tablet}>
    <header><Link href="/loja" className={styles.brand}><span>✦</span> Saúde e Vida</Link><span className={styles.step}>Etapa {Math.min(etapa + 1, 4)} de 4</span></header>
    <div className={styles.progress}><i style={{ width: `${Math.min(100, ((etapa + 1) / 4) * 100)}%` }} /></div>
    {etapa < 3 && <form onSubmit={continuar} className={styles.panel}><div><small>UMA SURPRESA PARA VOCÊ</small><h1>Gire a roleta e ganhe um prêmio na loja.</h1><p>Responda rapidinho. No final, você recebe um código exclusivo no seu e-mail.</p></div><div className={styles.fields}>{(etapa === 0 ? camposPessoais : camposEndereco).map(([campo, label, tipo]) => <label key={campo}>{label}<input required={campo !== 'complemento'} type={tipo} value={dados[campo]} onChange={(event) => alterar(campo, event.target.value)} onBlur={campo === 'cep' ? buscarCep : undefined} /></label>)}</div><button className={styles.primary} type="submit">{etapa === 2 ? 'Continuar para a roleta' : 'Continuar'} <span>→</span></button></form>}
    {etapa === 3 && <section className={`${styles.panel} ${styles.wheelPanel}`}><small>SUA VEZ</small><h1>Pronto, {dados.nome.split(' ')[0]}?</h1><p>O resultado é sorteado pelo servidor conforme as chances configuradas. A roleta vai girar por 4 segundos e parar no prêmio sorteado.</p><div className={styles.wheelStage}><div className={styles.pointer} aria-hidden="true" /><div className={styles.wheel} style={wheelStyle}><div className={styles.wheelCenter}>{girando ? <><strong>{contagem}s</strong><small>girando</small></> : <><strong>✦</strong><small>boa sorte</small></>}</div>{premios.map((item, indice) => { const angulo = indice * (360 / premios.length) + (180 / premios.length); return <span className={styles.wheelLabel} key={item.id} style={{ transform: `rotate(${angulo}deg) translateY(-${Math.max(70, Math.min(126, 170 - premios.length * 7))}px) rotate(-${angulo}deg)` }}>{item.nome}</span>; })}</div></div><div className={styles.spinInfo}><strong>{statusGiro}</strong><span>{premios.length} prêmios configurados · a chance de cada um é definida na gestão</span></div><button className={styles.primary} onClick={girar} disabled={girando}>{girando ? 'Aguarde o resultado…' : 'Girar roleta'} <span>↻</span></button></section>}
    {etapa === 4 && <section className={`${styles.panel} ${styles.result}`}><div className={styles.confetti}>✦</div><small>PARABÉNS!</small><h1>Você ganhou {premio?.nome}.</h1><p>{premio?.descricao || 'Seu prêmio já está reservado para você.'}</p><div className={styles.code}><span>Seu código exclusivo</span><strong>{codigo}</strong></div><p className={styles.emailNotice}>{emailStatus === 'enviado' ? `Também enviamos o código para ${dados.email}.` : 'O código foi criado. Confira seu e-mail assim que o envio for concluído.'}</p><Link className={styles.primary} href="/loja">Ir para a lojinha <span>→</span></Link></section>}
    {erro && <div className={styles.error}>{erro}</div>}<footer>Seus dados ficam protegidos e são usados somente para melhorar sua experiência.</footer>
  </div></main>;
}
