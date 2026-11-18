import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const OrcamentoFinanceiro = sequelize.define('OrcamentoFinanceiro', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    mes: { type: DataTypes.INTEGER, allowNull: false },
    ano: { type: DataTypes.INTEGER, allowNull: false },
    categoria: { type: DataTypes.STRING, allowNull: false },
    tipo: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: { isIn: [['ENTRADA', 'SAIDA']] }
    },
    valor_previsto: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
    tableName: 'orcamentos_financeiros',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default OrcamentoFinanceiro;