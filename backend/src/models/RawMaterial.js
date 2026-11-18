import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RawMaterial = sequelize.define('RawMaterial', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Unidade'
  },
  currentQuantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 0
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  minQuantity: {
    type: DataTypes.DECIMAL(10,3),
    allowNull: false,
    defaultValue: 0,
    field: 'min_quantity'
  },
  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: true,  // Inicialmente aceita NULL
    references: {
      model: 'empresas',
      key: 'id'
    }
  }
}, {
  tableName: 'raw_materials',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

export default RawMaterial;