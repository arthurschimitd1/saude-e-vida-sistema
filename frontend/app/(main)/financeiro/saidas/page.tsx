'use client';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Column } from 'primereact/column';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { DataTable } from 'primereact/datatable';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
        case 'Manual': return 'warning';
        case 'Folha de Pagamento': return 'danger';
        case 'Recorrência': return 'info';
        default: return 'secondary';
    }
};

export default function SaidasPage() {
    const toast = useRef<Toast>(null);
    const router = useRouter();
    const [linhas, setLinhas] = useState<LancamentoConsolidado[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editando, setEditando] = useState<LancamentoConsolidado | null>(null);
    const [periodo, setPeriodo] = useState<Date[] | null>(null);

    const showError = (m: string) =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: m, life: 3000 });
    const showSuccess = (m: string) =>
        toast.current?.show({ severity: 'success', summary: 'Sucesso', detail: m, life: 3000 });

    const carregar = async () => {
        setLoading(true);
        try {
            const params = periodo && periodo[0] && periodo[1]
                ? { dataInicio: dataParaApi(periodo[0]), dataFim: dataParaApi(periodo[1]) }
                : undefined;
            const { data } = await financeiroService.listarSaidasConsolidado(params);
            setLinhas(data);
        } catch {
            showError('Erro ao carregar saídas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carregar(); }, [periodo]);

    const total = linhas.reduce((acc, l) => acc + Number(l.valor || 0), 0);

    const editar = (linha: LancamentoConsolidado) => {
        setEditando(linha);
        setModalVisible(true);
    };

    const excluir = (linha: LancamentoConsolidado) => {
        confirmDialog({
            message: `Excluir o lançamento "${linha.descricao}"?`,
            header: 'Confirmar exclusão',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Excluir',
            rejectLabel: 'Cancelar',
            accept: async () => {
                try {
                    await financeiroService.deletarLancamento(linha.id);
                    showSuccess('Lançamento excluído');
                    carregar();
                } catch {
                    showError('Erro ao excluir lançamento');
                }
            },
        });
    };

    const acoes = (linha: LancamentoConsolidado) => {
        if (linha.origem !== 'Manual') return null;
        return (
            <div className="flex gap-2">
                <Button icon="pi pi-pencil" rounded text severity="info" onClick={() => editar(linha)} />
                <Button icon="pi pi-trash" rounded text severity="danger" onClick={() => excluir(linha)} />
            </div>
        );
    };

    return (
        <div className="grid finance-page">
            <Toast ref={toast} />
            <ConfirmDialog />

            <div className="col-12">
                <div className="flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <h5 className="m-0">Saídas</h5>
                    <div className="flex gap-2 flex-wrap">
                        <Button label="Gerenciar Funcionários" icon="pi pi-users" text onClick={() => router.push('/uikit/table')} />
                        <Button label="+ Novo Lançamento" icon="pi pi-plus" onClick={() => { setEditando(null); setModalVisible(true); }} />
                    </div>
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
                            <div className="text-xl font-bold" style={{ color: '#dc2626' }}>{fmtMoeda(total)}</div>
                        </div>
                    </div>

                    <DataTable value={linhas} loading={loading} paginator rows={10} emptyMessage="Nenhuma saída encontrada"
                        sortField="data" sortOrder={-1}>
                        <Column field="data" header="Data" body={r => fmtData(r.data)} sortable style={{ width: '120px' }} />
                        <Column field="origem" header="Origem" body={r => <Tag value={r.origem} severity={corOrigem(r.origem)} />} sortable style={{ width: '180px' }} />
                        <Column field="descricao" header="Descrição" sortable />
                        <Column field="valor" header="Valor" body={r => fmtMoeda(r.valor)} sortable style={{ width: '160px' }} />
                        <Column header="Ações" body={acoes} style={{ width: '110px' }} />
                    </DataTable>
                </div>
            </div>

            <NovoLancamentoModal
                visible={modalVisible}
                onHide={() => { setModalVisible(false); setEditando(null); }}
                onSalvo={carregar}
                naturezaDefault="SAIDA"
                editar={editando}
                onErro={showError}
            />
        </div>
    );
}
