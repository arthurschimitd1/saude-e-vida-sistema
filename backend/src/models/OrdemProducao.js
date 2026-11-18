import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const OrdemProducao = sequelize.define('OrdemProducao', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    receita_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    quantidade: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1
    },
    quantidade_final: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: null
    },
    quantidade_produzida: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: null
    },
    itens_consumidos: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: 'Snapshot do consumo real de cada insumo registrado ao concluir a ordem'
    },
    status: {
        // pendente | concluida | cancelada | desfeita
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pendente'
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    observacao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    classificacao_desperdicio: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    observacao_desperdicio: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'ordens_producao',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default OrdemProducao;
