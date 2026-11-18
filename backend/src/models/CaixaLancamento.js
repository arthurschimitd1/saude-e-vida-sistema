import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CaixaLancamento = sequelize.define('CaixaLancamento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    turno_id: { type: DataTypes.INTEGER, allowNull: true },
    tipo: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'entrada' },
    origem_tipo: { type: DataTypes.STRING(40), allowNull: false },
    origem_id: { type: DataTypes.INTEGER, allowNull: false },
    descricao: { type: DataTypes.STRING(300), allowNull: false },
    valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    forma_pagamento: { type: DataTypes.STRING(40), allowNull: true },
    data: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    estornado_em: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'caixa_lancamentos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{
        unique: true,
        fields: ['empresa_id', 'origem_tipo', 'origem_id'],
        name: 'caixa_lancamentos_origem_unique'
    }]
});

export default CaixaLancamento;
