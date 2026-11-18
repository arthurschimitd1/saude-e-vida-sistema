// src/models/InconsistenciaFiscalHistorico.js

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const InconsistenciaFiscalHistorico = sequelize.define(
  'InconsistenciaFiscalHistorico',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    inconsistencia_id: {
      field: 'inconsistencia_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'inconsistencias_fiscais',
        key: 'id'
      }
    },

    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Null quando a ação foi realizada automaticamente'
    },

    origem_acao: {
      type: DataTypes.ENUM(
        'USUARIO',
        'SISTEMA'
      ),
      allowNull: false,
      defaultValue: 'USUARIO'
    },

    acao: {
      type: DataTypes.ENUM(
        'DETECTADA',
        'ABERTA_PARA_ANALISE',
        'STATUS_ALTERADO',
        'RESPONSAVEL_ATRIBUIDO',
        'RESPONSAVEL_REMOVIDO',
        'CADASTRO_CORRIGIDO',
        'DOCUMENTO_CORRIGIDO',
        'RESOLVIDA',
        'REABERTA',
        'JUSTIFICADA',
        'IGNORADA',
        'REVALIDADA',
        'DETECTADA_NOVAMENTE',
        'RESOLVIDA_AUTOMATICAMENTE'
      ),
      allowNull: false
    },

    status_anterior: {
      type: DataTypes.STRING(30),
      allowNull: true
    },

    status_novo: {
      type: DataTypes.STRING(30),
      allowNull: true
    },

    responsavel_anterior_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },

    responsavel_novo_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },

    observacao: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    dados_anteriores: {
      type: DataTypes.JSONB,
      allowNull: true
    },

    dados_novos: {
      type: DataTypes.JSONB,
      allowNull: true
    },

    auditoria_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'auditorias_fiscais',
        key: 'id'
      }
    }
  },
  {
    tableName: 'inconsistencias_fiscais_historico',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,

    indexes: [
      {
        fields: ['inconsistencia_id', 'created_at']
      },
      {
        fields: ['usuario_id']
      },
      {
        fields: ['acao']
      }
    ]
  }
);

export default InconsistenciaFiscalHistorico;