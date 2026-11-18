import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const HistoricoPagamento = sequelize.define('HistoricoPagamento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    recorrencia_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'recorrencias',
            key: 'id'
        }
    },
    dataPagamento: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    dataVencimento: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    valor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: 'PENDENTE'
    },
    mesReferencia: {
        type: DataTypes.STRING(7), // Formato: YYYY-MM
        allowNull: false
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    asaasPaymentId: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'asaas_payment_id'
    },
    asaasStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'asaas_status'
    },
    asaasInvoiceUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'asaas_invoice_url'
    },
    asaasRefundStatus: { type: DataTypes.STRING(40), allowNull: true, field: 'asaas_refund_status' },
    asaasRefundedValue: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'asaas_refunded_value' },
    asaasBillingType: { type: DataTypes.STRING(40), allowNull: true, field: 'asaas_billing_type' },
    asaasPaymentPayload: { type: DataTypes.JSONB, allowNull: true, field: 'asaas_payment_payload' },
    reciboEmitidoAt: { type: DataTypes.DATE, allowNull: true, field: 'recibo_emitido_at' }
}, {
    tableName: 'historico_pagamentos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default HistoricoPagamento;
