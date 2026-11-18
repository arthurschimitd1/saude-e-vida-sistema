import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Saida = sequelize.define('Saida', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tipo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  natureza: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'SAIDA',
    validate: {
      isIn: [['ENTRADA', 'SAIDA']]
    }
  },
  descricao: {
    type: DataTypes.STRING,
    allowNull: true
  },
  data: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  valor: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  categoria: {
    type: DataTypes.STRING,
    allowNull: true
  },
  forma_pagamento: {
    type: DataTypes.STRING(20), allowNull: true,
    validate: { isIn: [['DINHEIRO', 'PIX', 'CARTAO']] }
  },
  turno_id: { type: DataTypes.INTEGER, allowNull: true },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pendente',
    validate: {
      isIn: [['pago', 'pendente', 'agendado']]
    }
  },
  comprovante_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  comprovante_public_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  centro_custo_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'saidas',
  timestamps: true
});

export default Saida;
