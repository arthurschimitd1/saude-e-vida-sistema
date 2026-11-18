'use client';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from '@/app/(main)/components/MobileFriendlyInputNumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { SelectButton } from 'primereact/selectbutton';
import { useEffect, useState } from 'react';
import {
    financeiroService,
    LancamentoConsolidado,
    CATEGORIAS_ENTRADA,
    CATEGORIAS_SAIDA,
} from '../../services/api/financeiroService';
import { formatarDataParaApi, parseDataCivil } from '../utils/dataLocal';

interface NovoLancamentoModalProps {
    visible: boolean;
    onHide: () => void;
    onSalvo: () => void;
    naturezaDefault?: 'ENTRADA' | 'SAIDA';
    editar?: LancamentoConsolidado | null;
    onErro?: (mensagem: string) => void;
}

const NATUREZA_OPTIONS = [
    { label: 'Entrada', value: 'ENTRADA' },
    { label: 'Saída', value: 'SAIDA' },
];

const initForm = (natureza: 'ENTRADA' | 'SAIDA') => ({
    natureza,
    tipo: '',
    descricao: '',
    data: new Date(),
    valor: 0,
    centro_custo_id: null as number | null,
});

export default function NovoLancamentoModal({
    visible, onHide, onSalvo, naturezaDefault = 'SAIDA', editar, onErro,
}: NovoLancamentoModalProps) {
    const [form, setForm] = useState(initForm(naturezaDefault));
    const [salvando, setSalvando] = useState(false);
    const [centros, setCentros] = useState<{ label: string; value: number }[]>([]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const empresaId = localStorage.getItem('empresa_selecionada');
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (empresaId) headers['X-Empresa-Override'] = empresaId;

        fetch(`${API}/api/centros-de-custos`, { headers })
            .then(r => r.json())
            .then(d => {
                const lista = d.data ?? d;
                setCentros(lista.map((c: { id: number; nome: string }) => ({ label: c.nome, value: c.id })));
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!visible) return;
        if (editar) {
            setForm({
                natureza: editar.natureza ?? naturezaDefault,
                tipo: editar.tipo ?? '',
                descricao: editar.descricao ?? '',
                data: editar.data ? parseDataCivil(editar.data) : new Date(),
                valor: editar.valor ?? 0,
                centro_custo_id: (editar as any).centro_custo_id ?? null,
            });
        } else {
            setForm(initForm(naturezaDefault));
        }
    }, [visible, editar, naturezaDefault]);

    const categorias = form.natureza === 'ENTRADA' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;

    const salvar = async () => {
        if (!form.tipo || !form.valor) {
            onErro?.('Preencha categoria e valor');
            return;
        }
        setSalvando(true);
        try {
            const payload = {
                tipo: form.tipo,
                natureza: form.natureza as 'ENTRADA' | 'SAIDA',
                descricao: form.descricao,
                data: formatarDataParaApi(form.data),
                valor: form.valor,
                ...(form.natureza === 'SAIDA' && form.centro_custo_id
                    ? { centro_custo_id: form.centro_custo_id }
                    : {}),
            };
            if (editar) {
                await financeiroService.atualizarLancamento(editar.id, payload);
            } else {
                await financeiroService.criarLancamento(payload);
            }
            onSalvo();
            onHide();
        } catch (err: any) {
            onErro?.(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Erro ao salvar lançamento');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Dialog
            header={editar ? 'Editar Lançamento' : 'Novo Lançamento'}
            visible={visible}
            style={{ width: '460px' }}
            modal
            onHide={onHide}
            footer={
                <div className="flex justify-content-end gap-2">
                    <Button label="Cancelar" icon="pi pi-times" text onClick={onHide} />
                    <Button label="Salvar" icon="pi pi-check" loading={salvando} onClick={salvar} />
                </div>
            }
        >
            <div className="grid p-fluid mt-1">
                <div className="col-12 field">
                    <label>Natureza *</label>
                    <SelectButton
                        value={form.natureza}
                        onChange={e => e.value && setForm(p => ({ ...p, natureza: e.value, tipo: '' }))}
                        options={NATUREZA_OPTIONS}
                        className="w-full"
                    />
                </div>
                <div className="col-12 field">
                    <label>Categoria *</label>
                    <Dropdown
                        value={form.tipo}
                        onChange={e => setForm(p => ({ ...p, tipo: e.value }))}
                        options={categorias}
                        editable
                        placeholder="Selecione ou digite"
                        className="w-full"
                    />
                </div>
                <div className="col-12 md:col-6 field">
                    <label>Data *</label>
                    <Calendar
                        value={form.data}
                        onChange={e => setForm(p => ({ ...p, data: (e.value as Date) ?? p.data }))}
                        dateFormat="dd/mm/yy"
                        showIcon
                        className="w-full"
                    />
                </div>
                <div className="col-12 md:col-6 field">
                    <label>Valor *</label>
                    <InputNumber
                        value={form.valor}
                        onValueChange={e => setForm(p => ({ ...p, valor: e.value ?? 0 }))}
                        mode="currency"
                        currency="BRL"
                        locale="pt-BR"
                        className="w-full"
                    />
                </div>
                <div className="col-12 field">
                    <label>Descrição</label>
                    <InputTextarea
                        value={form.descricao}
                        onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                        rows={3}
                        className="w-full"
                    />
                </div>
                {form.natureza === 'SAIDA' && (
                    <div className="col-12 field">
                        <label>Centro de Custo</label>
                        <Dropdown
                            value={form.centro_custo_id}
                            onChange={e => setForm(p => ({ ...p, centro_custo_id: e.value }))}
                            options={centros}
                            placeholder="Selecione (opcional)"
                            showClear
                            className="w-full"
                            emptyMessage="Nenhum centro cadastrado"
                        />
                    </div>
                )}
            </div>
        </Dialog>
    );
}
