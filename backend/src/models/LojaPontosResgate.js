import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LojaPontosResgate = sequelize.define('LojaPontosResgate', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  premio_id: { type: DataTypes.INTEGER, allowNull: false },
  cupom_id: { type: DataTypes.INTEGER, allowNull: true },
  codigo: { type: DataTypes.STRING(40), allowNull: false },
  pontos: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ativo' },
}, {
  tableName: 'loja_pontos_resgates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

export default LojaPontosResgate;
