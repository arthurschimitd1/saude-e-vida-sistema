import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EstoqueRoupa = sequelize.define('EstoqueRoupa', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: false
  },
  codigo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tipo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  genero: {
    type: DataTypes.STRING,
    allowNull: true
  },
  marca: {
    type: DataTypes.STRING,
    allowNull: true
  },
  preco_venda: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  preco_compra: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  fornecedor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  observacao: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  foto_url: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'estoque_roupas',
  timestamps: true
});

export default EstoqueRoupa;