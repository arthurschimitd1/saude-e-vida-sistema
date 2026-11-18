import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Movimento = sequelize.define('Movimento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    produto_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' }
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'empresas', key: 'id' }
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    tipo: {
        type: DataTypes.ENUM('entrada', 'saida'),
        allowNull: false
    },
    quantidade: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false
    },
    motivo: {
        type: DataTypes.STRING,
        allowNull: false 
    },
    origem_tipo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    origem_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tipo_movimento: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    classificacao_desperdicio: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    observacao_desperdicio: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    data: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'movimentos',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default Movimento;
