import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Receita = sequelize.define('Receita', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    produto_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    descricao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    valor_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    custo_estimado: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    rendimento: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: null
    }
}, {
    tableName: 'receitas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Receita;
