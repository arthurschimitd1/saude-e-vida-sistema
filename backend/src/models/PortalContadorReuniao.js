import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PortalContadorReuniao = sequelize.define('PortalContadorReuniao', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  contador_empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  empresa_cliente_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  obrigacao_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  titulo: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  data_reuniao: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  horario: {
    type: DataTypes.STRING(5),
    allowNull: false
  },
  canal: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'whatsapp'
  },
  link_reuniao: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'solicitada'
  },
  solicitado_por: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  solicitado_por_tipo: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'empresa'
  },
  criado_por: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  atualizado_por: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  cancelado_em: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'portal_contador_reunioes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default PortalContadorReuniao;
