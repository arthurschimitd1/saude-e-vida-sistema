import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EmpresaConfigFiscal = sequelize.define('EmpresaConfigFiscal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'empresas', key: 'id' },
    unique: true,
  },
  focusnfe_token: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ambiente: {
    type: DataTypes.ENUM('homologacao', 'producao'),
    defaultValue: 'homologacao',
  },
  cnpj_emitente: {
    type: DataTypes.STRING(14),
    allowNull: false,
  },
  // Campos do emitente (diretos no model para facilitar consultas)
  nome_emitente: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Razão social da empresa emitente',
  },
  logradouro_emitente: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Logradouro (rua, avenida) do emitente',
  },
  numero_emitente: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Número do endereço do emitente',
  },
  bairro_emitente: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Bairro do emitente',
  },
  municipio_emitente: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Município/cidade do emitente',
  },
  uf_emitente: {
    type: DataTypes.STRING(2),
    allowNull: true,
    comment: 'UF (estado) do emitente',
  },
  cep_emitente: {
    type: DataTypes.STRING(8),
    allowNull: true,
    comment: 'CEP do emitente (apenas números)',
  },
  telefone_emitente: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Telefone do emitente',
  },
  inscricao_estadual_emitente: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Inscrição Estadual do emitente',
  },
  regime_tributario_emitente: {
    type: DataTypes.INTEGER,
    comment: '1: Simples Nacional, 2: Simples Nacional excesso, 3: Regime Normal',
  },
  dados_emitente: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Dados adicionais do emitente (backup/compatibilidade)',
  },
}, {
  tableName: 'empresa_config_fiscal',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

export default EmpresaConfigFiscal;