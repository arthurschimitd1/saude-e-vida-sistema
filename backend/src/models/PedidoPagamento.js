import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PedidoPagamento = sequelize.define('PedidoPagamento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    pedido_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'pedidos', key: 'id' }
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'empresas', key: 'id' }
    },
    valor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    data_pagamento: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    observacao: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'pedido_pagamentos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default PedidoPagamento;
