import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AgendamentoServico = sequelize.define('AgendamentoServico', {
    id: {
        type: DataTypes.STRING(80),
        primaryKey: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
    },
    nome: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    duracao_min: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30
    },
    preco: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    preco_texto: {
        type: DataTypes.STRING(200),
        allowNull: true,
    },
    comissao_tipo: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    comissao_valor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    cor: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '#3b82f6'
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: 'agendamento_servicos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default AgendamentoServico;
