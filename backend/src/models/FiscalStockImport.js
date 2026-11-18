import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FiscalStockImport = sequelize.define('FiscalStockImport', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  source_hash: { type: DataTypes.STRING(64), allowNull: false },
  access_key: DataTypes.STRING(64),
  source_type: { type: DataTypes.STRING(30), allowNull: false },
  invoice_number: DataTypes.STRING(50),
  issued_at: DataTypes.DATE,
  supplier_document: DataTypes.STRING(20),
  supplier_name: DataTypes.STRING(255),
  supplier_snapshot: DataTypes.JSONB,
  imported_by: DataTypes.INTEGER,
  imported_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'fiscal_stock_imports',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default FiscalStockImport;
