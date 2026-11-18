// backend/src/models/Recorrencia.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Recorrencia = sequelize.define('Recorrencia', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // NOVO: Referência ao cliente cadastrado
    cliente_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'clientes',
            key: 'id'
        },
        field: 'cliente_id'
    },
    // Mantido para compatibilidade e busca rápida
    nomeCliente: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'nome_cliente'
    },
    produto: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tipoTransacao: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'tipo_transacao',
        defaultValue: 'ENTRADA',
        validate: {
            isIn: [['ENTRADA', 'SAIDA']]
        }
    },
    tempoRecorrencia: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'tempo_recorrencia',
        defaultValue: 'MENSAL',
        validate: {
            isIn: [['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PERSONALIZADO']]
        }
    },
    subtipoRecorrencia: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'subtipo_recorrencia',
        validate: {
            isIn: [['SEMANAL', 'QUINZENAL', 'DIARIO']]
        }
    },
    valorMes: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'valor_mes'
    },
    // NOVO: Forma de pagamento (incluindo DINHEIRO)
    formaPagamento: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'PIX',
        field: 'forma_pagamento',
        validate: {
            isIn: [['DINHEIRO', 'NAO_INFORMADO', 'PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA']]
        }
    },
    bancoRecebimento: {
        type: DataTypes.STRING,
        allowNull: true,  // Agora opcional para DINHEIRO
        field: 'banco_recebimento'
    },
    bancoNome: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'banco_nome'
    },
    bancoAgencia: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'banco_agencia'
    },
    bancoConta: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'banco_conta'
    },
    bancoPix: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'banco_pix'
    },
    dataInicio: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'data_inicio'
    },
    dataFim: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'data_fim'
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    ultimoPagamento: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'ultimo_pagamento'
    },
    proximoVencimento: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'proximo_vencimento'
    },
    // NOVO: Observações
    observacoes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'observacoes'
    },
    servicosInclusos: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
        field: 'servicos_inclusos'
    },
    asaasCustomerId: { type: DataTypes.STRING(80), allowNull: true, field: 'asaas_customer_id' },
    asaasSubscriptionId: { type: DataTypes.STRING(80), allowNull: true, field: 'asaas_subscription_id' },
    asaasPaymentLinkId: { type: DataTypes.STRING(80), allowNull: true, field: 'asaas_payment_link_id' },
    asaasPaymentLinkUrl: { type: DataTypes.TEXT, allowNull: true, field: 'asaas_payment_link_url' },
    asaasStatus: { type: DataTypes.STRING(50), allowNull: true, field: 'asaas_status' },
    asaasLastSyncedAt: { type: DataTypes.DATE, allowNull: true, field: 'asaas_last_synced_at' },
    statusRecorrencia: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'ATIVA', field: 'status_recorrencia' },
    asaasSubscriptionStatus: { type: DataTypes.STRING(50), allowNull: true, field: 'asaas_subscription_status' },
    asaasSyncStatus: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'NAO_CONFIGURADO', field: 'asaas_sync_status' },
    asaasSyncError: { type: DataTypes.TEXT, allowNull: true, field: 'asaas_sync_error' },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'empresas',
            key: 'id'
        }
    }
}, {
    tableName: 'recorrencias',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Recorrencia;
