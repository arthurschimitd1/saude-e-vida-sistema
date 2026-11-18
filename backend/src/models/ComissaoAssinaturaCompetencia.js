import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ComissaoAssinaturaCompetencia = sequelize.define('ComissaoAssinaturaCompetencia', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  competencia: { type: DataTypes.STRING(7), allowNull: false },
  status: { type: DataTypes.ENUM('EM_ANDAMENTO', 'FECHADA', 'PAGA'), allowNull: false, defaultValue: 'EM_ANDAMENTO' },
  receita_assinaturas: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  valor_barbearia: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  valor_pote: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  assinantes_ativos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  percentual_pote_snapshot: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 50 },
  faixas_snapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  fechado_em: DataTypes.DATE, fechado_por: DataTypes.INTEGER,
  pago_em: DataTypes.DATE, pago_por: DataTypes.INTEGER,
}, { tableName: 'comissao_assinatura_competencias', underscored: true, indexes: [{ unique: true, fields: ['empresa_id', 'competencia'] }] });

export default ComissaoAssinaturaCompetencia;
