import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ComissaoAssinaturaConfiguracao = sequelize.define('ComissaoAssinaturaConfiguracao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  percentual_pote: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 50 },
  faixas: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
}, { tableName: 'comissao_assinatura_configuracoes', underscored: true });

export default ComissaoAssinaturaConfiguracao;
