import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RecorrenciaConfiguracao = sequelize.define('RecorrenciaConfiguracao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  formaPagamentoPadrao: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'PIX', field: 'forma_pagamento_padrao' },
  bancoRecebimento: { type: DataTypes.STRING(120), allowNull: true, field: 'banco_recebimento' },
  bancoNome: { type: DataTypes.STRING(120), allowNull: true, field: 'banco_nome' },
  bancoAgencia: { type: DataTypes.STRING(40), allowNull: true, field: 'banco_agencia' },
  bancoConta: { type: DataTypes.STRING(80), allowNull: true, field: 'banco_conta' },
  bancoPix: { type: DataTypes.STRING(180), allowNull: true, field: 'banco_pix' },
  juros: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  multa: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  desconto: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  diasAntecedencia: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'dias_antecedencia' },
  reciboNomeEmpresa: { type: DataTypes.STRING(255), allowNull: true, field: 'recibo_nome_empresa' },
  reciboDocumento: { type: DataTypes.STRING(40), allowNull: true, field: 'recibo_documento' },
  reciboEndereco: { type: DataTypes.TEXT, allowNull: true, field: 'recibo_endereco' },
  reciboTelefone: { type: DataTypes.STRING(40), allowNull: true, field: 'recibo_telefone' },
  reciboRodape: { type: DataTypes.TEXT, allowNull: true, field: 'recibo_rodape' }
}, { tableName: 'recorrencia_configuracoes', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

export default RecorrenciaConfiguracao;
