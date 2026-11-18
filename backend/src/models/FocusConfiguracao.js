// src/models/FocusConfiguracao.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FocusConfiguracao = sequelize.define('FocusConfiguracao', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'empresas',
      key: 'id'
    }
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Token de acesso fornecido pela Focus NFe'
  },
  ambiente: {
    type: DataTypes.ENUM('homologacao', 'producao'),
    defaultValue: 'producao'
  },
  ultima_consulta: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'focus_configuracoes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default FocusConfiguracao;