'use client';
export default function CentralGestaoError({ reset }: { reset:()=>void }) {
  return <section role="alert" className="card"><h1>Central de Gestão</h1><p>Não foi possível abrir esta área. Seus registros não foram alterados.</p><button onClick={reset}>Tentar novamente</button></section>;
}

