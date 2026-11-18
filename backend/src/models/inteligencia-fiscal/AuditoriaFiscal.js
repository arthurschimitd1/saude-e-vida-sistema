// src/models/AuditoriaFiscal.js

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const AuditoriaFiscal = sequelize.define(
  'AuditoriaFiscal',
  {
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

    executada_por_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Null quando a auditoria for automática'
    },

    tipo_execucao: {
      type: DataTypes.ENUM(
        'MANUAL',
        'AUTOMATICA',
        'AGENDADA'
      ),
      allowNull: false,
      defaultValue: 'MANUAL'
    },

    status: {
      type: DataTypes.ENUM(
        'PENDENTE',
        'PROCESSANDO',
        'CONCLUIDA',
        'ERRO'
      ),
      allowNull: false,
      defaultValue: 'PENDENTE'
    },

    periodo_inicio: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },

    periodo_fim: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },

    /**
     * Permite limitar a auditoria inicialmente
     * aos documentos suportados.
     *
     * Exemplo:
     * ["NFE", "NFCE"]
     */
    tipos_documento: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: ['NFE', 'NFCE']
    },

    total_documentos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    documentos_conformes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    documentos_com_inconsistencia: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    total_inconsistencias: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    inconsistencias_criticas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    inconsistencias_altas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    inconsistencias_medias: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    total_resolvidas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    /**
     * Soma dos valores dos itens ou documentos
     * relacionados às inconsistências.
     *
     * Não representa risco de multa.
     */
    valor_total_afetado: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },

    score_fiscal: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },

    classificacao: {
      type: DataTypes.ENUM(
        'A',
        'B',
        'C',
        'D',
        'E'
      ),
      allowNull: true
    },

    taxa_inconsistencia: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Percentual de documentos com inconsistência'
    },

    iniciada_em: {
      type: DataTypes.DATE,
      allowNull: true
    },

    finalizada_em: {
      type: DataTypes.DATE,
      allowNull: true
    },

    mensagem_erro: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    /**
     * Guarda os resultados agregados da auditoria.
     *
     * Exemplos:
     * - inconsistências por categoria;
     * - conformidade por tipo de documento;
     * - recomendações geradas;
     * - comparação com auditoria anterior.
     */
    resumo: {
      type: DataTypes.JSONB,
      allowNull: true
    },

    tipo_contexto: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'NOTA_FISCAL'
    },

    referencia_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    total_regras: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    total_regras_erro: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    total_novas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    total_atualizadas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    total_reabertas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    tableName: 'auditorias_fiscais',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      {
        fields: ['empresa_id', 'created_at']
      },
      {
        fields: [
          'empresa_id',
          'periodo_inicio',
          'periodo_fim'
        ]
      },
      {
        fields: ['empresa_id', 'status']
      }
    ]
  }
);

export default AuditoriaFiscal;