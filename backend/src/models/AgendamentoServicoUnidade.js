import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AgendamentoServicoUnidade = sequelize.define('AgendamentoServicoUnidade', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    servico_id: {
        type: DataTypes.STRING(80),
        allowNull: false,
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    duracao_min: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    preco: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    preco_texto: {
        type: DataTypes.STRING(200),
        allowNull: true,
    },
}, {
    tableName: 'agendamento_servico_unidades',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { unique: true, fields: ['empresa_id', 'unidade_id', 'servico_id'] },
    ],
});

export default AgendamentoServicoUnidade;
