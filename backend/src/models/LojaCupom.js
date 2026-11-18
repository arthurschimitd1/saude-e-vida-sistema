import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LojaCupom = sequelize.define('LojaCupom', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  codigo: { type: DataTypes.STRING(40), allowNull: false },
  titulo: { type: DataTypes.STRING(120), allowNull: false },
  tipo: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'percentual' },
  valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  validade_inicio: { type: DataTypes.DATE, allowNull: true },
  validade_fim: { type: DataTypes.DATE, allowNull: true },
  limite_uso: { type: DataTypes.INTEGER, allowNull: true },
  usos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  mensagem: { type: DataTypes.TEXT, allowNull: true },
  cliente_id: { type: DataTypes.INTEGER, allowNull: true },
  roleta_lead_id: { type: DataTypes.INTEGER, allowNull: true },
  premio_id: { type: DataTypes.INTEGER, allowNull: true },
  produto_id: { type: DataTypes.INTEGER, allowNull: true },
  uso_unico_cliente: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'loja_cupons',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default LojaCupom;
