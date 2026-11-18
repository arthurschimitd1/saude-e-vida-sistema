// src/models/InconsistenciaFiscal.js

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const InconsistenciaFiscal = sequelize.define(
  'InconsistenciaFiscal',
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

    nota_fiscal_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'notas_fiscais_emitidas',
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

    venda_item_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'venda_itens',
        key: 'id'
      }
    },

    produto_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Products',
        key: 'id'
      }
    },

    cliente_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'clientes',
        key: 'id'
      }
    },

    /**
     * Código interno da regra que detectou o problema.
     *
     * Exemplos:
     * PRODUTO_NCM_AUSENTE
     * PRODUTO_CFOP_DIVERGENTE
     * CLIENTE_DOCUMENTO_DIVERGENTE
     */
    codigo_regra: {
      type: DataTypes.STRING(100),
      allowNull: false
    },

    /**
     * Identifica unicamente a ocorrência da regra.
     *
     * Exemplo:
     * nota:50:item:12:PRODUTO_NCM_AUSENTE
     *
     * Evita criar a mesma inconsistência várias vezes
     * quando uma nota for auditada novamente.
     */
    chave_inconsistencia: {
      type: DataTypes.STRING(255),
      allowNull: false
    },

    tipo: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nome do tipo exibido na tela'
    },

    categoria: {
      type: DataTypes.ENUM(
        'PRODUTO',
        'CLIENTE',
        'EMITENTE',
        'VENDA',
        'ITEM',
        'DOCUMENTO'
      ),
      allowNull: false
    },

    titulo: {
      type: DataTypes.STRING(255),
      allowNull: false
    },

    descricao: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    campo_afetado: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    valor_encontrado: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    valor_esperado: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    /**
     * Valor do item ou documento envolvido.
     *
     * Não representa multa nem crédito tributário.
     * É apenas o valor financeiro relacionado
     * à ocorrência.
     */
    valor_afetado: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },

    severidade: {
      type: DataTypes.ENUM(
        'CRITICA',
        'ALTA',
        'MEDIA'
      ),
      allowNull: false,
      defaultValue: 'MEDIA'
    },

    status: {
      type: DataTypes.ENUM(
        'PENDENTE',
        'ANALISANDO',
        'URGENTE',
        'RESOLVIDO'
      ),
      allowNull: false,
      defaultValue: 'PENDENTE'
    },

    responsavel_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },

    detectada_em: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },

    prazo_resolucao: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },

    resolvida_em: {
      type: DataTypes.DATE,
      allowNull: true
    },

    resolvida_por_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },

    tipo_resolucao: {
      type: DataTypes.ENUM(
        'CADASTRO_CORRIGIDO',
        'DOCUMENTO_CORRIGIDO',
        'JUSTIFICADO',
        'IGNORADO'
      ),
      allowNull: true
    },

    resolucao_automatica: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    observacao_resolucao: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    /**
     * Armazena os dados utilizados no momento
     * em que a inconsistência foi detectada.
     *
     * Isso preserva o contexto mesmo que o produto
     * ou cliente seja alterado posteriormente.
     */
    dados_deteccao: {
      type: DataTypes.JSONB,
      allowNull: true
    },

    ultima_verificacao_em: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'inconsistencias_fiscais',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      {
        unique: true,
        fields: [
          'empresa_id',
          'nota_fiscal_id',
          'chave_inconsistencia'
        ],
        name: 'inconsistencia_fiscal_unica'
      },
      {
        fields: ['empresa_id', 'status']
      },
      {
        fields: ['empresa_id', 'severidade']
      },
      {
        fields: ['nota_fiscal_id']
      },
      {
        fields: ['venda_id']
      },
      {
        fields: ['produto_id']
      },
      {
        fields: ['cliente_id']
      },
      {
        fields: ['responsavel_id']
      },
      {
        fields: ['detectada_em']
      },
      {
        fields: ['prazo_resolucao']
      }
    ]
  }
);

export default InconsistenciaFiscal;