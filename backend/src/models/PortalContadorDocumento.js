import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PortalContadorDocumento = sequelize.define('PortalContadorDocumento', {
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
  nome: {
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
  arquivo_url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  arquivo_public_id: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  arquivo_nome_original: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  arquivo_mime_type: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  arquivo_tamanho: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  enviado_por: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status_leitura: {
    type: DataTypes.ENUM('novo', 'baixado'),
    allowNull: false,
    defaultValue: 'novo'
  },
  baixado_em: {
    type: DataTypes.DATE,
    allowNull: true
  },
  baixado_por: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  baixado_por_nome: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  baixado_por_tipo: {
    type: DataTypes.STRING(30),
    allowNull: true
  }
}, {
  tableName: 'portal_contador_documentos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default PortalContadorDocumento;
