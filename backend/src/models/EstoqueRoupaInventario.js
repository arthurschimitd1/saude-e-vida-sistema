import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EstoqueRoupaInventario = sequelize.define('EstoqueRoupaInventario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  roupa_id: { type: DataTypes.INTEGER, allowNull: false },
  variacao_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  quantidade_sistema: { type: DataTypes.INTEGER, allowNull: false },
  quantidade_contada: { type: DataTypes.INTEGER, allowNull: false },
  diferenca: { type: DataTypes.INTEGER, allowNull: false },
  observacao: { type: DataTypes.TEXT, allowNull: true },
  data_inventario: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'estoque_roupas_inventarios', timestamps: true });

export default EstoqueRoupaInventario;
