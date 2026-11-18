import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Tarefa = sequelize.define('Tarefa', {
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
    titulo: {
        type: DataTypes.STRING(300),
        allowNull: false
    },
    descricao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    responsavel: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    responsaveis: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    prioridade: {
        type: DataTypes.ENUM('urgente', 'alta', 'normal', 'baixa'),
        allowNull: false,
        defaultValue: 'normal'
    },
    status: {
        type: DataTypes.ENUM('a_fazer', 'em_andamento', 'em_revisao', 'concluido'),
        allowNull: false,
        defaultValue: 'a_fazer'
    },
    tags: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    data_inicio: {
        type: DataTypes.DATE,
        allowNull: true
    },
    data_entrega: {
        type: DataTypes.DATE,
        allowNull: true
    },
    data_conclusao: {
        type: DataTypes.DATE,
        allowNull: true
    },
    ordem: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    motivo_retorno: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    data_limite_retorno: {
        type: DataTypes.DATE,
        allowNull: true
    },
    setor_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    coluna_custom_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'tarefas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Tarefa;
