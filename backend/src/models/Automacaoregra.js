import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AutomacaoRegra = sequelize.define('AutomacaoRegra', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    descricao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    evento_gatilho: {
        type: DataTypes.ENUM(
            'nota_fiscal_recebida',
            'nota_fiscal_emitida',
            'estoque_abaixo_minimo',
            'conta_pagar_vence',
            'conta_receber_vence',
            'novo_cliente',
            'inconsistencia_fiscal',
            'budget_atingido'
        ),
        allowNull: false
    },
    parametros_gatilho: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
    },
    acoes: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
    },
    status: {
        type: DataTypes.ENUM('ativo', 'inativo'),
        allowNull: false,
        defaultValue: 'ativo'
    },
    total_execucoes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    ultima_execucao: {
        type: DataTypes.DATE,
        allowNull: true
    },
    falhas_consecutivas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    criado_por: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'automacao_regras',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default AutomacaoRegra;