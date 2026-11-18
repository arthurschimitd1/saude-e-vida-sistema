import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Venda = sequelize.define('Venda', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cliente_id: {
    type: DataTypes.INTEGER,
    allowNull: true, 
    references: { model: 'clientes', key: 'id' }
  },
  funcionario_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  orcamento_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'orcamentos', key: 'id' },
    comment: 'Orçamento convertido em venda no Caixa'
  },
  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'empresas', key: 'id' }
  },
  origem: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'caixa',
    comment: 'Canal de origem da venda: caixa ou loja_online'
  },
  status_loja: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'Status operacional dos pedidos recebidos pela loja online'
  },
  status_loja_atualizado_em: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data da última alteração do status do pedido online'
  },
  status_loja_historico: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    comment: 'Histórico visual de alterações do status do pedido online'
  },
  loja_cupom_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Cupom aplicado no pedido da loja online'
  },
  loja_cupom_codigo: {
    type: DataTypes.STRING(40),
    allowNull: true,
    comment: 'Snapshot do código do cupom aplicado'
  },
  mercado_pago_preference_id: {
    type: DataTypes.STRING(120),
    allowNull: true,
    comment: 'ID da preferência de checkout do Mercado Pago'
  },
  mercado_pago_payment_id: {
    type: DataTypes.STRING(120),
    allowNull: true,
    comment: 'ID do pagamento retornado pelo Mercado Pago'
  },
  mercado_pago_status: {
    type: DataTypes.STRING(40),
    allowNull: true,
    comment: 'Último status financeiro recebido do Mercado Pago'
  },
  mercado_pago_ultimo_evento_em: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data da última notificação processada do Mercado Pago'
  },
  mercado_pago_reembolso_id: {
    type: DataTypes.STRING(120),
    allowNull: true,
    comment: 'ID do reembolso criado no Mercado Pago'
  },
  mercado_pago_reembolso_status: {
    type: DataTypes.STRING(40),
    allowNull: true,
    comment: 'Status do reembolso: processando, estornado ou erro'
  },
  mercado_pago_reembolsado_em: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data em que o reembolso foi confirmado pelo Mercado Pago'
  },
  data: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  forma_pagamento: {
    type: DataTypes.STRING,
    allowNull: false
  },
  forma_entrega: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'retirada',
    comment: 'Forma de recebimento do pedido online: entrega ou retirada'
  },
  tipo_cartao: {
    type: DataTypes.STRING,  
    allowNull: true
  },
  parcelas: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  com_nota: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  desconto: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  tipo_desconto: {
    type: DataTypes.STRING,  
    defaultValue: 'valor'
  },
  taxa_entrega: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  endereco_entrega: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null
  },
  observacao: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cfop: {
    type: DataTypes.STRING(4),
    allowNull: true,
    comment: 'CFOP opcional da venda; quando informado, substitui o CFOP dos produtos na emissão fiscal'
  },
  cst_csosn: {
    type: DataTypes.STRING(3),
    allowNull: true,
    comment: 'CST/CSOSN opcional da venda; quando informado, substitui o CST/CSOSN dos produtos na emissão fiscal'
  },
  valor_total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  pagamentos: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null
  },
  turno_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'vendas',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

export default Venda;
