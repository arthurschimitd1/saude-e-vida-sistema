// src/models/DominioRequestLog.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const DominioRequestLog = sequelize.define('DominioRequestLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  data: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    unique: true
  },
  total_requests: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'dominio_request_logs',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: false // só queremos saber a data e o contador
});

export default DominioRequestLog;