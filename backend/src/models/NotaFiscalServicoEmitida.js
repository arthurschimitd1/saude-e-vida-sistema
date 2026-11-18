// src/models/NotaFiscalServicoEmitida.js

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const NotaFiscalServicoEmitida = sequelize.define(
  'NotaFiscalServicoEmitida',
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

    cliente_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'clientes',
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

    servico_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'services',
        key: 'id'
      }
    },

    tipo: {
      type: DataTypes.ENUM('NFSE'),
      allowNull: false,
      defaultValue: 'NFSE'
    },

    status: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Status retornado pela Focus ou prefeitura'
    },

    numero: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Número da NFS-e'
    },

    serie: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Série ou identificação do RPS'
    },

    rps_numero: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    codigo_verificacao: {
      type: DataTypes.STRING(100),
      allowNull: true
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
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Valor total dos serviços'
    },

    valor_liquido: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },

    emitente_nome: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Nome ou razão social do prestador'
    },

    emitente_cnpj: {
      type: DataTypes.STRING(18),
      allowNull: true
    },

    emitente_inscricao_municipal: {
      type: DataTypes.STRING(30),
      allowNull: true
    },

    destinatario_nome: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Nome ou razão social do tomador'
    },

    destinatario_documento: {
      type: DataTypes.STRING(18),
      allowNull: true,
      comment: 'CPF ou CNPJ do tomador'
    },

    destinatario_email: {
      type: DataTypes.STRING,
      allowNull: true
    },

    destinatario_telefone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },

    destinatario_inscricao_municipal: {
      type: DataTypes.STRING(30),
      allowNull: true
    },

    destinatario_logradouro: {
      type: DataTypes.STRING,
      allowNull: true
    },

    destinatario_numero: {
      type: DataTypes.STRING(20),
      allowNull: true
    },

    destinatario_complemento: {
      type: DataTypes.STRING,
      allowNull: true
    },

    destinatario_bairro: {
      type: DataTypes.STRING,
      allowNull: true
    },

    destinatario_municipio: {
      type: DataTypes.STRING,
      allowNull: true
    },

    destinatario_codigo_municipio: {
      type: DataTypes.STRING(10),
      allowNull: true
    },

    destinatario_uf: {
      type: DataTypes.STRING(2),
      allowNull: true
    },

    destinatario_cep: {
      type: DataTypes.STRING(10),
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
      type: DataTypes.DATE,
      allowNull: true
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
      type: DataTypes.JSONB,
      allowNull: true
    },

    provedor: {
      type: DataTypes.ENUM('FOCUS', 'SPEDY'),
      allowNull: false,
      defaultValue: 'FOCUS'
    },

    referencia_externa: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Referência enviada ao provedor'
    },

    resposta_provedor: {
      type: DataTypes.JSONB,
      allowNull: true
    },

    motivo_cancelamento: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    servico_nome: {
      type: DataTypes.STRING,
      allowNull: true
    },

    servico_descricao: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    item_lista_servico: {
      type: DataTypes.STRING(10),
      allowNull: true
    },

    codigo_tributacao_municipio: {
      type: DataTypes.STRING(20),
      allowNull: true
    },

    codigo_cnae: {
      type: DataTypes.STRING(10),
      allowNull: true
    },

    aliquota: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0
    },

    base_calculo: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },

    desconto: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },

    deducoes: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },

    pis: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },

    cofins: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },

    inss: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },

    irrf: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },

    csll: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },

    iss: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },

    iss_retido: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    outras_retencoes: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },

    natureza_operacao: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },

    optante_simples_nacional: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    incentivador_cultural: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    email_enviado_em: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'notas_fiscais_servico_emitidas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['empresa_id']
      },
      {
        fields: ['empresa_id', 'status']
      },
      {
        fields: ['servico_id']
      },
      {
        fields: ['empresa_id', 'venda_id']
      },
      {
        unique: true,
        fields: ['referencia_externa']
      }
    ]
  }
);

export default NotaFiscalServicoEmitida;
