import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Fornecedor = sequelize.define('Fornecedor', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'empresas', key: 'id' }
    },
    nomeCompleto: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: 'nome_completo'
    },
    cpf: {
        type: DataTypes.STRING(14),
        allowNull: true
    },
    cnpj: {
        type: DataTypes.STRING(18),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    telefone: {
        type: DataTypes.STRING(30),
        allowNull: false
    },
    cep: {
        type: DataTypes.STRING(9),
        allowNull: true
    },
    rua: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    bairro: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    cidade: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    estado: {
        type: DataTypes.STRING(2),
        allowNull: true
    },
    pais: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Brasil'
    },
    numero: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    complemento: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    pontoReferencia: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'ponto_referencia'
    },
    inscricao_estadual: {
        type: DataTypes.STRING(50),
        allowNull: true
    }
}, {
    tableName: 'fornecedores',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Fornecedor;
