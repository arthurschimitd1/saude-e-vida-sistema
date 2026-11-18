import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AsaasCliente = sequelize.define('AsaasCliente', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  asaas_customer_id: { type: DataTypes.STRING(80), allowNull: false }
}, { tableName: 'asaas_clientes', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

export default AsaasCliente;
