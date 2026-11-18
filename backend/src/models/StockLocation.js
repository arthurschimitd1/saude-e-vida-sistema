import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const StockLocation = sequelize.define('StockLocation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(120), allowNull: false },
  tipo: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'filial' },
  endereco: { type: DataTypes.STRING(255), allowNull: true },
  principal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'stock_locations', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at'
});

export default StockLocation;
