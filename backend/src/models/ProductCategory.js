import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ProductCategory = sequelize.define('ProductCategory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nome: { type: DataTypes.STRING, allowNull: false },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'empresas', key: 'id' }
    }
}, {
    tableName: 'ProductCategories',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default ProductCategory;
