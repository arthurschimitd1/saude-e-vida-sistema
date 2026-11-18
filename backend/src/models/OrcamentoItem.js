import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const OrcamentoItem = sequelize.define('OrcamentoItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    orcamento_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'orcamentos', key: 'id' }
    },
    // produto_id é opcional pra permitir itens "soltos" (sem cadastro)
    produto_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Products', key: 'id' }
    },
    nome: {
        type: DataTypes.STRING,
        allowNull: false
    },
    quantidade: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false
    },
    preco: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    }
}, {
    tableName: 'orcamento_itens',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default OrcamentoItem;
