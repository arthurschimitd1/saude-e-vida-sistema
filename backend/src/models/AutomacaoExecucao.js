import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AutomacaoExecucao = sequelize.define('AutomacaoExecucao', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    regra_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    evento: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    resultado: {
        type: DataTypes.ENUM('sucesso', 'falha'),
        allowNull: false
    },
    duracao_ms: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    detalhes: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
    },
    erro_mensagem: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'automacao_execucoes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default AutomacaoExecucao;