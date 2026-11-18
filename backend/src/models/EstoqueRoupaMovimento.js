import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EstoqueRoupaMovimento = sequelize.define('EstoqueRoupaMovimento', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  roupa_id: { type: DataTypes.INTEGER, allowNull: false },
  variacao_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  tipo: { type: DataTypes.ENUM('entrada', 'saida'), allowNull: false },
  quantidade: { type: DataTypes.INTEGER, allowNull: false },
  saldo_anterior: { type: DataTypes.INTEGER, allowNull: false },
  saldo_posterior: { type: DataTypes.INTEGER, allowNull: false },
  motivo: { type: DataTypes.STRING(120), allowNull: false },
  origem_tipo: { type: DataTypes.STRING(60), allowNull: true },
  origem_id: { type: DataTypes.INTEGER, allowNull: true },
  observacao: { type: DataTypes.TEXT, allowNull: true },
  data: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'estoque_roupas_movimentos', timestamps: true });

export default EstoqueRoupaMovimento;
