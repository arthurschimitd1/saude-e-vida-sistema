import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Pedido = sequelize.define('Pedido', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'empresas', key: 'id' }
    },
    numero: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    fornecedor: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    fornecedor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'fornecedores', key: 'id' }
    },
    status: {
        type: DataTypes.ENUM('pendente', 'aprovado', 'em_processamento', 'recebido', 'cancelado'),
        allowNull: false,
        defaultValue: 'pendente'
    },
    data_pedido: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    data_previsao: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    valor_total: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    controle_financeiro_ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: null
    },
    observacao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    itens: {
        type: DataTypes.JSONB,
        defaultValue: []
    }
}, {
    tableName: 'pedidos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Pedido;
