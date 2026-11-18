import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EstoqueRoupaVariacao = sequelize.define('EstoqueRoupaVariacao', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  roupa_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'estoque_roupas',
      key: 'id'
    }
  },
  cor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tamanho: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantidade_atual: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  quantidade_minima: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  estoque_infinito: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'estoque_roupas_variacoes',
  timestamps: true
});

export default EstoqueRoupaVariacao;
