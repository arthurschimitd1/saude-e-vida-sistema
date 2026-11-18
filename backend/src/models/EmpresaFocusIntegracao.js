// src/models/EmpresaFocusIntegracao.js

import {
  DataTypes
} from 'sequelize';
import sequelize from '../config/database.js';

const EmpresaFocusIntegracao =
  sequelize.define(
    'EmpresaFocusIntegracao',
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

      focus_empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },

      cnpj_emitente: {
        type: DataTypes.STRING,
        allowNull: true
      },

      focusnfe_token: {
        type: DataTypes.STRING,
        allowNull: true
      },

      focusnfe_token_homologacao: {
        type: DataTypes.STRING,
        allowNull: true
      },

      ambiente: {
        type: DataTypes.ENUM(
          'producao',
          'homologacao'
        ),
        defaultValue: 'producao'
      },

      status: {
        type: DataTypes.STRING,
        defaultValue: 'PENDING'
      },

      dados_emitente: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },

      ativo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },

      ultima_sincronizacao: {
        type: DataTypes.DATE,
        allowNull: true
      },
      ultimo_erro: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      tipo_integracao: {
        type: DataTypes.ENUM(
            'PROVISIONADA',
            'ASSOCIADA'
        ),
        allowNull: false,
        defaultValue: 'PROVISIONADA'
        }
    },
    {
      tableName:
        'empresa_focus_integracao',
      underscored: true,
      timestamps: true
    }
  );

export default EmpresaFocusIntegracao;