import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AsaasCheckout = sequelize.define('AsaasCheckout', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  public_id: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  recorrencia_id: { type: DataTypes.INTEGER, allowNull: false },
  integration_id: { type: DataTypes.INTEGER, allowNull: false },
  asaas_checkout_id: { type: DataTypes.STRING(100), allowNull: true, unique: true },
  asaas_customer_id: { type: DataTypes.STRING(80), allowNull: true },
  asaas_subscription_id: { type: DataTypes.STRING(80), allowNull: true },
  external_reference: { type: DataTypes.STRING(200), allowNull: false },
  checkout_url: { type: DataTypes.TEXT, allowNull: true },
  checkout_status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'PROCESSANDO' },
  subscription_status: { type: DataTypes.STRING(40), allowNull: true },
  cycle: { type: DataTypes.STRING(30), allowNull: false },
  value: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  next_due_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: true },
  expires_at: { type: DataTypes.DATE, allowNull: true },
  paid_at: { type: DataTypes.DATE, allowNull: true },
  canceled_at: { type: DataTypes.DATE, allowNull: true },
  request_id: { type: DataTypes.STRING(120), allowNull: false },
  last_error_code: { type: DataTypes.STRING(120), allowNull: true },
  created_by: { type: DataTypes.INTEGER, allowNull: true }
}, {
  tableName: 'asaas_checkouts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default AsaasCheckout;
