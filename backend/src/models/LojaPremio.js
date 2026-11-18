import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LojaPremio = sequelize.define('LojaPremio', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(120), allowNull: false },
  descricao: { type: DataTypes.TEXT, allowNull: true },
  tipo: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'desconto_percentual' },
  valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  pontos_custo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  produto_id: { type: DataTypes.INTEGER, allowNull: true },
  chance: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: 1 },
  estoque: { type: DataTypes.INTEGER, allowNull: true },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'loja_premios',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default LojaPremio;
