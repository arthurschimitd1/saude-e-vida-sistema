// src/models/ContadorCliente.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ContadorCliente = sequelize.define('ContadorCliente', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  contador_empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'empresas',
      key: 'id'
    }
  },
  empresa_cliente_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'empresas',
      key: 'id'
    }
  },
  chave_contador: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Chave original fornecida pelo contador (x-integration-key)'
  },
  integration_key: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Chave gerada pela API Domínio (após ativação)'
  },
  status: {
    type: DataTypes.ENUM('pendente', 'ativo', 'erro'),
    defaultValue: 'pendente'
  },
  ultimo_envio: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'contador_clientes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['contador_empresa_id', 'empresa_cliente_id']
    }
  ]
});

export default ContadorCliente;
