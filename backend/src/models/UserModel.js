import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
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
    cargo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: false  // Removendo unique temporariamente
    },
    senha: {
        type: DataTypes.STRING,
        allowNull: false
    },
    senha_texto: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    cep: {
        type: DataTypes.STRING(9),
        allowNull: true
    },
    rua: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ''
    },
    bairro: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ''
    },
    cidade: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ''
    },
    estado: {
        type: DataTypes.STRING(2),
        allowNull: true,
        defaultValue: ''
    },
    pais: {
        type: DataTypes.STRING,
        defaultValue: 'Brasil',
        allowNull: true
    },
    numero: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ''
    },
    pontoReferencia: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tipo: {
        type: DataTypes.ENUM('MASTER', 'EMPRESA', 'CONTADOR', 'USUARIO'),
        defaultValue: 'USUARIO',
        allowNull: false
    },
    status: {
    type: DataTypes.ENUM('ativo', 'bloqueado'),
    defaultValue: 'ativo',
    allowNull: false
    },
    permissoes: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    allowNull: true
    },
    comissao_tipo: {
        type: DataTypes.ENUM('percent', 'valor'),
        allowNull: true
    },
    comissao_valor: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,  // Inicialmente aceita NULL
        references: {
            model: 'empresas',
            key: 'id'
        }
    },
    google_id: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    avatar_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    avatar_position: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: '50% 50%'
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultScope: {
        attributes: { exclude: ['senha', 'senha_texto'] }
    },
    scopes: {
        withPassword: {
            attributes: { include: ['senha'] }
        }
    }
});

export default User;
