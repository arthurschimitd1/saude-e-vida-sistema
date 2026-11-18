import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const NuvemshopProdutoVinculo = sequelize.define('NuvemshopProdutoVinculo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  integracao_id: { type: DataTypes.INTEGER, allowNull: false },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  roupa_id: { type: DataTypes.INTEGER, allowNull: true },
  variacao_id: { type: DataTypes.INTEGER, allowNull: true },
  nuvemshop_product_id: { type: DataTypes.BIGINT, allowNull: false },
  nuvemshop_variant_id: { type: DataTypes.BIGINT, allowNull: false },
  nuvemshop_sku: { type: DataTypes.STRING, allowNull: true },
  tamanho: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Único' },
  cor: { type: DataTypes.STRING(500), allowNull: true },
  stock_management: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  inventory_levels: { type: DataTypes.JSONB, allowNull: true },
  last_remote_stock: { type: DataTypes.INTEGER, allowNull: true },
  last_local_stock: { type: DataTypes.INTEGER, allowNull: true },
  last_synced_at: { type: DataTypes.DATE, allowNull: true },
  last_error: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'nuvemshop_produto_vinculos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['integracao_id', 'nuvemshop_variant_id'] },
  ],
});

export default NuvemshopProdutoVinculo;
