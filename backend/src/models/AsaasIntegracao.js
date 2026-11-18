import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AsaasIntegracao = sequelize.define('AsaasIntegracao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  public_id: { type: DataTypes.STRING(80), allowNull: true, unique: true },
  ambiente: { type: DataTypes.ENUM('sandbox', 'producao'), allowNull: false, defaultValue: 'sandbox' },
  api_key_encrypted: { type: DataTypes.TEXT, allowNull: false },
  webhook_auth_token_encrypted: { type: DataTypes.TEXT, allowNull: true },
  webhook_id: { type: DataTypes.STRING(80), allowNull: true },
  webhook_url: { type: DataTypes.TEXT, allowNull: true },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: 'asaas_integracoes', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

export default AsaasIntegracao;
