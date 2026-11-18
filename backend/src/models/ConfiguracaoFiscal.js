// src/models/ConfiguracaoFiscal.js

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ConfiguracaoFiscal = sequelize.define(
  'ConfiguracaoFiscal',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    empresa_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },

    cnpj: {
      type: DataTypes.STRING,
      allowNull: false
    },

    razao_social: {
      type: DataTypes.STRING,
      allowNull: false
    },

    nome_fantasia: {
      type: DataTypes.STRING,
      allowNull: true
    },

    email: {
      type: DataTypes.STRING,
      allowNull: true
    },

    telefone: {
      type: DataTypes.STRING,
      allowNull: true
    },

    inscricao_estadual: {
      type: DataTypes.STRING,
      allowNull: true
    },

    inscricao_municipal: {
      type: DataTypes.STRING,
      allowNull: true
    },

    regime_tributario: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    regime_especial_tributacao: {
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: '05 = MEI, 06 = ME/EPP'
    },

    logradouro: {
      type: DataTypes.STRING,
      allowNull: true
    },

    numero: {
      type: DataTypes.STRING,
      allowNull: true
    },

    complemento: {
      type: DataTypes.STRING,
      allowNull: true
    },

    bairro: {
      type: DataTypes.STRING,
      allowNull: true
    },

    municipio: {
      type: DataTypes.STRING,
      allowNull: true
    },

    codigo_municipio: {
      type: DataTypes.STRING(7),
      allowNull: true
    },

    uf: {
      type: DataTypes.STRING(2),
      allowNull: true
    },

    cep: {
      type: DataTypes.STRING,
      allowNull: true
    }
  },
  {
    tableName: 'configuracao_fiscal',
    underscored: true,
    timestamps: true
  }
);

export default ConfiguracaoFiscal;
