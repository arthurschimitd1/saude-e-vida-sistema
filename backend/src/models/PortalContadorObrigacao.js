import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PortalContadorObrigacao = sequelize.define('PortalContadorObrigacao', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  contador_empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  empresa_cliente_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  titulo: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING(80),
    allowNull: false,
    defaultValue: 'fiscal'
  },
  competencia: {
    type: DataTypes.STRING(7),
    allowNull: true
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  data_entrega: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'pendente'
  },
  dias_alerta_antecedencia: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 7
  },
  responsavel_contador_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  criado_por: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  atualizado_por: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  concluido_em: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'portal_contador_obrigacoes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default PortalContadorObrigacao;
