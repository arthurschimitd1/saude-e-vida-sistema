import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Agendamento = sequelize.define('Agendamento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'agendamento_unidades', key: 'id' }
    },
    cliente_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'clientes',
            key: 'id'
        }
    },
    colaborador_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'agendamento_colaboradores',
            key: 'id'
        }
    },
    servico_id: {
        type: DataTypes.STRING(80),
        allowNull: true
    },
    servico_nome: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    servico_preco: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    servico_preco_texto: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    servico_duracao_min: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    servicos: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
    },
    data: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    horario: {
        type: DataTypes.STRING(5),
        allowNull: false
    },
    observacao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'aguardando'
    },
    criado_em: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    forma_pagamento: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    cliente_nome: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    cliente_telefone: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    cliente_email: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    cliente_nascimento: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    historico: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
    },
    encaixe_forcado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'agendamentos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Agendamento;
