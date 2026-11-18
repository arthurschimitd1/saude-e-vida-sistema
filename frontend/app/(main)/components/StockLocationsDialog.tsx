'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from '@/app/(main)/components/MobileFriendlyInputNumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { TabPanel, TabView } from 'primereact/tabview';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import {
    ProductLocationBalance,
    StockLocation,
    stockLocationService
} from '../services/api/stockLocationService';

type Props = {
    visible: boolean;
    onHide: () => void;
    onTransferred: () => void | Promise<void>;
};

const tipos = [
    { label: 'Filial / loja', value: 'filial', icon: 'pi pi-shopping-bag' },
    { label: 'Depósito', value: 'deposito', icon: 'pi pi-box' },
    { label: 'Produção', value: 'producao', icon: 'pi pi-cog' }
];

const rotuloTipo = (tipo: string) => tipos.find(item => item.value === tipo)?.label || 'Matriz';
const iconeTipo = (tipo: string) => tipos.find(item => item.value === tipo)?.icon || 'pi pi-building';
const formatarQuantidade = (valor: number) => Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
});

export default function StockLocationsDialog({ visible, onHide, onTransferred }: Props) {
    const toast = useRef<Toast>(null);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [balances, setBalances] = useState<ProductLocationBalance[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [nome, setNome] = useState('');
    const [tipo, setTipo] = useState('filial');
    const [endereco, setEndereco] = useState('');
    const [produtoId, setProdutoId] = useState<number | null>(null);
    const [origemId, setOrigemId] = useState<number | null>(null);
    const [destinoId, setDestinoId] = useState<number | null>(null);
    const [quantidade, setQuantidade] = useState<number | null>(null);
    const [observacao, setObservacao] = useState('');

    const mostrarErro = (error: any, fallback: string) => toast.current?.show({
        severity: 'error', summary: 'Operação não realizada', detail: error?.response?.data?.error || fallback, life: 5000
    });

    const carregar = async () => {
        setLoading(true);
        try {
            const [unidades, saldos] = await Promise.all([
                stockLocationService.list(),
                stockLocationService.balances()
            ]);
            setLocations(unidades);
            setBalances(saldos);
            setOrigemId(atual => atual ?? unidades.find(item => item.principal)?.id ?? null);
        } catch (error) {
            mostrarErro(error, 'Não foi possível carregar as unidades.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible) void carregar();
    }, [visible]);

    const ativas = locations.filter(item => item.ativo);
    const produto = balances.find(item => item.produto_id === produtoId);
    const origem = locations.find(item => item.id === origemId);
    const destino = locations.find(item => item.id === destinoId);
    const saldoOrigem = useMemo(() => Number(
        balances.find(item => item.produto_id === produtoId)?.saldos
            .find(item => item.unidade_id === origemId)?.quantidade || 0
    ), [balances, produtoId, origemId]);
    const quantidadeInformada = Number(quantidade || 0);
    const quantidadeInvalida = quantidadeInformada <= 0 || quantidadeInformada > saldoOrigem;
    const podeTransferir = Boolean(produtoId && origemId && destinoId && !quantidadeInvalida);

    const criarUnidade = async () => {
        if (!nome.trim()) return;
        setLoading(true);
        try {
            await stockLocationService.create({ nome: nome.trim(), tipo, endereco: endereco.trim() });
            setNome('');
            setEndereco('');
            setTipo('filial');
            await carregar();
            toast.current?.show({
                severity: 'success', summary: 'Unidade cadastrada',
                detail: 'A unidade foi criada com estoque inicial zerado.'
            });
        } catch (error) {
            mostrarErro(error, 'Não foi possível cadastrar a unidade.');
            setLoading(false);
        }
    };

    const alternarUnidade = async (unidade: StockLocation) => {
        setLoading(true);
        try {
            await stockLocationService.update(unidade.id, { ativo: !unidade.ativo });
            await carregar();
            toast.current?.show({
                severity: 'success', summary: unidade.ativo ? 'Unidade desativada' : 'Unidade reativada',
                detail: `${unidade.nome} foi atualizada com sucesso.`
            });
        } catch (error) {
            mostrarErro(error, 'Não foi possível alterar a unidade.');
            setLoading(false);
        }
    };

    const transferir = async () => {
        if (!podeTransferir || !produtoId || !origemId || !destinoId || !quantidade) return;
        setLoading(true);
        try {
            const resultado = await stockLocationService.transfer({
                produto_id: produtoId,
                unidade_origem_id: origemId,
                unidade_destino_id: destinoId,
                quantidade,
                observacao
            });
            setQuantidade(null);
            setObservacao('');
            await carregar();
            await onTransferred();
            toast.current?.show({
                severity: 'success', summary: 'Transferência concluída',
                detail: `${formatarQuantidade(resultado.quantidade)} transferido de ${resultado.origem.nome} para ${resultado.destino.nome}.`,
                life: 5000
            });
        } catch (error) {
            mostrarErro(error, 'A transferência não foi concluída.');
            setLoading(false);
        }
    };

    const header = (
        <div className="flex align-items-center gap-3">
            <div className="flex align-items-center justify-content-center border-round-xl"
                style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff' }}>
                <i className="pi pi-building" style={{ fontSize: '1.25rem' }} />
            </div>
            <div>
                <div className="font-bold text-xl">Gestão de unidades</div>
                <div className="text-sm text-color-secondary font-normal">Distribuição e transferência segura de estoque</div>
            </div>
        </div>
    );

    return (
        <Dialog visible={visible} onHide={onHide} header={header} modal maximizable
            style={{ width: 'min(1040px, 96vw)' }} contentStyle={{ padding: '0 1.5rem 1.5rem' }}>
            <Toast ref={toast} />

            <div className="flex align-items-center justify-content-between gap-3 flex-wrap p-3 mb-3 border-round-xl"
                style={{ background: 'linear-gradient(90deg,#eff6ff,#eef2ff)', border: '1px solid #c7d2fe' }}>
                <div className="flex align-items-center gap-3">
                    <i className="pi pi-shield text-primary" style={{ fontSize: '1.35rem' }} />
                    <div>
                        <strong className="block text-900">Operação protegida e rastreável</strong>
                        <small className="text-color-secondary">O estoque atual permanece na Unidade principal. Toda transferência gera histórico.</small>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Tag value={`${locations.filter(item => item.ativo).length} ativas`} severity="success" rounded />
                    <Tag value={`${balances.length} produtos`} severity="info" rounded />
                </div>
            </div>

            <TabView activeIndex={activeTab} onTabChange={event => setActiveTab(event.index)}>
                <TabPanel header="Nova transferência" leftIcon="pi pi-arrow-right-arrow-left mr-2">
                    <div className="grid">
                        <div className="col-12 lg:col-8">
                            <div className="border-1 surface-border border-round-xl p-4 h-full">
                                <div className="flex align-items-center gap-2 mb-4">
                                    <span className="flex align-items-center justify-content-center border-circle bg-primary text-white font-bold" style={{ width: 28, height: 28 }}>1</span>
                                    <div><strong className="block">Defina o produto e o trajeto</strong><small className="text-color-secondary">Escolha de qual unidade o saldo sairá e qual unidade receberá.</small></div>
                                </div>
                                <div className="grid formgrid">
                                    <div className="col-12 field">
                                        <label className="font-semibold block mb-2">Produto</label>
                                        <Dropdown value={produtoId} onChange={event => setProdutoId(event.value)}
                                            options={balances} optionLabel="produto_nome" optionValue="produto_id" filter
                                            filterPlaceholder="Buscar produto ou SKU" placeholder="Selecione um produto"
                                            emptyMessage="Nenhum produto encontrado" className="w-full" />
                                    </div>
                                    <div className="col-12 md:col-5 field">
                                        <label className="font-semibold block mb-2">Unidade de origem</label>
                                        <Dropdown value={origemId} onChange={event => {
                                            setOrigemId(event.value);
                                            if (event.value === destinoId) setDestinoId(null);
                                        }} options={ativas} optionLabel="nome" optionValue="id" className="w-full" />
                                    </div>
                                    <div className="col-12 md:col-2 flex align-items-center justify-content-center pt-3">
                                        <div className="flex align-items-center justify-content-center border-circle surface-100 text-primary" style={{ width: 42, height: 42 }}>
                                            <i className="pi pi-arrow-right" />
                                        </div>
                                    </div>
                                    <div className="col-12 md:col-5 field">
                                        <label className="font-semibold block mb-2">Unidade de destino</label>
                                        <Dropdown value={destinoId} onChange={event => setDestinoId(event.value)}
                                            options={ativas.filter(item => item.id !== origemId)} optionLabel="nome" optionValue="id"
                                            placeholder="Selecione o destino" className="w-full" />
                                    </div>
                                    <div className="col-12 md:col-4 field">
                                        <label className="font-semibold block mb-2">Quantidade</label>
                                        <InputNumber value={quantidade} onValueChange={event => setQuantidade(event.value ?? null)}
                                            min={0} maxFractionDigits={3} useGrouping className="w-full" inputClassName="w-full"
                                            placeholder="0" suffix={produto ? ` ${produto.unidade_medida || 'UN'}` : undefined} />
                                        <small className={quantidadeInformada > saldoOrigem ? 'text-red-500' : 'text-color-secondary'}>
                                            Disponível: <strong>{formatarQuantidade(saldoOrigem)} {produto?.unidade_medida || 'UN'}</strong>
                                        </small>
                                    </div>
                                    <div className="col-12 md:col-8 field">
                                        <label className="font-semibold block mb-2">Observação <span className="font-normal text-color-secondary">(opcional)</span></label>
                                        <InputTextarea value={observacao} onChange={event => setObservacao(event.target.value)}
                                            rows={2} maxLength={500} autoResize className="w-full" placeholder="Ex.: reposição semanal da filial" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-12 lg:col-4">
                            <div className="border-1 surface-border border-round-xl p-4 h-full flex flex-column">
                                <div className="flex align-items-center gap-2 mb-4">
                                    <span className="flex align-items-center justify-content-center border-circle bg-primary text-white font-bold" style={{ width: 28, height: 28 }}>2</span>
                                    <div><strong className="block">Revise e confirme</strong><small className="text-color-secondary">Confira todos os dados antes de movimentar o estoque.</small></div>
                                </div>
                                <div className="surface-50 border-round-lg p-3 mb-3">
                                    <small className="text-color-secondary block mb-1">Produto</small>
                                    <strong>{produto?.produto_nome || 'Não selecionado'}</strong>
                                    {produto?.produto_codigo && <small className="block text-color-secondary mt-1">SKU {produto.produto_codigo}</small>}
                                </div>
                                <div className="flex align-items-center gap-2 mb-3">
                                    <div className="flex-1 surface-50 border-round-lg p-3 overflow-hidden">
                                        <small className="text-color-secondary block">Origem</small>
                                        <strong className="block white-space-nowrap overflow-hidden text-overflow-ellipsis">{origem?.nome || '—'}</strong>
                                    </div>
                                    <i className="pi pi-arrow-right text-primary" />
                                    <div className="flex-1 surface-50 border-round-lg p-3 overflow-hidden">
                                        <small className="text-color-secondary block">Destino</small>
                                        <strong className="block white-space-nowrap overflow-hidden text-overflow-ellipsis">{destino?.nome || '—'}</strong>
                                    </div>
                                </div>
                                <div className="p-3 border-round-lg mb-4" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                                    <small className="block mb-1" style={{ color: '#047857' }}>Quantidade a transferir</small>
                                    <strong className="text-2xl" style={{ color: '#065f46' }}>
                                        {formatarQuantidade(quantidadeInformada)} {produto?.unidade_medida || 'UN'}
                                    </strong>
                                </div>
                                {quantidadeInformada > saldoOrigem && (
                                    <div className="flex gap-2 text-red-600 text-sm mb-3"><i className="pi pi-exclamation-circle mt-1" /><span>Quantidade maior que o saldo disponível.</span></div>
                                )}
                                <Button label="Confirmar transferência" icon="pi pi-check" iconPos="right"
                                    loading={loading} disabled={!podeTransferir} onClick={transferir}
                                    className="w-full mt-auto" size="large" />
                            </div>
                        </div>
                    </div>
                </TabPanel>

                <TabPanel header="Cadastro de unidades" leftIcon="pi pi-building mr-2">
                    <div className="border-1 surface-border border-round-xl p-4 mb-4">
                        <div className="flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                            <div><strong className="text-lg block">Cadastrar nova unidade</strong><small className="text-color-secondary">Filiais, depósitos e centros de produção iniciam com saldo zero.</small></div>
                            <Tag value="Estoque inicial: 0" icon="pi pi-info-circle" severity="info" rounded />
                        </div>
                        <div className="grid formgrid align-items-end">
                            <div className="col-12 md:col-4 field mb-0"><label className="font-semibold block mb-2">Nome da unidade</label><InputText value={nome} onChange={event => setNome(event.target.value)} maxLength={120} placeholder="Ex.: Filial Centro" className="w-full" /></div>
                            <div className="col-12 md:col-3 field mb-0"><label className="font-semibold block mb-2">Tipo</label><Dropdown value={tipo} onChange={event => setTipo(event.value)} options={tipos} className="w-full" /></div>
                            <div className="col-12 md:col-3 field mb-0"><label className="font-semibold block mb-2">Endereço <span className="font-normal text-color-secondary">(opcional)</span></label><InputText value={endereco} onChange={event => setEndereco(event.target.value)} maxLength={255} className="w-full" /></div>
                            <div className="col-12 md:col-2 field mb-0"><Button label="Adicionar" icon="pi pi-plus" loading={loading} disabled={!nome.trim()} onClick={criarUnidade} className="w-full" /></div>
                        </div>
                    </div>

                    <div className="flex justify-content-between align-items-center mb-3"><strong>Unidades cadastradas</strong><span className="text-sm text-color-secondary">{locations.length} no total</span></div>
                    <div className="grid">
                        {locations.map(unidade => (
                            <div key={unidade.id} className="col-12 md:col-6">
                                <div className={`border-1 border-round-xl p-3 h-full ${unidade.ativo ? 'surface-border' : 'border-gray-300 surface-100'}`}>
                                    <div className="flex justify-content-between align-items-start gap-3">
                                        <div className="flex gap-3 min-w-0">
                                            <div className="flex align-items-center justify-content-center border-round-lg surface-100 text-primary flex-shrink-0" style={{ width: 44, height: 44 }}><i className={iconeTipo(unidade.tipo)} /></div>
                                            <div className="min-w-0"><strong className="block text-lg white-space-nowrap overflow-hidden text-overflow-ellipsis">{unidade.nome}</strong><small className="text-color-secondary">{rotuloTipo(unidade.tipo)}</small>{unidade.endereco && <small className="block text-color-secondary mt-1"><i className="pi pi-map-marker mr-1" />{unidade.endereco}</small>}</div>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">{unidade.principal ? <Tag value="Principal" icon="pi pi-star-fill" severity="info" rounded /> : <Tag value={unidade.ativo ? 'Ativa' : 'Inativa'} severity={unidade.ativo ? 'success' : 'danger'} rounded />}</div>
                                    </div>
                                    {!unidade.principal && <div className="flex justify-content-end mt-3 pt-3 border-top-1 surface-border"><Button label={unidade.ativo ? 'Desativar unidade' : 'Reativar unidade'} icon={unidade.ativo ? 'pi pi-ban' : 'pi pi-check-circle'} severity={unidade.ativo ? 'secondary' : 'success'} outlined size="small" loading={loading} onClick={() => alternarUnidade(unidade)} /></div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </TabPanel>

                <TabPanel header="Saldos por unidade" leftIcon="pi pi-chart-bar mr-2">
                    <div className="flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
                        <div><strong className="text-lg block">Estoque distribuído</strong><small className="text-color-secondary">Comparativo de saldos por unidade.</small></div>
                        <Button label="Atualizar saldos" icon="pi pi-refresh" severity="secondary" outlined loading={loading} onClick={carregar} />
                    </div>
                    <div className="overflow-auto border-1 surface-border border-round-xl">
                        <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 720 }}>
                            <thead style={{ background: 'var(--surface-100)' }}><tr><th className="text-left p-3">Produto</th>{locations.map(unidade => <th key={unidade.id} className="text-right p-3"><span className="block">{unidade.nome}</span>{unidade.principal && <small className="text-primary font-normal">Principal</small>}</th>)}<th className="text-right p-3">Total</th></tr></thead>
                            <tbody>{balances.length === 0 ? <tr><td colSpan={locations.length + 2} className="text-center p-6 text-color-secondary"><i className="pi pi-inbox block mb-2 text-2xl" />Nenhum produto disponível.</td></tr> : balances.map(item => <tr key={item.produto_id}><td className="p-3 border-top-1 surface-border"><strong>{item.produto_nome}</strong><small className="block text-color-secondary">{item.produto_codigo ? `SKU ${item.produto_codigo}` : 'Sem SKU'}</small></td>{locations.map(unidade => <td key={unidade.id} className="text-right p-3 border-top-1 surface-border">{formatarQuantidade(Number(item.saldos.find(saldo => saldo.unidade_id === unidade.id)?.quantidade || 0))}</td>)}<td className="text-right p-3 border-top-1 surface-border"><Tag value={formatarQuantidade(item.total)} severity="info" rounded /></td></tr>)}</tbody>
                        </table>
                    </div>
                </TabPanel>
            </TabView>

            <div className="flex justify-content-end pt-3 mt-2 border-top-1 surface-border">
                <Button label="Fechar" icon="pi pi-times" severity="secondary" text onClick={onHide} />
            </div>
        </Dialog>
    );
}
