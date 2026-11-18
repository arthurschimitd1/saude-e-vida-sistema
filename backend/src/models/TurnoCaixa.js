import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TurnoCaixa = sequelize.define('TurnoCaixa', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'empresas', key: 'id' }
    },
    func_abertura_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    func_abertura_nome: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    valor_abertura: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    data_abertura: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    func_fechamento_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    func_fechamento_nome: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    valor_fechamento: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    data_fechamento: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'aberto'
    }
}, {
    tableName: 'turnos_caixa',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

export default TurnoCaixa;
