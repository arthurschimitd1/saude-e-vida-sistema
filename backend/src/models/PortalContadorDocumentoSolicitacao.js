import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PortalContadorDocumentoSolicitacao = sequelize.define('PortalContadorDocumentoSolicitacao', {
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
  titulo: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING(80),
    allowNull: false,
    defaultValue: 'documento'
  },
  competencia: {
    type: DataTypes.STRING(7),
    allowNull: true
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  prioridade: {
    type: DataTypes.ENUM('baixa', 'normal', 'alta'),
    allowNull: false,
    defaultValue: 'normal'
  },
  status: {
    type: DataTypes.ENUM('aberta', 'em_andamento', 'atendida', 'cancelada'),
    allowNull: false,
    defaultValue: 'aberta'
  },
  solicitado_por: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  solicitado_por_nome: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  solicitado_por_tipo: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'empresa'
  },
  atendido_em: {
    type: DataTypes.DATE,
    allowNull: true
  },
  historico: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  }
}, {
  tableName: 'portal_contador_documento_solicitacoes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default PortalContadorDocumentoSolicitacao;
