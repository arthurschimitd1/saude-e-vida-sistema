import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RecorrenciaAuditoria = sequelize.define('RecorrenciaAuditoria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  recorrencia_id: { type: DataTypes.INTEGER, allowNull: true },
  historico_pagamento_id: { type: DataTypes.INTEGER, allowNull: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  acao: { type: DataTypes.STRING(80), allowNull: false },
  statusAnterior: { type: DataTypes.STRING(60), allowNull: true, field: 'status_anterior' },
  statusNovo: { type: DataTypes.STRING(60), allowNull: true, field: 'status_novo' },
  eventoAsaas: { type: DataTypes.STRING(100), allowNull: true, field: 'evento_asaas' },
  respostaAsaas: { type: DataTypes.JSONB, allowNull: true, field: 'resposta_asaas' },
  detalhes: { type: DataTypes.JSONB, allowNull: true }
}, { tableName: 'recorrencia_auditoria', timestamps: true, createdAt: 'created_at', updatedAt: false });

export default RecorrenciaAuditoria;
