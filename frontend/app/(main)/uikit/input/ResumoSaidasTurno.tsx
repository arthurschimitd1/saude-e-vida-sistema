import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';

const moeda = (valor: unknown) => Number(valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formas: Record<string, string> = { DINHEIRO: 'Dinheiro', PIX: 'Pix', CARTAO: 'Cartão' };

export default function ResumoSaidasTurno({ resumo, saidas }: { resumo: any; saidas: any[] }) {
    return <section className="mb-3" aria-label="Saídas e saldo por forma de pagamento">
        <h4>Saídas do turno ({resumo.qtdSaidas ?? 0}) — {moeda(resumo.totalSaidas)}</h4>
        <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderSpacing: '0 0.6rem' }}>
                <thead><tr><th>Forma</th><th>Vendas</th><th>Saídas</th><th>Líquido</th></tr></thead>
                <tbody>{[
                    ['Dinheiro', resumo.totalDinheiro, resumo.saidasDinheiro, resumo.liquidoDinheiro],
                    ['Pix', resumo.totalPix, resumo.saidasPix, resumo.liquidoPix],
                    ['Cartão', resumo.totalCartao, resumo.saidasCartao, resumo.liquidoCartao],
                ].map(([forma, vendas, retiradas, liquido]) => <tr key={forma}><th>{forma}</th><td>{moeda(vendas)}</td><td>{moeda(retiradas)}</td><td>{moeda(liquido)}</td></tr>)}</tbody>
            </table>
        </div>
        <p className="text-sm text-color-secondary">O líquido é vendas menos saídas. Apenas as saídas em dinheiro reduzem o saldo esperado da gaveta.</p>
        {resumo.saidasSemForma > 0 && <p role="status">Saídas sem forma informada: {moeda(resumo.saidasSemForma)}. Não descontadas automaticamente do dinheiro.</p>}
        <DataTable value={saidas} emptyMessage="Nenhuma saída paga vinculada a este turno." size="small" paginator={saidas.length > 5} rows={5}>
            <Column header="Data" body={(s: any) => s.data ? new Date(s.data).toLocaleDateString('pt-BR') : '—'} />
            <Column header="Saída" body={(s: any) => <div>{s.tipo}<div className="text-sm text-color-secondary">{s.descricao}</div></div>} />
            <Column header="Pagamento" body={(s: any) => formas[s.forma_pagamento] ?? 'Não informado'} />
            <Column header="Valor" body={(s: any) => moeda(s.valor)} />
        </DataTable>
        <p className="text-xs text-color-secondary">Lançamentos antigos sem vínculo com turno não são incluídos automaticamente.</p>
    </section>;
}
