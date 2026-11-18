import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const VendaItem = sequelize.define('VendaItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  venda_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'vendas', key: 'id' }
  },
  produto_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Products', key: 'id' }
  },
  nome_item: {
    type: DataTypes.STRING(300),
    allowNull: true,
  },
  tipo: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'produto'
  },
  roupa_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'estoque_roupas', key: 'id' }
  },
  variacao_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'estoque_roupas_variacoes', key: 'id' }
  },
  raw_material_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'raw_materials', key: 'id' }
  },
  agendamento_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'agendamentos', key: 'id' }
  },
  agendamento_servico_id: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  catalogo_servico_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'services', key: 'id' }
  },
  quantidade: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false
  },
  valor_unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  valor_total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
}, {
  tableName: 'venda_itens',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

export default VendaItem;
