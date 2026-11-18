'use client';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { financeiroService, LancamentoConsolidado } from '../../services/api/financeiroService';

const PRIMARY = '#1e3a5f';

const fmtMoeda = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (d: string) => {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('pt-BR');
};

const dataParaApi = (data: Date) => [data.getFullYear(), data.getMonth() + 1, data.getDate()]
    .map((parte, indice) => indice === 0 ? String(parte) : String(parte).padStart(2, '0'))
    .join('-');

const TIPO_OPTIONS = [
    { label: 'Todos', value: 'TODOS' },
    { label: 'Entradas', value: 'ENTRADA' },
    { label: 'Saídas', value: 'SAIDA' },
];

const corOrigem = (origem: string) => {
    switch (origem) {
        case 'Venda/Caixa': return 'success';
        case 'Folha de Pagamento': return 'danger';
        case 'Recorrência': return 'info';
        case 'Manual': return 'warning';
        default: return 'secondary';
    }
};

interface Linha extends LancamentoConsolidado {
    natureza: 'ENTRADA' | 'SAIDA';
}

export default function RelatoriosFinanceiroPage() {
    const router = useRouter();
    const toast = useRef<Toast>(null);
    const [entradas, setEntradas] = useState<Linha[]>([]);
    const [saidas, setSaidas] = useState<Linha[]>([]);
    const [loading, setLoading] = useState(false);
    const [periodo, setPeriodo] = useState<Date[] | null>(null);
    const [tipo, setTipo] = useState('TODOS');

    const showError = (m: string) =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: m, life: 3000 });

    const carregar = async () => {
        setLoading(true);
        try {
            const params = periodo && periodo[0] && periodo[1]
                ? { dataInicio: dataParaApi(periodo[0]), dataFim: dataParaApi(periodo[1]) }
                : undefined;
            const [resEntradas, resSaidas] = await Promise.all([
                financeiroService.listarEntradas(params),
                financeiroService.listarSaidasConsolidado(params),
            ]);
            setEntradas(resEntradas.data.map(l => ({ ...l, natureza: 'ENTRADA' as const })));
            setSaidas(resSaidas.data.map(l => ({ ...l, natureza: 'SAIDA' as const })));
        } catch {
            showError('Erro ao carregar relatório financeiro');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carregar(); }, [periodo]);

    const combinado: Linha[] = (
        tipo === 'ENTRADA' ? entradas :
        tipo === 'SAIDA' ? saidas :
        [...entradas, ...saidas]
    ).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const totalEntradas = entradas.reduce((acc, l) => acc + Number(l.valor || 0), 0);
    const totalSaidas = saidas.reduce((acc, l) => acc + Number(l.valor || 0), 0);

    const exportarExcel = () => {
        const dados = combinado.map(l => ({
            'Data': fmtData(l.data),
            'Natureza': l.natureza === 'ENTRADA' ? 'Entrada' : 'Saída',
            'Origem': l.origem,
            'Descrição': l.descricao,
            'Valor': Number(l.valor || 0),
        }));
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Financeiro');
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_financeiro_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="grid finance-page">
            <Toast ref={toast} />

            <div className="col-12">
                <div className="flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                    <div>
                        <h4 className="m-0 font-bold" style={{ color: PRIMARY }}>Relatórios Financeiros</h4>
                        <span className="text-sm text-color-secondary">Entradas e saídas consolidadas por período</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Button label="Vendas por Sabor" icon="pi pi-dollar" outlined onClick={() => router.push('/uikit/relatorios-produtos?aba=financeiro')} />
                        <Button label="Comparativo de CMV" icon="pi pi-chart-bar" onClick={() => router.push('/financeiro/relatorios/cmv')} />
                        <Button label="Exportar Excel" icon="pi pi-file-excel"
                            outlined style={{ borderColor: '#16a34a', color: '#16a34a' }}
                            onClick={exportarExcel} disabled={combinado.length === 0} />
                    </div>
                </div>
            </div>

            <div className="col-12 md:col-3">
                <div className="card" style={{ borderLeft: '4px solid #16a34a' }}>
                    <div className="text-sm text-color-secondary mb-1">Total Entradas</div>
                    <div className="text-xl font-bold" style={{ color: '#16a34a' }}>{fmtMoeda(totalEntradas)}</div>
                </div>
            </div>
            <div className="col-12 md:col-3">
                <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
                    <div className="text-sm text-color-secondary mb-1">Total Saídas</div>
                    <div className="text-xl font-bold" style={{ color: '#dc2626' }}>{fmtMoeda(totalSaidas)}</div>
                </div>
            </div>
            <div className="col-12 md:col-3">
                <div className="card" style={{ borderLeft: '4px solid #6366f1' }}>
                    <div className="text-sm text-color-secondary mb-1">Saldo do Período</div>
                    <div className="text-xl font-bold" style={{ color: totalEntradas - totalSaidas >= 0 ? '#16a34a' : '#dc2626' }}>
                        {fmtMoeda(totalEntradas - totalSaidas)}
                    </div>
                </div>
            </div>

            <div className="col-12">
                <div className="card">
                <div className="flex justify-content-between align-items-center flex-wrap gap-3 mb-3 finance-filter-row">
                        <div className="flex gap-3 flex-wrap">
                            <Calendar
                                value={periodo as any}
                                onChange={e => setPeriodo(e.value as Date[])}
                                selectionMode="range"
                                placeholder="Filtrar por período"
                                dateFormat="dd/mm/yy"
                                showIcon
                                showButtonBar
                            />
                            <Dropdown value={tipo} options={TIPO_OPTIONS} onChange={e => setTipo(e.value)} style={{ minWidth: 160 }} />
                        </div>
                    </div>

                    <DataTable value={combinado} loading={loading} paginator rows={15} emptyMessage="Nenhum lançamento encontrado"
                        sortField="data" sortOrder={-1}>
                        <Column field="data" header="Data" body={r => fmtData(r.data)} sortable style={{ width: '120px' }} />
                        <Column field="natureza" header="Natureza" body={r => (
                            <Tag value={r.natureza === 'ENTRADA' ? 'Entrada' : 'Saída'} severity={r.natureza === 'ENTRADA' ? 'success' : 'danger'} />
                        )} sortable style={{ width: '120px' }} />
                        <Column field="origem" header="Origem" body={r => <Tag value={r.origem} severity={corOrigem(r.origem)} />} sortable style={{ width: '180px' }} />
                        <Column field="descricao" header="Descrição" sortable />
                        <Column field="valor" header="Valor" body={r => fmtMoeda(r.valor)} sortable style={{ width: '160px' }} />
                    </DataTable>
                </div>
            </div>
        </div>
    );
}
