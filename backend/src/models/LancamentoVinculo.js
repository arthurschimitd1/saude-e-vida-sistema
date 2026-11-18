import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LancamentoVinculo = sequelize.define('LancamentoVinculo', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    saida_id: { type: DataTypes.INTEGER, allowNull: false },
    produto_id: { type: DataTypes.INTEGER, allowNull: true },
    rateio: { type: DataTypes.JSONB, allowNull: true }, // [{ departamento_id, nome, percentual }]
    responsavel: { type: DataTypes.STRING, allowNull: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
    tableName: 'lancamento_vinculos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default LancamentoVinculo;