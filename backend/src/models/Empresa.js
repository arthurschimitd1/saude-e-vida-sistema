import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Empresa = sequelize.define('Empresa', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: false
  },
  cnpj: {
    type: DataTypes.STRING(18),
    allowNull: true
  },
  permissoes: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
    defaultValue: []
  },
  pacote: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  cargos: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  configuracoes: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  cadastrado_por: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  cadastrado_por_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  arquivada_em: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'empresas',
  timestamps: false
});

export default Empresa;
