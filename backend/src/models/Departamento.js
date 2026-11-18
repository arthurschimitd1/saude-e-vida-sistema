import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Departamento = sequelize.define('Departamento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nome: { type: DataTypes.STRING, allowNull: false },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
    tableName: 'departamentos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default Departamento;