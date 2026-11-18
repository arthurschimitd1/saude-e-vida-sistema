import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const KanbanColuna = sequelize.define('KanbanColuna', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    nome: { type: DataTypes.STRING(80), allowNull: false },
    cor: { type: DataTypes.STRING(20), defaultValue: '#6b7280' },
    ordem: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 99 },
    integra_ponto: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
    tableName: 'kanban_colunas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default KanbanColuna;
