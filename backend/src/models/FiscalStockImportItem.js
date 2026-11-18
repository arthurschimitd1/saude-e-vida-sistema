import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FiscalStockImportItem = sequelize.define('FiscalStockImportItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  import_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  external_code: DataTypes.STRING(100),
  description: { type: DataTypes.STRING(500), allowNull: false },
  quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
  unit_cost: { type: DataTypes.DECIMAL(14, 4), allowNull: false, defaultValue: 0 },
  action: { type: DataTypes.STRING(20), allowNull: false }
}, {
  tableName: 'fiscal_stock_import_items',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default FiscalStockImportItem;
