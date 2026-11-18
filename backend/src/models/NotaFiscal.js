import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const NotaFiscal = sequelize.define('NotaFiscal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  empresa_id: { type: DataTypes.INTEGER, allowNull: true },
  venda_id: { type: DataTypes.INTEGER, allowNull: true },
  referencia: { type: DataTypes.STRING(100), allowNull: true },
  tipo: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'nfe' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'processando' },
  chave_acesso: { type: DataTypes.STRING(50), allowNull: true },
  numero: { type: DataTypes.STRING(20), allowNull: true },
  serie: { type: DataTypes.STRING(5), allowNull: true },
  caminho_xml: { type: DataTypes.TEXT, allowNull: true },
  caminho_danfe: { type: DataTypes.TEXT, allowNull: true },
  qrcode_url: { type: DataTypes.TEXT, allowNull: true },
  protocolo_sefaz: { type: DataTypes.STRING(50), allowNull: true },
  mensagem_sefaz: { type: DataTypes.TEXT, allowNull: true },
  data_emissao: { type: DataTypes.DATE, allowNull: true },
  payload_enviado: { type: DataTypes.JSONB, allowNull: true },
  resposta_api: { type: DataTypes.JSONB, allowNull: true },
}, {
  tableName: 'notas_fiscais',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

export default NotaFiscal;
