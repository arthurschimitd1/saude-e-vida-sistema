'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { FilterMatchMode } from 'primereact/api';
import { Toast } from 'primereact/toast';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { Tag } from 'primereact/tag';
import { Divider } from 'primereact/divider';
import { useRouter } from 'next/navigation';
import api from '../../services/api/baseApi';

interface Fornecedor {
    id?: number;
    nomeCompleto: string;
    cpf?: string;
    cnpj?: string;
    email?: string;
    telefone: string;
    cep?: string;
    rua: string;
    bairro: string;
    cidade: string;
    estado: string;
    pais: string;
    numero: string;
    complemento?: string;
    pontoReferencia?: string;
    inscricao_estadual?: string;
}

interface SugestaoFornecedorXml extends Fornecedor {
    source_import_id: number;
    document: string;
    invoice_count: number;
    last_imported_at?: string | null;
}

const initialFornecedor: Fornecedor = {
    nomeCompleto: '', telefone: '', rua: '', bairro: '', cidade: '', estado: '', pais: 'Brasil', numero: '',
};

const FornecedoresPage = () => {
    const router = useRouter();
    const toast = useRef<Toast>(null);

    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [loading, setLoading] = useState(false);
    const [fornecedorDialog, setFornecedorDialog] = useState(false);
    const [sugestoesDialog, setSugestoesDialog] = useState(false);
    const [sugestoesXml, setSugestoesXml] = useState<SugestaoFornecedorXml[]>([]);
    const [loadingSugestoes, setLoadingSugestoes] = useState(false);
    const [fornecedor, setFornecedor] = useState<Fornecedor>(initialFornecedor);
    const [submitted, setSubmitted] = useState(false);
    const [globalFilterValue, setGlobalFilterValue] = useState('');
    const [filters, setFilters] = useState({
        global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    });

    const [visualizarDialog, setVisualizarDialog] = useState(false);
    const [fornecedorVisualizado, setFornecedorVisualizado] = useState<Fornecedor | null>(null);
    const [pedidosFornecedor, setPedidosFornecedor] = useState<any[]>([]);
    const [loadingPedidos, setLoadingPedidos] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { router.push('/auth/login'); return; }
        fetchFornecedores();
        fetchSugestoesXml();
    }, []);

    const fetchFornecedores = async () => {
        setLoading(true);
        try {
            const res = await api.get('/fornecedores');
            setFornecedores(res.data?.data ?? res.data ?? []);
        } catch {
            setFornecedores([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchSugestoesXml = async () => {
        setLoadingSugestoes(true);
        try {
            const res = await api.get('/fornecedores/sugestoes/xml');
            setSugestoesXml(res.data?.data ?? res.data ?? []);
        } catch {
            setSugestoesXml([]);
        } finally {
            setLoadingSugestoes(false);
        }
    };

    const showError = (msg: string) => toast.current?.show({ severity: 'error', summary: 'Erro', detail: msg, life: 5000 });
    const showSuccess = (msg: string) => toast.current?.show({ severity: 'success', summary: 'Sucesso', detail: msg, life: 3000 });

    const formatarCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    const formatarCNPJ = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    const formatarCEP = (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');
    const formatarTelefone = (v: string) => v.replace(/\D/g, '');

    const buscarCEP = async (cep: string) => {
        const nums = cep.replace(/\D/g, '');
        if (nums.length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${nums}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    setFornecedor(p => ({ ...p, rua: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', estado: data.uf || '', cep: formatarCEP(nums) }));
                }
            } catch {}
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let val = value;
        if (name === 'cpf') val = formatarCPF(value);
        else if (name === 'cnpj') val = formatarCNPJ(value);
        setFornecedor(p => ({ ...p, [name]: val }));
        if (name === 'cep') buscarCEP(value);
    };

    const openNew = () => { setFornecedor(initialFornecedor); setSubmitted(false); setFornecedorDialog(true); };
    const hideDialog = () => { setSubmitted(false); setFornecedorDialog(false); };

    const saveFornecedor = async () => {
        setSubmitted(true);
        if (!fornecedor.nomeCompleto || !fornecedor.telefone) { showError('Preencha nome e telefone'); return; }
        try {
            const payload = {
                nomeCompleto: fornecedor.nomeCompleto.trim(),
                cpf: fornecedor.cpf ? formatarCPF(fornecedor.cpf.replace(/\D/g, '')) : null,
                cnpj: fornecedor.cnpj ? formatarCNPJ(fornecedor.cnpj.replace(/\D/g, '')) : null,
                email: fornecedor.email?.trim() || null,
                telefone: formatarTelefone(fornecedor.telefone),
                cep: fornecedor.cep ? formatarCEP(fornecedor.cep.replace(/\D/g, '')) : null,
                rua: fornecedor.rua?.trim() || null,
                bairro: fornecedor.bairro?.trim() || null,
                cidade: fornecedor.cidade?.trim() || null,
                estado: fornecedor.estado?.trim().substring(0, 2).toUpperCase() || null,
                pais: fornecedor.pais?.trim() || 'Brasil',
                numero: fornecedor.numero?.trim() || null,
                complemento: fornecedor.complemento?.trim() || null,
                pontoReferencia: fornecedor.pontoReferencia?.trim() || null,
                inscricao_estadual: fornecedor.inscricao_estadual?.trim() || null,
            };
            if (fornecedor.id) {
                await api.put(`/fornecedores/${fornecedor.id}`, payload);
            } else {
                await api.post('/fornecedores', payload);
            }
            showSuccess('Fornecedor salvo com sucesso!');
            await Promise.all([fetchFornecedores(), fetchSugestoesXml()]);
            setFornecedorDialog(false);
        } catch (err: any) {
            showError(err.response?.data?.message || 'Erro ao salvar fornecedor');
        }
    };

    const editFornecedor = (f: Fornecedor) => {
        setFornecedor({
            ...f,
            cpf: f.cpf ? formatarCPF(f.cpf) : '',
            cnpj: f.cnpj ? formatarCNPJ(f.cnpj) : '',
            telefone: formatarTelefone(f.telefone),
            cep: f.cep ? formatarCEP(f.cep) : '',
        });
        setFornecedorDialog(true);
    };

    const revisarSugestao = (sugestao: SugestaoFornecedorXml) => {
        setFornecedor({
            nomeCompleto: sugestao.nomeCompleto || '',
            cpf: sugestao.cpf || '',
            cnpj: sugestao.cnpj || '',
            email: sugestao.email || '',
            telefone: sugestao.telefone || '',
            cep: sugestao.cep || '',
            rua: sugestao.rua || '',
            bairro: sugestao.bairro || '',
            cidade: sugestao.cidade || '',
            estado: sugestao.estado || '',
            pais: sugestao.pais || 'Brasil',
            numero: sugestao.numero || '',
            complemento: sugestao.complemento || '',
            pontoReferencia: sugestao.pontoReferencia || '',
            inscricao_estadual: sugestao.inscricao_estadual || ''
        });
        setSubmitted(false);
        setSugestoesDialog(false);
        setFornecedorDialog(true);
    };

    const confirmDelete = (f: Fornecedor) => {
        confirmDialog({
            message: `Deseja realmente excluir o fornecedor "${f.nomeCompleto}"?`,
            header: 'Confirmar exclusão',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sim, excluir',
            rejectLabel: 'Cancelar',
            acceptClassName: 'p-button-danger',
            accept: () => deleteFornecedor(f),
        });
    };

    const deleteFornecedor = async (f: Fornecedor) => {
        if (!f.id) return;
        try {
            await api.delete(`/fornecedores/${f.id}`);
            showSuccess('Fornecedor removido com sucesso');
            fetchFornecedores();
        } catch (err: any) {
            showError(err.response?.data?.message || 'Erro ao remover fornecedor');
        }
    };

    const fmtMoeda = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const abrirVisualizacao = async (f: Fornecedor) => {
        setFornecedorVisualizado(f);
        setPedidosFornecedor([]);
        setVisualizarDialog(true);
        if (!f.id) return;
        setLoadingPedidos(true);
        try {
            const res = await api.get('/pedidos', { params: { fornecedor_id: f.id } });
            setPedidosFornecedor(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
        } catch {
            setPedidosFornecedor([]);
        } finally {
            setLoadingPedidos(false);
        }
    };

    const estatisticasPedidos = (() => {
        const total = pedidosFornecedor.length;
        const recebidos = pedidosFornecedor.filter(p => p.status === 'recebido' || p.status === 'entregue').length;
        const pendentes = pedidosFornecedor.filter(p => p.status === 'pendente' || p.status === 'em_transito').length;
        const cancelados = pedidosFornecedor.filter(p => p.status === 'cancelado').length;
        const valorTotal = pedidosFornecedor.reduce((s, p) => s + Number(p.valor_total ?? 0), 0);
        return { total, recebidos, pendentes, cancelados, valorTotal };
    })();

    const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFilters(prev => ({ ...prev, global: { ...prev.global, value } }));
        setGlobalFilterValue(value);
    };

    const actionBodyTemplate = (row: Fornecedor) => (
        <div className="flex gap-2">
            <Button icon="pi pi-eye" rounded outlined style={{ borderColor: '#1565c0', color: '#1565c0' }} onClick={() => abrirVisualizacao(row)} tooltip="Visualizar" tooltipOptions={{ position: 'top' }} />
            <Button icon="pi pi-pencil" rounded outlined style={{ borderColor: '#1565c0', color: '#1565c0' }} onClick={() => editFornecedor(row)} tooltip="Editar" tooltipOptions={{ position: 'top' }} />
            <Button icon="pi pi-trash" rounded outlined severity="danger" onClick={() => confirmDelete(row)} tooltip="Excluir" tooltipOptions={{ position: 'top' }} />
        </div>
    );

    const dialogFooter = (
        <React.Fragment>
            <Button label="Cancelar" icon="pi pi-times" rounded outlined style={{ borderColor: '#1565c0', color: '#1565c0' }} onClick={hideDialog} />
            <Button label="Salvar" icon="pi pi-check" rounded outlined style={{ borderColor: '#1565c0', color: '#1565c0' }} onClick={saveFornecedor} />
        </React.Fragment>
    );

    return (
        <div className="grid">
            <Toast ref={toast} />
            <ConfirmDialog />
            <div className="col-12">
                <div className="card">
                    <div className="flex justify-content-between align-items-center mb-4">
                        <h5>Gerenciar Fornecedores</h5>
                        <div className="flex gap-2 flex-wrap justify-content-end">
                            <Button
                                label={`Sugestões do XML${sugestoesXml.length ? ` (${sugestoesXml.length})` : ''}`}
                                icon="pi pi-lightbulb"
                                severity="help"
                                outlined
                                loading={loadingSugestoes}
                                onClick={() => {
                                    setSugestoesDialog(true);
                                    void fetchSugestoesXml();
                                }}
                            />
                            <Button label="Novo Fornecedor" icon="pi pi-plus" className="p-button-primary" onClick={openNew} />
                        </div>
                    </div>

                    <div className="flex justify-content-between mb-4">
                        <span className="p-input-icon-left w-full mr-2">
                            <i className="pi pi-search" />
                            <InputText value={globalFilterValue} onChange={onGlobalFilterChange} placeholder="Pesquisar fornecedores..." className="w-full" />
                        </span>
                    </div>

                    <DataTable
                        value={fornecedores}
                        paginator rows={10} rowsPerPageOptions={[5, 10, 25, 50]}
                        filters={filters} filterDisplay="menu"
                        loading={loading}
                        globalFilterFields={['nomeCompleto', 'telefone', 'cpf', 'cnpj', 'bairro', 'cidade']}
                        emptyMessage="Nenhum fornecedor encontrado."
                    >
                        <Column field="nomeCompleto" header="Nome" sortable style={{ minWidth: '14rem' }} />
                        <Column field="telefone" header="Telefone" sortable style={{ minWidth: '10rem' }} />
                        <Column header="CPF / CNPJ" style={{ minWidth: '12rem' }} body={(row: Fornecedor) => row.cnpj || row.cpf || '-'} />
                        <Column field="cidade" header="Cidade" sortable style={{ minWidth: '10rem' }} body={(row: Fornecedor) => row.cidade ? `${row.cidade}/${row.estado}` : '-'} />
                        <Column field="email" header="E-mail" sortable style={{ minWidth: '12rem' }} body={(row: Fornecedor) => row.email || '-'} />
                        <Column header="Ações" body={actionBodyTemplate} style={{ minWidth: '10rem' }} />
                    </DataTable>
                </div>
            </div>

            <Dialog
                visible={sugestoesDialog}
                style={{ width: 'min(900px, 96vw)' }}
                header="Sugestões de fornecedores dos XMLs"
                modal
                onHide={() => setSugestoesDialog(false)}
            >
                <p className="mt-0 text-color-secondary">
                    Emitentes encontrados nas notas importadas que ainda não estão cadastrados nesta empresa.
                </p>
                <DataTable
                    value={sugestoesXml}
                    loading={loadingSugestoes}
                    dataKey="document"
                    responsiveLayout="scroll"
                    emptyMessage="Nenhum novo fornecedor sugerido pelos XMLs."
                >
                    <Column field="nomeCompleto" header="Fornecedor" style={{ minWidth: '14rem' }} />
                    <Column
                        header="CPF / CNPJ"
                        style={{ minWidth: '12rem' }}
                        body={(row: SugestaoFornecedorXml) => row.cnpj || row.cpf || row.document}
                    />
                    <Column
                        header="Notas importadas"
                        style={{ width: '10rem' }}
                        body={(row: SugestaoFornecedorXml) => (
                            <Tag value={`${row.invoice_count} nota${row.invoice_count === 1 ? '' : 's'}`} severity="info" />
                        )}
                    />
                    <Column
                        header="Última entrada"
                        style={{ minWidth: '10rem' }}
                        body={(row: SugestaoFornecedorXml) => row.last_imported_at
                            ? new Date(row.last_imported_at).toLocaleDateString('pt-BR')
                            : '-'}
                    />
                    <Column
                        header="Ação"
                        style={{ width: '10rem' }}
                        body={(row: SugestaoFornecedorXml) => (
                            <Button
                                label="Revisar"
                                icon="pi pi-pencil"
                                size="small"
                                outlined
                                onClick={() => revisarSugestao(row)}
                            />
                        )}
                    />
                </DataTable>
            </Dialog>

            {/* Dialog Cadastro / Edição */}
            <Dialog visible={fornecedorDialog} style={{ width: '700px' }} header={fornecedor.id ? 'Editar Fornecedor' : 'Novo Fornecedor'} modal className="p-fluid" footer={dialogFooter} onHide={hideDialog}>
                <div className="grid formgrid">
                    <div className="col-12 md:col-8 field">
                        <label htmlFor="nomeCompleto">Nome / Razão Social *</label>
                        <InputText id="nomeCompleto" name="nomeCompleto" value={fornecedor.nomeCompleto} onChange={handleInputChange} required autoFocus placeholder="Ex.: Distribuidora Recife Ltda." className={submitted && !fornecedor.nomeCompleto ? 'p-invalid' : ''} />
                    </div>
                    <div className="col-12 md:col-4 field">
                        <label htmlFor="telefone">Telefone *</label>
                        <InputText id="telefone" name="telefone" value={fornecedor.telefone} onChange={handleInputChange} required placeholder="Ex.: (81) 99999-9999" className={submitted && !fornecedor.telefone ? 'p-invalid' : ''} />
                    </div>

                    <div className="col-12 md:col-6 field">
                        <label htmlFor="cpf">CPF</label>
                        <InputText id="cpf" name="cpf" value={fornecedor.cpf || ''} onChange={handleInputChange} maxLength={14} placeholder="000.000.000-00" />
                    </div>
                    <div className="col-12 md:col-6 field">
                        <label htmlFor="cnpj">CNPJ</label>
                        <InputText id="cnpj" name="cnpj" value={fornecedor.cnpj || ''} onChange={handleInputChange} maxLength={18} placeholder="00.000.000/0000-00" />
                    </div>

                    <div className="col-12 md:col-6 field">
                        <label htmlFor="email">E-mail</label>
                        <InputText id="email" name="email" value={fornecedor.email || ''} onChange={handleInputChange} placeholder="Ex.: contato@fornecedor.com.br" />
                    </div>
                    <div className="col-12 md:col-6 field">
                        <label htmlFor="inscricao_estadual">Inscrição Estadual</label>
                        <InputText id="inscricao_estadual" name="inscricao_estadual" value={fornecedor.inscricao_estadual || ''} onChange={handleInputChange} placeholder="Ex.: 0321418-40" />
                    </div>

                    <Divider align="left"><span className="text-sm text-color-secondary">Endereço</span></Divider>

                    <div className="col-12 md:col-4 field">
                        <label htmlFor="cep">CEP</label>
                        <InputText id="cep" name="cep" value={fornecedor.cep || ''} onChange={handleInputChange} maxLength={9} placeholder="00000-000" />
                    </div>
                    <div className="col-12 md:col-8 field">
                        <label htmlFor="rua">Rua</label>
                        <InputText id="rua" name="rua" value={fornecedor.rua || ''} onChange={handleInputChange} placeholder="Ex.: Avenida Boa Viagem" />
                    </div>

                    <div className="col-12 md:col-3 field">
                        <label htmlFor="numero">Número</label>
                        <InputText id="numero" name="numero" value={fornecedor.numero || ''} onChange={handleInputChange} placeholder="Ex.: 123" />
                    </div>
                    <div className="col-12 md:col-5 field">
                        <label htmlFor="bairro">Bairro</label>
                        <InputText id="bairro" name="bairro" value={fornecedor.bairro || ''} onChange={handleInputChange} placeholder="Ex.: Boa Viagem" />
                    </div>
                    <div className="col-12 md:col-4 field">
                        <label htmlFor="complemento">Complemento</label>
                        <InputText id="complemento" name="complemento" value={fornecedor.complemento || ''} onChange={handleInputChange} placeholder="Ex.: Sala 201" />
                    </div>

                    <div className="col-12 md:col-5 field">
                        <label htmlFor="cidade">Cidade</label>
                        <InputText id="cidade" name="cidade" value={fornecedor.cidade || ''} onChange={handleInputChange} placeholder="Ex.: Recife" />
                    </div>
                    <div className="col-12 md:col-3 field">
                        <label htmlFor="estado">UF</label>
                        <InputText id="estado" name="estado" value={fornecedor.estado || ''} onChange={handleInputChange} maxLength={2} placeholder="Ex.: PE" />
                    </div>
                    <div className="col-12 md:col-4 field">
                        <label htmlFor="pais">País</label>
                        <InputText id="pais" name="pais" value={fornecedor.pais || ''} onChange={handleInputChange} placeholder="Ex.: Brasil" />
                    </div>

                    <div className="col-12 field">
                        <label htmlFor="pontoReferencia">Ponto de Referência</label>
                        <InputText id="pontoReferencia" name="pontoReferencia" value={fornecedor.pontoReferencia || ''} onChange={handleInputChange} placeholder="Ex.: Próximo ao Shopping Recife" />
                    </div>
                </div>
            </Dialog>

            {/* Dialog Visualização */}
            <Dialog visible={visualizarDialog} style={{ width: '800px' }} header={`Fornecedor — ${fornecedorVisualizado?.nomeCompleto ?? ''}`} modal onHide={() => setVisualizarDialog(false)}>
                {fornecedorVisualizado && (
                    <div>
                        {/* Dados do fornecedor */}
                        <div className="grid mb-3">
                            <div className="col-12 md:col-6">
                                <div className="text-sm text-color-secondary mb-1">Contato</div>
                                <div className="flex flex-column gap-1">
                                    <span><i className="pi pi-phone mr-2 text-color-secondary" />{fornecedorVisualizado.telefone || '-'}</span>
                                    <span><i className="pi pi-envelope mr-2 text-color-secondary" />{fornecedorVisualizado.email || '-'}</span>
                                </div>
                            </div>
                            <div className="col-12 md:col-6">
                                <div className="text-sm text-color-secondary mb-1">Documentos</div>
                                <div className="flex flex-column gap-1">
                                    {fornecedorVisualizado.cnpj && <span><strong>CNPJ:</strong> {fornecedorVisualizado.cnpj}</span>}
                                    {fornecedorVisualizado.cpf && <span><strong>CPF:</strong> {fornecedorVisualizado.cpf}</span>}
                                    {fornecedorVisualizado.inscricao_estadual && <span><strong>IE:</strong> {fornecedorVisualizado.inscricao_estadual}</span>}
                                    {!fornecedorVisualizado.cnpj && !fornecedorVisualizado.cpf && <span className="text-color-secondary">-</span>}
                                </div>
                            </div>
                        </div>
                        {fornecedorVisualizado.rua && (
                            <div className="mb-3">
                                <div className="text-sm text-color-secondary mb-1">Endereço</div>
                                <span>
                                    {fornecedorVisualizado.rua}, {fornecedorVisualizado.numero}
                                    {fornecedorVisualizado.complemento ? ` — ${fornecedorVisualizado.complemento}` : ''}
                                    {' · '}{fornecedorVisualizado.bairro}, {fornecedorVisualizado.cidade}/{fornecedorVisualizado.estado}
                                    {fornecedorVisualizado.cep ? ` · CEP ${fornecedorVisualizado.cep}` : ''}
                                </span>
                            </div>
                        )}

                        <Divider />

                        {/* Estatísticas de pedidos */}
                        <h6 className="mb-3">Pedidos</h6>
                        {loadingPedidos ? (
                            <div className="flex align-items-center justify-content-center py-4">
                                <i className="pi pi-spin pi-spinner mr-2" /> Carregando pedidos...
                            </div>
                        ) : (
                            <>
                                <div className="grid mb-3">
                                    <div className="col-6 md:col-3">
                                        <div className="p-3 border-round text-center" style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)' }}>
                                            <div className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{estatisticasPedidos.total}</div>
                                            <div className="text-xs text-color-secondary mt-1">Total</div>
                                        </div>
                                    </div>
                                    <div className="col-6 md:col-3">
                                        <div className="p-3 border-round text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                            <div className="text-2xl font-bold" style={{ color: '#16a34a' }}>{estatisticasPedidos.recebidos}</div>
                                            <div className="text-xs text-color-secondary mt-1">Recebidos</div>
                                        </div>
                                    </div>
                                    <div className="col-6 md:col-3">
                                        <div className="p-3 border-round text-center" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                                            <div className="text-2xl font-bold" style={{ color: '#d97706' }}>{estatisticasPedidos.pendentes}</div>
                                            <div className="text-xs text-color-secondary mt-1">Pendentes</div>
                                        </div>
                                    </div>
                                    <div className="col-6 md:col-3">
                                        <div className="p-3 border-round text-center" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                                            <div className="text-2xl font-bold" style={{ color: '#dc2626' }}>{estatisticasPedidos.cancelados}</div>
                                            <div className="text-xs text-color-secondary mt-1">Cancelados</div>
                                        </div>
                                    </div>
                                </div>

                                {estatisticasPedidos.valorTotal > 0 && (
                                    <div className="p-3 border-round mb-3 flex justify-content-between align-items-center" style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)' }}>
                                        <span className="font-semibold">Valor total em pedidos</span>
                                        <span className="text-xl font-bold" style={{ color: 'var(--primary-color)' }}>{fmtMoeda(estatisticasPedidos.valorTotal)}</span>
                                    </div>
                                )}

                                {pedidosFornecedor.length > 0 ? (
                                    <DataTable value={pedidosFornecedor} paginator rows={5} size="small" emptyMessage="Nenhum pedido encontrado.">
                                        <Column header="#" body={(_: any, opts: any) => opts.rowIndex + 1} style={{ width: '3rem' }} />
                                        <Column header="Data" body={(p: any) => { try { return new Date(p.data_pedido ?? p.createdAt).toLocaleDateString('pt-BR'); } catch { return '-'; } }} sortable sortField="data_pedido" />
                                        <Column header="Valor" body={(p: any) => fmtMoeda(Number(p.valor_total ?? 0))} sortable sortField="valor_total" />
                                        <Column header="Status" body={(p: any) => {
                                            const s = p.status ?? 'pendente';
                                            const map: Record<string, { label: string; severity: any }> = {
                                                pendente: { label: 'Pendente', severity: 'warning' },
                                                em_transito: { label: 'Em trânsito', severity: 'info' },
                                                recebido: { label: 'Recebido', severity: 'success' },
                                                entregue: { label: 'Entregue', severity: 'success' },
                                                cancelado: { label: 'Cancelado', severity: 'danger' },
                                            };
                                            const info = map[s] ?? { label: s, severity: 'secondary' };
                                            return <Tag value={info.label} severity={info.severity} />;
                                        }} />
                                    </DataTable>
                                ) : (
                                    <div className="text-center py-4 text-color-secondary">
                                        <i className="pi pi-inbox text-3xl mb-2" style={{ display: 'block', opacity: 0.4 }} />
                                        Nenhum pedido registrado para este fornecedor.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default FornecedoresPage;
