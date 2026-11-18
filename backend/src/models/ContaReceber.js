import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ContaReceber = sequelize.define('ContaReceber', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER, allowNull: true },
  venda_id: { type: DataTypes.INTEGER, allowNull: true },
  nota_fiscal_id: { type: DataTypes.INTEGER, allowNull: true },
  origem: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
  descricao: { type: DataTypes.STRING(300), allowNull: false },
  valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  valor_pago: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  data_emissao: { type: DataTypes.DATEONLY, allowNull: false },
  data_vencimento: { type: DataTypes.DATEONLY, allowNull: false },
  data_pagamento: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ABERTA' },
  observacao: { type: DataTypes.TEXT, allowNull: true },
  criado_por: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'contas_receber',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default ContaReceber;
