import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AgendamentoColaborador = sequelize.define('AgendamentoColaborador', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'agendamento_unidades', key: 'id' }
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
        type: DataTypes.STRING(200),
        allowNull: false
    },
    cor: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '#3b82f6'
    },
    ordem: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'agendamento_colaboradores',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default AgendamentoColaborador;
