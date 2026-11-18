import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EstoqueRoupaFoto = sequelize.define('EstoqueRoupaFoto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    variacao_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    foto_url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    public_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ordem: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'estoque_roupa_fotos',
    timestamps: true
});

export default EstoqueRoupaFoto;