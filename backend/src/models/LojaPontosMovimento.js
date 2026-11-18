import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LojaPontosMovimento = sequelize.define('LojaPontosMovimento', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  venda_id: { type: DataTypes.INTEGER, allowNull: true },
  resgate_id: { type: DataTypes.INTEGER, allowNull: true },
  tipo: { type: DataTypes.STRING(20), allowNull: false },
  pontos: { type: DataTypes.INTEGER, allowNull: false },
  descricao: { type: DataTypes.STRING(255), allowNull: false },
}, {
  tableName: 'loja_pontos_movimentos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

export default LojaPontosMovimento;
