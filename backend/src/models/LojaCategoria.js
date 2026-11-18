import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LojaCategoria = sequelize.define('LojaCategoria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(120), allowNull: false },
  slug: { type: DataTypes.STRING(140), allowNull: false },
  ordem: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'loja_categorias',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default LojaCategoria;
