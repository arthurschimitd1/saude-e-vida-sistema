// src/models/NotaFiscalDominio.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const NotaFiscalDominio = sequelize.define('NotaFiscalDominio', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  contador_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  empresa_cliente_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'empresas',
      key: 'id'
    }
  },
  numero_nota: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  xml_content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
    comment: 'Conteúdo do XML ou caminho S3 (recomendado usar bucket)'
  },
  status_envio: {
    type: DataTypes.ENUM('pendente', 'enviado', 'falha'),
    defaultValue: 'pendente'
  },
  batch_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'ID do lote retornado pela API Domínio'
  },
  mensagem_erro: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  data_tentativa: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'notas_fiscais_dominio',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default NotaFiscalDominio;