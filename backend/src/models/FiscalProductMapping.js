import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FiscalProductMapping = sequelize.define('FiscalProductMapping', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  supplier_document: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '' },
  external_key: { type: DataTypes.STRING(255), allowNull: false },
  external_code: DataTypes.STRING(100),
  last_description: DataTypes.STRING(500),
  product_id: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: 'fiscal_product_mappings',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default FiscalProductMapping;
