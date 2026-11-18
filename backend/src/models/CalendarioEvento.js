import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CalendarioEvento = sequelize.define('CalendarioEvento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    titulo: {
        type: DataTypes.STRING(300),
        allowNull: false
    },
    descricao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    data_inicio: {
        type: DataTypes.DATE,
        allowNull: false
    },
    data_fim: {
        type: DataTypes.DATE,
        allowNull: true
    },
    responsavel: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    tipo: {
        type: DataTypes.ENUM('lembrete', 'reuniao', 'evento', 'prazo'),
        allowNull: false,
        defaultValue: 'evento'
    },
    cor: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: '#3b82f6'
    },
    dia_todo: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'calendario_eventos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default CalendarioEvento;
