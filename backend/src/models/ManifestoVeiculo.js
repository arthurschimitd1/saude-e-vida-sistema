import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ManifestoVeiculo = sequelize.define('ManifestoVeiculo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  placa: { type: DataTypes.STRING(8), allowNull: false },
  renavam: DataTypes.STRING(20),
  tara_kg: DataTypes.DECIMAL(12, 3),
  capacidade_kg: DataTypes.DECIMAL(12, 3),
  tipo_rodado: DataTypes.STRING(40),
  tipo_carroceria: DataTypes.STRING(40),
  uf_licenciamento: DataTypes.STRING(2),
  proprietario_nome: DataTypes.STRING(200),
  proprietario_documento: DataTypes.STRING(18),
  rntrc: DataTypes.STRING(20),
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  deleted_at: DataTypes.DATE
}, {
  tableName: 'manifesto_veiculos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default ManifestoVeiculo;
