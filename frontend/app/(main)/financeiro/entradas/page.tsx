'use client';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { useEffect, useRef, useState } from 'react';
import { financeiroService, LancamentoConsolidado } from '../../services/api/financeiroService';
import NovoLancamentoModal from '../components/NovoLancamentoModal';
import { formatarDataCivil } from '../utils/dataLocal';

const fmtMoeda = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (d: string) => {
    return formatarDataCivil(d);
};

const dataParaApi = (data: Date) => [data.getFullYear(), data.getMonth() + 1, data.getDate()]
    .map((parte, indice) => indice === 0 ? String(parte) : String(parte).padStart(2, '0'))
    .join('-');

const corOrigem = (origem: string) => {
    switch (origem) {
        case 'Venda/Caixa': return 'success';
        case 'Recorrência': return 'info';
        case 'Manual': return 'warning';
        default: return 'secondary';
    }
};

export default function EntradasPage() {
    const toast = useRef<Toast>(null);
    const [linhas, setLinhas] = useState<LancamentoConsolidado[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [periodo, setPeriodo] = useState<Date[] | null>(null);

    const showError = (m: string) =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: m, life: 3000 });

    const carregar = async () => {
        setLoading(true);
        try {
            const params = periodo && periodo[0] && periodo[1]
                ? { dataInicio: dataParaApi(periodo[0]), dataFim: dataParaApi(periodo[1]) }
                : undefined;
            const { data } = await financeiroService.listarEntradas(params);
            setLinhas(data);
        } catch {
            showError('Erro ao carregar entradas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carregar(); }, [periodo]);

    const total = linhas.reduce((acc, l) => acc + Number(l.valor || 0), 0);

    return (
        <div className="grid finance-page">
            <Toast ref={toast} />

            <div className="col-12">
                <div className="flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <h5 className="m-0">Entradas</h5>
                    <Button label="+ Novo Lançamento" icon="pi pi-plus" onClick={() => setModalVisible(true)} />
                </div>
            </div>

            <div className="col-12">
                <div className="card">
                <div className="flex justify-content-between align-items-center flex-wrap gap-3 mb-3 finance-filter-row">
                        <Calendar
                            value={periodo as any}
                            onChange={e => setPeriodo(e.value as Date[])}
                            selectionMode="range"
                            placeholder="Filtrar por período"
                            dateFormat="dd/mm/yy"
                            showIcon
                            showButtonBar
                        />
                        <div className="text-right">
                            <div className="text-sm text-color-secondary">Total no período</div>
                            <div className="text-xl font-bold" style={{ color: '#16a34a' }}>{fmtMoeda(total)}</div>
                        </div>
                    </div>

                    <DataTable value={linhas} loading={loading} paginator rows={10} emptyMessage="Nenhuma entrada encontrada"
                        sortField="data" sortOrder={-1}>
                        <Column field="data" header="Data" body={r => fmtData(r.data)} sortable style={{ width: '120px' }} />
                        <Column field="origem" header="Origem" body={r => <Tag value={r.origem} severity={corOrigem(r.origem)} />} sortable style={{ width: '160px' }} />
                        <Column field="descricao" header="Descrição" sortable />
                        <Column field="valor" header="Valor" body={r => fmtMoeda(r.valor)} sortable style={{ width: '160px' }} />
                    </DataTable>
                </div>
            </div>

            <NovoLancamentoModal
                visible={modalVisible}
                onHide={() => setModalVisible(false)}
                onSalvo={carregar}
                naturezaDefault="ENTRADA"
                onErro={showError}
            />
        </div>
    );
}
