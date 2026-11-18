import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LojaRoletaLead = sequelize.define('LojaRoletaLead', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  token: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  nome: { type: DataTypes.STRING(160), allowNull: false },
  data_nascimento: { type: DataTypes.DATEONLY, allowNull: true },
  telefone: { type: DataTypes.STRING(30), allowNull: false },
  email: { type: DataTypes.STRING(160), allowNull: false },
  cep: { type: DataTypes.STRING(9), allowNull: true },
  rua: { type: DataTypes.STRING(160), allowNull: true },
  numero: { type: DataTypes.STRING(30), allowNull: true },
  complemento: { type: DataTypes.STRING(120), allowNull: true },
  bairro: { type: DataTypes.STRING(120), allowNull: true },
  cidade: { type: DataTypes.STRING(120), allowNull: true },
  estado: { type: DataTypes.STRING(2), allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendente' },
  cliente_id: { type: DataTypes.INTEGER, allowNull: true },
  premio_id: { type: DataTypes.INTEGER, allowNull: true },
  codigo_premio: { type: DataTypes.STRING(40), allowNull: true },
  premio_email_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendente' },
  premio_email_erro: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'loja_roleta_leads',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default LojaRoletaLead;
