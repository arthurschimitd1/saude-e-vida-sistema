import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ProductLocationStock = sequelize.define('ProductLocationStock', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  unidade_id: { type: DataTypes.INTEGER, allowNull: false },
  quantidade: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 }
}, {
  tableName: 'product_location_stocks', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at'
});

export default ProductLocationStock;
