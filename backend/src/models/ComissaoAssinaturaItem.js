import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ComissaoAssinaturaItem = sequelize.define('ComissaoAssinaturaItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  competencia_id: { type: DataTypes.INTEGER, allowNull: false },
  atendimento_id: { type: DataTypes.INTEGER, allowNull: false },
  recorrencia_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: DataTypes.INTEGER,
  cliente_nome: { type: DataTypes.STRING, allowNull: false },
  plano_nome: { type: DataTypes.STRING, allowNull: false },
  servico_id: DataTypes.STRING,
  servico_nome: { type: DataTypes.STRING, allowNull: false },
  profissional_id: { type: DataTypes.INTEGER, allowNull: false },
  profissional_nome: { type: DataTypes.STRING, allowNull: false },
  realizado_em: { type: DataTypes.DATE, allowNull: false },
  minutos: { type: DataTypes.INTEGER, allowNull: false },
  valor_assinatura: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  valor_barbearia: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  valor_pote: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  faixa: DataTypes.STRING,
  peso: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 1 },
  participacao: { type: DataTypes.DECIMAL(12, 8), allowNull: false, defaultValue: 0 },
  comissao: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  tipo_atendimento: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ASSINATURA' },
  origem_comissao: { type: DataTypes.STRING, allowNull: false, defaultValue: 'POTE_ASSINATURA' },
}, { tableName: 'comissao_assinatura_itens', underscored: true, indexes: [{ unique: true, fields: ['empresa_id', 'atendimento_id'] }, { fields: ['competencia_id', 'profissional_id'] }] });

export default ComissaoAssinaturaItem;
