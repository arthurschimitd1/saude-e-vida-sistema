import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PortalContadorDocumentoLeitura = sequelize.define('PortalContadorDocumentoLeitura', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  documento_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  usuario_nome: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  usuario_tipo: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'empresa'
  },
  acao: {
    type: DataTypes.ENUM('visualizacao', 'download', 'download_lote'),
    allowNull: false,
    defaultValue: 'download'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'portal_contador_documento_leituras',
  timestamps: false
});

export default PortalContadorDocumentoLeitura;
