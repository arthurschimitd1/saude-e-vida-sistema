import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ContratoHistorico = sequelize.define('ContratoHistorico', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    contrato_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'contratos',
            key: 'id'
        }
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    usuario_nome: {
        type: DataTypes.STRING,
        allowNull: true
    },
    campo_alterado: {
        type: DataTypes.STRING,
        allowNull: false
    },
    valor_anterior: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    valor_novo: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'contratos_historico',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

export default ContratoHistorico;