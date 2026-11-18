import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EntradaInsumoSemNota = sequelize.define('EntradaInsumoSemNota', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'empresas', key: 'id' }
  },
  raw_material_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'raw_materials', key: 'id' }
  },
  produto_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Products', key: 'id' }
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  quantidade: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false
  },
  preco_unitario: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: true
  },
  preco_anterior: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: true
  },
  estoque_anterior: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true
  },
  estoque_posterior: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true
  },
  data_entrada: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  observacao: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  origem_tipo: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'entrada_sem_nf'
  },
  origem_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  documento: {
    type: DataTypes.STRING(120),
    allowNull: true
  }
}, {
  tableName: 'entradas_insumo_sem_nf',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

export default EntradaInsumoSemNota;
