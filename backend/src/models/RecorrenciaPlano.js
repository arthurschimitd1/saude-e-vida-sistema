import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RecorrenciaPlano = sequelize.define('RecorrenciaPlano', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(160), allowNull: false },
  descricao: { type: DataTypes.TEXT, allowNull: true },
  valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  periodicidade: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'MENSAL' },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: 'recorrencia_planos', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

export default RecorrenciaPlano;
