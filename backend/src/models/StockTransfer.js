import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const StockTransfer = sequelize.define('StockTransfer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  unidade_origem_id: { type: DataTypes.INTEGER, allowNull: false },
  unidade_destino_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  quantidade: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
  observacao: { type: DataTypes.STRING(500), allowNull: true }
}, {
  tableName: 'stock_transfers', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at'
});

export default StockTransfer;
