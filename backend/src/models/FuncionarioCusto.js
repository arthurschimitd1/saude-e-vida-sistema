// backend/src/models/FuncionarioCusto.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FuncionarioCusto = sequelize.define('FuncionarioCusto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    nomeCompleto: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'nomeCompleto'  // Nome da coluna no banco
    },
    cpf: {
        type: DataTypes.STRING(14),
        allowNull: true
    },
    cargo: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    tipoContrato: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'tipoContrato',
        defaultValue: 'CLT'
    },
    salarioBruto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'salarioBruto'
    },
    cargaHoraria: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'cargaHoraria'
    },
    dataAdmissao: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'dataAdmissao'
    },
    nivelRisco: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'nivelRisco',
        defaultValue: 1
    },
    departamento: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'ATIVO'
    },
    dependentes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    gestorResponsavel: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'gestor_responsavel'  // Corrigido para o nome correto
    },
    tipoJornada: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'tipo_jornada',  // Corrigido para o nome correto
        defaultValue: 'PRESENCIAL'
    },
    observacoes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    beneficios: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
    },
    custos: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true
    },
    historicoSalarios: {
        type: DataTypes.JSONB,
        allowNull: true,  
        field: 'historicosalarios',
        defaultValue: []
    },
    historicoPagamentos: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'historicopagamentos',
        defaultValue: []
    },
    historicoPromocoes: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'historicopromocoes',
        defaultValue: []
    },
    historicoFerias: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'historicoferias',
        defaultValue: []
    },
    dataPagamento: {
        type: DataTypes.STRING(7),
        allowNull: true,
        field: 'datapagamento'
    },
}, {
    tableName: 'funcionarios_custos',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default FuncionarioCusto;