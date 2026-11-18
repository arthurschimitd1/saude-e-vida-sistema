import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Procuracao = sequelize.define('Procuracao', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    tipo: {
        type: DataTypes.ENUM('emitida', 'recebida'),
        allowNull: false
    },
    outorgante_nome: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    outorgante_documento: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    outorgado_nome: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    outorgado_documento: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    data_emissao: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    data_validade: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    numero_referencia: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    poderes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    observacoes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('ativa', 'expirada', 'revogada'),
        allowNull: false,
        defaultValue: 'ativa'
    },
    data_revogacao: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    motivo_revogacao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    cliente_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    contrato_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    anexo_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    anexo_public_id: {
        type: DataTypes.STRING,
        allowNull: true
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
    tableName: 'procuracoes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Procuracao;