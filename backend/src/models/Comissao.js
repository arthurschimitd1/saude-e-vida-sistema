import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Comissao = sequelize.define('Comissao', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    venda_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'vendas', key: 'id' }
    },
    funcionario_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'empresas', key: 'id' }
    },
    // Valor da comissão calculado no momento da venda (congela)
    valor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    // Tipo do cálculo usado (só pra histórico)
    tipo: {
        type: DataTypes.ENUM('percent', 'valor'),
        allowNull: false
    },
    // Valor original da configuração (5% ou R$10) — só pra referência
    valor_origem: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    origem: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'venda_produtos'
    },
    base_calculo: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    agendamento_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'agendamentos', key: 'id' }
    },
    servico_id: {
        type: DataTypes.STRING(80),
        allowNull: true
    },
    descricao: {
        type: DataTypes.STRING(300),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pendente', 'pago'),
        defaultValue: 'pendente',
        allowNull: false
    },
    data_pagamento: {
        type: DataTypes.DATE,
        allowNull: true
    },
    origem_calculo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'colaborador'
    },
    detalhes_calculo: {
        type: DataTypes.JSONB,
        allowNull: true
    }
}, {
    tableName: 'comissoes',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default Comissao;
