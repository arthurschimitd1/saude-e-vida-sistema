import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ManifestoDocumento = sequelize.define('ManifestoDocumento', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  mdfe_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { type: DataTypes.STRING(10), allowNull: false },
  chave_acesso: { type: DataTypes.STRING(50), allowNull: false },
  documento_origem_id: DataTypes.INTEGER,
  emitente_nome: DataTypes.STRING(200),
  destinatario_nome: DataTypes.STRING(200),
  uf_origem: DataTypes.STRING(2),
  uf_destino: DataTypes.STRING(2),
  valor: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  peso: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  status: DataTypes.STRING(40),
  dados: { type: DataTypes.JSONB, defaultValue: {} }
}, {
  tableName: 'manifesto_documentos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default ManifestoDocumento;
