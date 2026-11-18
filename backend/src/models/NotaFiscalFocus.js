// src/models/NotaFiscalFocus.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const NotaFiscalFocus = sequelize.define('NotaFiscalFocus', {
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
  chave_acesso: {
    type: DataTypes.STRING(44),
    allowNull: false,
    //unique: true,
    comment: 'Chave de acesso da NFe (44 dígitos)'
  },
  numero: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  serie: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  data_emissao: {
    type: DataTypes.DATE,
    allowNull: true
  },
  valor_total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  emitente_cnpj: {
    type: DataTypes.STRING(18),
    allowNull: true
  },
  emitente_nome: {
    type: DataTypes.STRING,
    allowNull: true
  },
  xml_content: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: 'Conteúdo do XML (ou caminho do arquivo)'
  },
  manifestada: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  manifestacao_tipo: {
    type: DataTypes.STRING(40),
    allowNull: true,
    comment: 'Tipo da última manifestação registrada para a NF-e'
  },
  data_manifestacao: {
    type: DataTypes.DATE,
    allowNull: true
  },
  enviado_para_dominio: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indica se a nota já foi enviada para a API Domínio'
  },
  data_envio_dominio: {
    type: DataTypes.DATE,
    allowNull: true
  },
  integration_key_usada: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'IntegrationKey utilizada no envio para Domínio'
  },
  status_focus: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'notas_fiscais_focus',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default NotaFiscalFocus;
