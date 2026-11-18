// src/models/AuditoriaFiscalInconsistencia.js

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const AuditoriaFiscalInconsistencia = sequelize.define(
  'AuditoriaFiscalInconsistencia',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    auditoria_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'auditorias_fiscais',
        key: 'id'
      }
    },

    inconsistencia_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'inconsistencias_fiscais',
        key: 'id'
      }
    },

    status_no_momento: {
      type: DataTypes.STRING(30),
      allowNull: false
    },

    severidade_no_momento: {
      type: DataTypes.STRING(20),
      allowNull: false
    },

    estava_resolvida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    tipo_resultado: {
      type: DataTypes.ENUM(
        'CRIADA',
        'RECORRENTE',
        'ATUALIZADA',
        'REABERTA'
      ),
      allowNull: false
    },

    snapshot: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Estado da inconsistência no momento da auditoria'
    }
  },
  {
    tableName: 'auditoria_fiscal_inconsistencias',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,

    indexes: [
      {
        unique: true,
        fields: [
          'auditoria_id',
          'inconsistencia_id'
        ],
        name: 'auditoria_inconsistencia_unica'
      },
      {
        fields: ['auditoria_id']
      },
      {
        fields: ['inconsistencia_id']
      }
    ]
  }
);

export default AuditoriaFiscalInconsistencia;