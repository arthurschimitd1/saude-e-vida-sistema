import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CentroCustoDepartamento = sequelize.define('CentroCustoDepartamento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    centro_custo_id: { type: DataTypes.INTEGER, allowNull: false },
    departamento_id: { type: DataTypes.INTEGER, allowNull: false },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
    tableName: 'centro_custo_departamentos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
});

export default CentroCustoDepartamento;