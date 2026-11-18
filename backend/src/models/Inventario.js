import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Inventario = sequelize.define('Inventario', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  produto_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Products',
      key: 'id'
    }
  },
  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // Compatível com produtos antigos sem empresa
    references: {
      model: 'empresas',
      key: 'id'
    }
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  quantidade_sistema: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false
  },
  quantidade_contada: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false
  },
  diferenca: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false
  },
  observacao: {
    type: DataTypes.STRING,
    allowNull: true
  },
  data_inventario: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'inventarios',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

export default Inventario;
