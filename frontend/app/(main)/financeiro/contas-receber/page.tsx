'use client';

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api/baseApi';
import { ContaReceber, financeiroService } from '../../services/api/financeiroService';

type Cliente = { id: number; nomeCompleto: string; telefone?: string | null; cpf?: string | null; cnpj?: string | null };
type FiltroStatus = '' | ContaReceber['status'];

const moeda = (value: number | string | null | undefined) =>
    Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataHoje = () => {
    const agora = new Date();
    return [agora.getFullYear(), agora.getMonth() + 1, agora.getDate()]
        .map((parte, indice) => indice === 0 ? String(parte) : String(parte).padStart(2, '0'))
        .join('-');
};

const dataTexto = (value?: string | null) => {
    if (!value) return '-';
    const [ano, mes, dia] = String(value).slice(0, 10).split('-');
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : '-';
};

const nomeOrigem: Record<ContaReceber['origem'], string> = {
    MANUAL: 'Manual', VENDA: 'Venda', NF_E: 'NF-e', RECORRENCIA: 'Recorrência'
};

const statusLabel: Record<ContaReceber['status'], string> = {
    ABERTA: 'Aberta', PAGA: 'Paga', CANCELADA: 'Cancelada'
};

export default function ContasReceberPage() {
    const toast = useRef<Toast>(null);
    const [contas, setContas] = useState<ContaReceber[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [busca, setBusca] = useState('');
    const [status, setStatus] = useState<FiltroStatus>('');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [modal, setModal] = useState(false);
    const [editando, setEditando] = useState<ContaReceber | null>(null);
    const [form, setForm] = useState({
        cliente_id: null as number | null,
        descricao: '',
        valor: 0,
        data_vencimento: dataHoje(),
        observacao: ''
    });

    const avisar = (severity: 'success' | 'error' | 'warn', detail: string) =>
        toast.current?.show({ severity, summary: severity === 'error' ? 'Erro' : 'Contas a receber', detail, life: 3500 });

    const carregar = async () => {
        setLoading(true);
        try {
            const response = await financeiroService.listarContasReceber({
                busca: busca.trim() || undefined,
                status: status || undefined,
                dataInicio: dataInicio || undefined,
                dataFim: dataFim || undefined
            });
            const data = response.data as unknown;
            setContas(Array.isArray(data) ? data : ((data as { data?: ContaReceber[] })?.data ?? []));
        } catch (error: any) {
            avisar('error', error?.response?.data?.error || 'Não foi possível carregar as contas a receber.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        api.get('/clientes').then(response => {
            const data = response.data?.data ?? response.data ?? [];
            setClientes(Array.isArray(data) ? data : []);
        }).catch(() => setClientes([]));
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(carregar, 250);
        return () => window.clearTimeout(timer);
    }, [busca, status, dataInicio, dataFim]);

    const resumo = useMemo(() => {
        const hoje = dataHoje();
        const abertas = contas.filter(conta => conta.status === 'ABERTA');
        return {
            aberto: abertas.reduce((total, conta) => total + Number(conta.valor || 0), 0),
            vencido: abertas.filter(conta => String(conta.data_vencimento).slice(0, 10) < hoje)
                .reduce((total, conta) => total + Number(conta.valor || 0), 0),
            hoje: abertas.filter(conta => String(conta.data_vencimento).slice(0, 10) === hoje)
                .reduce((total, conta) => total + Number(conta.valor || 0), 0),
            recebido: contas.filter(conta => conta.status === 'PAGA')
                .reduce((total, conta) => total + Number(conta.valor_pago || conta.valor || 0), 0)
        };
    }, [contas]);

    const abrirNova = () => {
        setEditando(null);
        setForm({ cliente_id: null, descricao: '', valor: 0, data_vencimento: dataHoje(), observacao: '' });
        setModal(true);
    };

    const abrirEdicao = (conta: ContaReceber) => {
        setEditando(conta);
        setForm({
            cliente_id: conta.cliente_id,
            descricao: conta.descricao,
            valor: Number(conta.valor || 0),
            data_vencimento: String(conta.data_vencimento).slice(0, 10),
            observacao: conta.observacao || ''
        });
        setModal(true);
    };

    const salvar = async () => {
        if (!form.descricao.trim() || form.valor <= 0 || !form.data_vencimento) {
            avisar('warn', 'Informe descrição, valor e data de vencimento.');
            return;
        }
        setSalvando(true);
        try {
            if (editando) {
                await financeiroService.atualizarContaReceber(editando.id, {
                    descricao: form.descricao.trim(), data_vencimento: form.data_vencimento, observacao: form.observacao.trim() || null
                });
                avisar('success', 'Conta atualizada.');
            } else {
                await financeiroService.criarContaReceber({
                    cliente_id: form.cliente_id,
                    descricao: form.descricao.trim(),
                    valor: form.valor,
                    data_vencimento: form.data_vencimento,
                    observacao: form.observacao.trim() || null,
                    origem: 'MANUAL'
                });
                avisar('success', 'Conta a receber criada.');
            }
            setModal(false);
            await carregar();
        } catch (error: any) {
            avisar('error', error?.response?.data?.error || 'Não foi possível salvar a conta.');
        } finally {
            setSalvando(false);
        }
    };

    const atualizarStatus = async (conta: ContaReceber, novoStatus: ContaReceber['status']) => {
        try {
            await financeiroService.atualizarContaReceber(conta.id, { status: novoStatus });
            avisar('success', novoStatus === 'PAGA' ? 'Conta marcada como paga.' : 'Status atualizado.');
            await carregar();
        } catch (error: any) {
            avisar('error', error?.response?.data?.error || 'Não foi possível atualizar o status.');
        }
    };

    const statusBody = (conta: ContaReceber) => {
        const vencida = conta.status === 'ABERTA' && String(conta.data_vencimento).slice(0, 10) < dataHoje();
        return <Tag value={vencida ? 'Vencida' : statusLabel[conta.status]} severity={vencida ? 'danger' : conta.status === 'PAGA' ? 'success' : conta.status === 'CANCELADA' ? 'secondary' : 'warning'} />;
    };

    const origemBody = (conta: ContaReceber) => (
        <div>
            <div className="font-medium">{conta.descricao}</div>
            <small className="text-color-secondary">{nomeOrigem[conta.origem]}{conta.venda_id ? ` · Venda #${conta.venda_id}` : ''}{conta.nota_numero ? ` · NF ${conta.nota_numero}` : ''}</small>
        </div>
    );

    const acoesBody = (conta: ContaReceber) => (
        <div className="flex gap-1 justify-content-end">
            {conta.status === 'ABERTA' && <Button icon="pi pi-check" rounded text severity="success" tooltip="Marcar como paga" onClick={() => atualizarStatus(conta, 'PAGA')} />}
            {conta.status === 'PAGA' && <Button icon="pi pi-undo" rounded text severity="warning" tooltip="Reabrir" onClick={() => atualizarStatus(conta, 'ABERTA')} />}
            {conta.status !== 'CANCELADA' && <Button icon="pi pi-pencil" rounded text tooltip="Editar" onClick={() => abrirEdicao(conta)} />}
            {conta.status === 'ABERTA' && <Button icon="pi pi-times" rounded text severity="danger" tooltip="Cancelar" onClick={() => atualizarStatus(conta, 'CANCELADA')} />}
        </div>
    );

    return (
        <div className="grid finance-page">
            <Toast ref={toast} />
            <div className="col-12">
                <div className="flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <div>
                        <h5 className="m-0">Contas a Receber</h5>
                        <small className="text-color-secondary">Acompanhe vencimentos sem gerar boleto ou cobrança automática.</small>
                    </div>
                    <Button label="Nova conta" icon="pi pi-plus" onClick={abrirNova} />
                </div>
            </div>

            {[
                ['Em aberto', resumo.aberto, 'var(--primary-color)'],
                ['Vencido', resumo.vencido, '#dc2626'],
                ['Vence hoje', resumo.hoje, '#d97706'],
                ['Recebido', resumo.recebido, '#16a34a']
            ].map(([label, valor, cor]) => (
                <div className="col-12 md:col-6 xl:col-3" key={String(label)}>
                    <div className="card mb-0">
                        <span className="block text-color-secondary mb-2">{label}</span>
                        <span className="text-2xl font-bold" style={{ color: String(cor) }}>{moeda(Number(valor))}</span>
                    </div>
                </div>
            ))}

            <div className="col-12">
                <div className="card">
                    <div className="flex gap-2 flex-wrap mb-3 finance-filter-row">
                        <span className="p-input-icon-left flex-1" style={{ minWidth: 220 }}>
                            <i className="pi pi-search" />
                            <InputText value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar por cliente, descrição ou venda..." className="w-full" />
                        </span>
                        <Dropdown value={status} options={[{ label: 'Todos os status', value: '' }, { label: 'Abertas', value: 'ABERTA' }, { label: 'Pagas', value: 'PAGA' }, { label: 'Canceladas', value: 'CANCELADA' }]} onChange={event => setStatus(event.value)} className="w-12rem" />
                        <InputText type="date" value={dataInicio} onChange={event => setDataInicio(event.target.value)} aria-label="Vencimento inicial" />
                        <InputText type="date" value={dataFim} onChange={event => setDataFim(event.target.value)} aria-label="Vencimento final" />
                        <Button icon="pi pi-refresh" outlined tooltip="Atualizar" onClick={carregar} />
                    </div>
                    <DataTable value={contas} loading={loading} paginator rows={15} dataKey="id" emptyMessage="Nenhuma conta a receber encontrada" responsiveLayout="scroll">
                        <Column field="cliente_nome" header="Cliente" body={(conta: ContaReceber) => conta.cliente_nome || 'Sem cliente'} sortable />
                        <Column header="Conta" body={origemBody} />
                        <Column field="data_vencimento" header="Vencimento" body={(conta: ContaReceber) => dataTexto(conta.data_vencimento)} sortable />
                        <Column field="valor" header="Valor" body={(conta: ContaReceber) => moeda(conta.valor)} sortable />
                        <Column header="Status" body={statusBody} />
                        <Column header="" body={acoesBody} style={{ width: 170 }} />
                    </DataTable>
                </div>
            </div>

            <Dialog header={editando ? 'Editar conta a receber' : 'Nova conta a receber'} visible={modal} onHide={() => setModal(false)} style={{ width: 'min(560px, 95vw)' }} footer={<div className="flex justify-content-end gap-2"><Button label="Cancelar" text onClick={() => setModal(false)} /><Button label="Salvar" icon="pi pi-check" loading={salvando} onClick={salvar} /></div>}>
                <div className="grid formgrid p-fluid">
                    <div className="field col-12">
                        <label htmlFor="conta-descricao">Descrição *</label>
                        <InputText id="conta-descricao" value={form.descricao} onChange={event => setForm(prev => ({ ...prev, descricao: event.target.value }))} placeholder="Ex.: NF-e da venda #123" />
                    </div>
                    <div className="field col-12 md:col-6">
                        <label htmlFor="conta-cliente">Cliente</label>
                        <Dropdown id="conta-cliente" value={form.cliente_id} options={clientes} optionLabel="nomeCompleto" optionValue="id" filter showClear onChange={event => setForm(prev => ({ ...prev, cliente_id: event.value ?? null }))} placeholder="Opcional" />
                    </div>
                    <div className="field col-12 md:col-6">
                        <label htmlFor="conta-valor">Valor *</label>
                        <InputNumber id="conta-valor" value={form.valor} onValueChange={event => setForm(prev => ({ ...prev, valor: event.value ?? 0 }))} mode="currency" currency="BRL" locale="pt-BR" min={0.01} />
                    </div>
                    <div className="field col-12 md:col-6">
                        <label htmlFor="conta-vencimento">Data de vencimento *</label>
                        <InputText id="conta-vencimento" type="date" value={form.data_vencimento} onChange={event => setForm(prev => ({ ...prev, data_vencimento: event.target.value }))} />
                    </div>
                    <div className="field col-12">
                        <label htmlFor="conta-observacao">Observação</label>
                        <InputTextarea id="conta-observacao" value={form.observacao} onChange={event => setForm(prev => ({ ...prev, observacao: event.target.value }))} rows={3} autoResize />
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
