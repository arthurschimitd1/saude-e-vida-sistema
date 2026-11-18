'use client';
import { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { centralApi, chaveSessao, mensagemErro } from '../api';
import type { Detalhes, Filtros, TipoDetalhe } from '../types';
import styles from '../CentralGestao.module.scss';

export const moeda = (value: string | null | undefined) => value == null ? 'Indisponível' : Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const numero = (value: string | number | null | undefined) => value == null ? 'Indisponível' : Number(value).toLocaleString('pt-BR',{maximumFractionDigits:3});
export const dataBR = (value: string) => value.slice(0,10).split('-').reverse().join('/');

export default function DetalhesDialog({ tipo, filters, empresaId, onClose }: { tipo: TipoDetalhe | null; filters: Filtros; empresaId: number; onClose: () => void }) {
  const [pagina,setPagina] = useState(1); const [data,setData] = useState<Detalhes | null>(null); const [error,setError] = useState(''); const [retry,setRetry] = useState(0);
  useEffect(() => { setPagina(1); }, [tipo,filters,empresaId]);
  useEffect(() => {
    setData(null); setError(''); if (!tipo) return;
    const controller = new AbortController(); const key = chaveSessao();
    centralApi.detalhes({ ...filters,tipo,pagina,tamanho:20 },controller.signal).then(({data:result}) => {
      if (!controller.signal.aborted && key===chaveSessao() && result.empresaId===empresaId) setData(result);
    }).catch(err => { if (!controller.signal.aborted) setError(mensagemErro(err)); });
    return () => controller.abort();
  },[tipo,filters,empresaId,pagina,retry]);
  const titles = { vendas:'Vendas registradas',recebiveis:'Títulos em aberto',saidas:'Saídas registradas',estoque:'Estoque atual' };
  return <Dialog visible={tipo!==null} onHide={onClose} header={tipo ? titles[tipo] : ''} modal style={{width:'960px',maxWidth:'96vw'}}>
    <div className={styles.central}>
      {error ? <div role="alert" className={styles.empty}>{error}<button onClick={() => setRetry(v=>v+1)}>Tentar novamente</button></div>
        : !data ? <div className={styles.skeleton} aria-label="Carregando detalhes" />
        : <><div className={styles.tableWrap}><table><thead><tr><th>{tipo==='estoque'?'SKU':'Data'}</th><th>Descrição</th><th>Classificação</th><th>Status</th><th>{tipo==='estoque'?'Quantidade':'Valor'}</th></tr></thead><tbody>
          {data.itens.map(row => <tr key={row.id}><td>{tipo==='estoque'?row.id:row.data?dataBR(row.data):'—'}</td><td>{row.descricao}</td><td>{row.classificacao}</td><td>{row.status}</td><td>{tipo==='estoque'?row.status==='Estoque infinito'?'Não controlado':numero(row.valor):moeda(row.valor)}</td></tr>)}
        </tbody></table></div>{data.itens.length===0 && <p className={styles.empty}>Sem registros neste recorte.</p>}
        <div className={styles.pagination}><span>{numero(data.total)} registros · Página {pagina} de {Math.max(1,Math.ceil(data.total/20))}</span><button disabled={pagina<=1} onClick={()=>setPagina(p=>p-1)}>Anterior</button><button disabled={pagina*20>=data.total} onClick={()=>setPagina(p=>p+1)}>Próxima</button></div></>}
    </div>
  </Dialog>;
}

