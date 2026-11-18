import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CentroCustoProjeto = sequelize.define('CentroCustoProjeto', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    centro_custo_id: { type: DataTypes.INTEGER, allowNull: false },
    nome: { type: DataTypes.STRING, allowNull: false },
    descricao: { type: DataTypes.TEXT },
    budget: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
    tableName: 'centro_custo_projetos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default CentroCustoProjeto;