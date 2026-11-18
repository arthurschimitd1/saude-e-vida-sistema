import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AutomacaoNotificacao = sequelize.define('AutomacaoNotificacao', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    regra_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tipo: {
        type: DataTypes.ENUM('info', 'erro', 'alerta'),
        allowNull: false,
        defaultValue: 'info'
    },
    titulo: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    mensagem: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    lida: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'automacao_notificacoes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default AutomacaoNotificacao;