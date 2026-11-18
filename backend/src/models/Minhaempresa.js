import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MinhaEmpresa = sequelize.define('MinhaEmpresa', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  // Dados principais
  razao_social: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nome_fantasia: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cnpj: {
    type: DataTypes.STRING(18),
    allowNull: false,
    unique: true
  },
  inscricao_estadual: {
    type: DataTypes.STRING,
    allowNull: true
  },
  inscricao_municipal: {
    type: DataTypes.STRING,
    allowNull: true
  },
  regime_tributario: {
    type: DataTypes.ENUM('Simples Nacional', 'Lucro Presumido', 'Lucro Real'),
    allowNull: false,
    defaultValue: 'Simples Nacional'
  },
  cnae_principal: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Endereço
  cep: {
    type: DataTypes.STRING(9),
    allowNull: true
  },
  logradouro: {
    type: DataTypes.STRING,
    allowNull: true
  },
  numero: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bairro: {
    type: DataTypes.STRING,
    allowNull: true
  },
  municipio: {
    type: DataTypes.STRING,
    allowNull: true
  },
  uf: {
    type: DataTypes.STRING(2),
    allowNull: true
  },
  codigo_ibge: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Contato
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  telefone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  responsavel: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cpf_responsavel: {
    type: DataTypes.STRING(14),
    allowNull: true
  },
  senha_contato: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Certificados
  link_certificado: {
    type: DataTypes.STRING,
    allowNull: true
  },
  senha_certificado: {
    type: DataTypes.STRING,
    allowNull: true
  },
  acesso_gov_email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  acesso_gov_senha: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Vínculo com sistema de acesso (criado junto com o usuário responsável)
  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  // Nota Fiscal
  tipo_nota: {
    type: DataTypes.ENUM('NFS-e', 'NF-e', 'NFC-e'),
    allowNull: true,
    defaultValue: 'NFS-e'
  },
  serie: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '1'
  },
  numero_atual: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1
  },
  ambiente: {
    type: DataTypes.ENUM('Produção', 'Homologação'),
    allowNull: true,
    defaultValue: 'Produção'
  }
}, {
  tableName: 'minha_empresa',
  timestamps: true
});

export default MinhaEmpresa;