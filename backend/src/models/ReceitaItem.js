import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ReceitaItem = sequelize.define('ReceitaItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    receita_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    raw_material_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    produto_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    quantidade: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1
    }
}, {
    tableName: 'receita_itens',
    timestamps: false
});

export default ReceitaItem;
