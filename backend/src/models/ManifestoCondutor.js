import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ManifestoCondutor = sequelize.define('ManifestoCondutor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  cpf: { type: DataTypes.STRING(14), allowNull: false },
  telefone: DataTypes.STRING(30),
  cnh: DataTypes.STRING(30),
  validade_cnh: DataTypes.DATEONLY,
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  deleted_at: DataTypes.DATE
}, {
  tableName: 'manifesto_condutores',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default ManifestoCondutor;
