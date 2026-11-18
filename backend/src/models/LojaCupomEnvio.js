import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LojaCupomEnvio = sequelize.define('LojaCupomEnvio', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  cupom_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  telefone: { type: DataTypes.STRING(30), allowNull: false },
  mensagem: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendente' },
  enviado_em: { type: DataTypes.DATE, allowNull: true },
  erro: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'loja_cupom_envios',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

export default LojaCupomEnvio;
