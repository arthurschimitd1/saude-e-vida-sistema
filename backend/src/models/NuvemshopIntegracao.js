import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const NuvemshopIntegracao = sequelize.define('NuvemshopIntegracao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  store_id: { type: DataTypes.BIGINT, allowNull: false, unique: true },
  access_token_encrypted: { type: DataTypes.TEXT, allowNull: false },
  scopes: { type: DataTypes.TEXT, allowNull: true },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  connected_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  disconnected_at: { type: DataTypes.DATE, allowNull: true },
  last_sync_at: { type: DataTypes.DATE, allowNull: true },
  last_sync_direction: { type: DataTypes.STRING(20), allowNull: true },
  last_sync_summary: { type: DataTypes.JSONB, allowNull: true },
  last_sync_error: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'nuvemshop_integracoes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default NuvemshopIntegracao;
