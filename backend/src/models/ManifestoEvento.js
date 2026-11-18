import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ManifestoEvento = sequelize.define('ManifestoEvento', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: DataTypes.INTEGER,
  entidade_tipo: { type: DataTypes.STRING(30), allowNull: false },
  entidade_id: { type: DataTypes.STRING(100), allowNull: false },
  acao: { type: DataTypes.STRING(60), allowNull: false },
  status_anterior: DataTypes.STRING(60),
  status_posterior: DataTypes.STRING(60),
  protocolo: DataTypes.STRING(100),
  justificativa: DataTypes.TEXT,
  resultado: { type: DataTypes.STRING(30), defaultValue: 'SUCESSO' },
  codigo_retorno: DataTypes.STRING(30),
  motivo_retorno: DataTypes.TEXT,
  dados: { type: DataTypes.JSONB, defaultValue: {} },
  ip: DataTypes.STRING(64)
}, {
  tableName: 'manifesto_eventos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default ManifestoEvento;
