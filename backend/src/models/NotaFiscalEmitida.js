// src/models/NotaFiscalEmitida.js

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const NotaFiscalEmitida = sequelize.define('NotaFiscalEmitida', {
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

  venda_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'vendas',
      key: 'id'
    }
  },

  tipo: {
    type: DataTypes.ENUM(
      'NFE',
      'NFCE',
      'NFSE',
      'CTE',
      'MDFE'
    ),
    allowNull: false
  },

  status: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Status retornado pela Focus/SEFAZ'
  },

  numero: {
    type: DataTypes.STRING(20),
    allowNull: true
  },

  serie: {
    type: DataTypes.STRING(10),
    allowNull: true
  },

  chave_acesso: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Chave de acesso da NF-e/NFC-e'
  },

  protocolo_autorizacao: {
    type: DataTypes.STRING,
    allowNull: true
  },

  protocolo_cancelamento: {
    type: DataTypes.STRING,
    allowNull: true
  },

  ambiente: {
    type: DataTypes.ENUM('homologacao', 'producao'),
    allowNull: true
  },

  valor_total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },

  emitente_nome: {
    type: DataTypes.STRING,
    allowNull: true
  },

  emitente_cnpj: {
    type: DataTypes.STRING(18),
    allowNull: true
  },

  destinatario_nome: {
    type: DataTypes.STRING,
    allowNull: true
  },

  destinatario_documento: {
    type: DataTypes.STRING(18),
    allowNull: true
  },

  data_emissao: {
    type: DataTypes.DATE,
    allowNull: true
  },

  data_autorizacao: {
    type: DataTypes.DATE,
    allowNull: true
  },

  data_cancelamento: {
    type: DataTypes.DATE,
    allowNull: true
  },

  ultima_consulta: {
    type: DataTypes.DATE
  },

  mensagem_retorno: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  codigo_retorno: {
    type: DataTypes.STRING,
    allowNull: true
  },

  xml_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  pdf_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  payload_enviado: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  
  provedor: {
    type: DataTypes.ENUM('FOCUS', 'SPEDY'),
    allowNull: false,
    defaultValue: 'FOCUS'
  },

  referencia_externa: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Referência enviada ao provedor'
  },

  resposta_provedor: {
      type: DataTypes.JSON
  },

  motivo_cancelamento: {
    type: DataTypes.TEXT,
    allowNull: true
  },

}, {
  tableName: 'notas_fiscais_emitidas',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default NotaFiscalEmitida;