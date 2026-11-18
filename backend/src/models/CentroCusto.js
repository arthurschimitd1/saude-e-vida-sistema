import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CentroCusto = sequelize.define('CentroCusto', {
    id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nome:       { type: DataTypes.STRING(255), allowNull: false },
    descricao:  { type: DataTypes.TEXT },
    budget:     { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
    tableName: 'centros_de_custos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default CentroCusto;