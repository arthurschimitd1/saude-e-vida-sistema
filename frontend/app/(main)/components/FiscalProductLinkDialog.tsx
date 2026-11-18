'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import {
    FiscalImportAction,
    FiscalImportDecision,
    FiscalImportItem,
    FiscalImportPreview
} from '../services/api/fiscalStockImportService';

interface RowDecision extends FiscalImportDecision {
    item: FiscalImportItem;
}

interface Props {
    visible: boolean;
    preview: FiscalImportPreview | null;
    saving?: boolean;
    onHide: () => void;
    onConfirm: (decisions: FiscalImportDecision[]) => void | Promise<void>;
}

const actionOptions = [
    { label: 'Vincular ao produto existente', value: 'link' },
    { label: 'Criar produto novo', value: 'create' },
    { label: 'Ignorar este item', value: 'skip' }
];

const FiscalProductLinkDialog = ({ visible, preview, saving = false, onHide, onConfirm }: Props) => {
    const [rows, setRows] = useState<RowDecision[]>([]);

    useEffect(() => {
        setRows((preview?.items ?? []).map(item => ({
            item,
            item_key: item.item_key,
            action: item.suggested_product_id ? 'link' : 'create',
            product_id: item.suggested_product_id ?? null,
            new_name: item.description
        })));
    }, [preview]);

    const productOptions = useMemo(() => (preview?.products ?? []).map(product => ({
        label: `${product.name}${product.code ? ` · ${product.code}` : ''} · estoque ${product.currentQuantity}`,
        value: product.id
    })), [preview]);

    const updateRow = (itemKey: string, patch: Partial<RowDecision>) => {
        setRows(current => current.map(row =>
            row.item_key === itemKey ? { ...row, ...patch } : row
        ));
    };

    const invalid = rows.every(row => row.action === 'skip') || rows.some(row =>
        (row.action === 'link' && !row.product_id)
        || (row.action === 'create' && !row.new_name?.trim())
    );

    const itemTemplate = (row: RowDecision) => (
        <div>
            <div className="font-semibold">{row.item.description}</div>
            <small className="text-color-secondary">
                {row.item.external_code ? `Código ${row.item.external_code}` : 'Sem código'}
                {row.item.ncm ? ` · NCM ${row.item.ncm}` : ''}
            </small>
            {row.item.suggestion_reason && (
                <div className="mt-1">
                    <Tag value={row.item.suggestion_reason} severity="info" />
                </div>
            )}
        </div>
    );

    const quantityTemplate = (row: RowDecision) => (
        <div>
            <strong>{Number(row.item.quantity).toLocaleString('pt-BR')}</strong>
            <span className="ml-1">{row.item.commercial_unit || 'UN'}</span>
            <small className="block text-color-secondary">
                Compra: {Number(row.item.unit_cost).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                })}
            </small>
        </div>
    );

    const actionTemplate = (row: RowDecision) => (
        <Dropdown
            value={row.action}
            options={actionOptions}
            onChange={event => updateRow(row.item_key, {
                action: event.value as FiscalImportAction,
                product_id: event.value === 'link' ? row.product_id : null,
                new_name: event.value === 'create' ? (row.new_name || row.item.description) : row.new_name
            })}
            className="w-full"
        />
    );

    const destinationTemplate = (row: RowDecision) => {
        if (row.action === 'skip') {
            return <span className="text-color-secondary">Não altera o estoque</span>;
        }
        if (row.action === 'create') {
            return (
                <InputText
                    value={row.new_name ?? ''}
                    onChange={event => updateRow(row.item_key, { new_name: event.target.value })}
                    placeholder="Nome do novo produto"
                    className="w-full"
                />
            );
        }
        return (
            <Dropdown
                value={row.product_id}
                options={productOptions}
                onChange={event => updateRow(row.item_key, { product_id: event.value })}
                placeholder="Pesquise o produto do sistema"
                filter
                showClear
                className="w-full"
                emptyMessage="Nenhum produto cadastrado"
                emptyFilterMessage="Nenhum produto encontrado"
            />
        );
    };

    const footer = (
        <div className="flex justify-content-between align-items-center w-full gap-2">
            <span className="text-sm text-color-secondary">
                Nenhuma alteração será feita antes da confirmação.
            </span>
            <div className="flex gap-2">
                <Button label="Cancelar" icon="pi pi-times" text onClick={onHide} disabled={saving} />
                <Button
                    label="Confirmar entrada"
                    icon="pi pi-check"
                    onClick={() => onConfirm(rows.map(({ item, ...decision }) => decision))}
                    loading={saving}
                    disabled={!preview || preview.already_imported || invalid || saving}
                />
            </div>
        </div>
    );

    return (
        <Dialog
            header="Vincular produtos da nota"
            visible={visible}
            onHide={onHide}
            modal
            maximizable
            style={{ width: 'min(1120px, 96vw)' }}
            contentStyle={{ padding: '1.25rem' }}
            footer={footer}
            closable={!saving}
        >
            {preview && (
                <>
                    <div className="flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
                        <div>
                            <div className="text-lg font-semibold">
                                NF-e {preview.invoice_number || 'sem número'}
                            </div>
                            <div className="text-color-secondary">
                                {preview.supplier_name || 'Emitente não informado'}
                                {preview.supplier_document ? ` · ${preview.supplier_document}` : ''}
                            </div>
                        </div>
                        <Tag
                            value={`${preview.items.length} item${preview.items.length === 1 ? '' : 's'}`}
                            severity="info"
                        />
                    </div>

                    {preview.already_imported && (
                        <div className="p-3 mb-3 border-1 border-orange-200 bg-orange-50 text-orange-800 border-round">
                            <i className="pi pi-exclamation-triangle mr-2" />
                            Esta nota já foi importada. Uma nova entrada foi bloqueada para evitar estoque duplicado.
                        </div>
                    )}

                    <DataTable
                        value={rows}
                        dataKey="item_key"
                        stripedRows
                        responsiveLayout="scroll"
                        emptyMessage="Nenhum item encontrado na nota"
                        tableStyle={{ minWidth: '920px' }}
                    >
                        <Column header="Produto na nota" body={itemTemplate} style={{ minWidth: '250px' }} />
                        <Column header="Entrada" body={quantityTemplate} style={{ width: '150px' }} />
                        <Column header="O que fazer" body={actionTemplate} style={{ minWidth: '220px' }} />
                        <Column header="Produto no catálogo" body={destinationTemplate} style={{ minWidth: '310px' }} />
                    </DataTable>
                </>
            )}
        </Dialog>
    );
};

export default FiscalProductLinkDialog;
