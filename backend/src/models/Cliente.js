import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Cliente = sequelize.define('Cliente', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nomeCompleto: {
        type: DataTypes.STRING,
        allowNull: false
    },
    cpf: {
        type: DataTypes.STRING(14),
        allowNull: true,
        unique: false
    },
    cnpj: {
        type: DataTypes.STRING(18),
        allowNull: true,
        unique: false
    },
    telefone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Campos de endereço (já existentes)
    cep: {
        type: DataTypes.STRING(9),
        allowNull: true
    },
    rua: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bairro: {
        type: DataTypes.STRING,
        allowNull: true
    },
    cidade: {
        type: DataTypes.STRING,
        allowNull: true
    },
    estado: {
        type: DataTypes.STRING(2),
        allowNull: true
    },
    pais: {
        type: DataTypes.STRING,
        defaultValue: 'Brasil',
        allowNull: true
    },
    numero: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pontoReferencia: {
        type: DataTypes.STRING,
        allowNull: true
    },
    complemento: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Complemento do endereço (opcional)'
    },
    // NOVO CAMPO para NF-e (inscrição estadual)
    inscricao_estadual: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Inscrição Estadual para clientes CNPJ (opcional)'
    },
    // NOVOS CAMPOS para NFS-e (inscrição e código municipal)
    inscricao_municipal: {
        type: DataTypes.STRING(30),
        allowNull: true,
        comment: 'Inscrição Municipal do cliente/tomador, quando aplicável'
    },

    codigo_municipio: {
        type: DataTypes.STRING(7),
        allowNull: true,
        comment: 'Código IBGE do município do cliente'
    },
    loja_senha_hash: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Senha do acesso do cliente à loja online; nunca armazena a senha em texto puro'
    },
    loja_ultimo_login: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Último acesso do cliente à loja online'
    },
    data_nascimento: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Data de nascimento para alerta de aniversariantes'
    },
    pontos_saldo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Pontos disponíveis no programa de fidelidade da loja'
    },
    pontos_acumulados: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de pontos acumulados pelo cliente'
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'empresas',
            key: 'id'
        }
    },
}, {
    tableName: 'clientes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Cliente;
