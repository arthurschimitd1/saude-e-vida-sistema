import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Orcamento = sequelize.define('Orcamento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    numero: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // ── relacionamentos opcionais ──
    cliente_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'clientes', key: 'id' }
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
    // ── dados livres (caso o orçamento seja pra alguém sem cadastro) ──
    nome_cliente: {
        type: DataTypes.STRING,
        allowNull: false
    },
    complemento: {
        type: DataTypes.STRING,
        allowNull: true
    },
    funcionario_nome: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // ── datas ──
    data_orcamento: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    validade_orcamento: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // ── desconto ──
    desconto: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    desconto_valor: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    tipo_desconto: {
        type: DataTypes.STRING, // 'percent' ou 'valor'
        defaultValue: 'percent'
    },
    observacoes: {
        type: DataTypes.STRING,
        allowNull: true
    },
    valor_total: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('em_aberto', 'pago', 'cancelado'),
        defaultValue: 'em_aberto',
        allowNull: false
    }
}, {
    tableName: 'orcamentos',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default Orcamento;
