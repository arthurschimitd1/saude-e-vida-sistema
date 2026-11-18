import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Contrato = sequelize.define('Contrato', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    titulo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    partes_envolvidas: {
        // A migration anterior converteu esta coluna para JSONB. Manter o
        // modelo como STRING fazia o PostgreSQL rejeitar o FormData enviado
        // pelo cadastro, deixando o modal aberto sem criar o contrato.
        type: DataTypes.JSONB,
        allowNull: false
    },
    contratante: {
        type: DataTypes.STRING,
        allowNull: true
    },
    contratado: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tipo_parte: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tipo_contrato: {
        type: DataTypes.ENUM('prestacao_servico', 'fornecimento', 'trabalho', 'locacao', 'outro'),
        allowNull: false
    },
    valor: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    data_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    data_vencimento: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    periodicidade: {
        type: DataTypes.ENUM('mensal', 'anual', 'sem_renovacao'),
        allowNull: false,
        defaultValue: 'sem_renovacao'
    },
    status: {
        type: DataTypes.ENUM('ativo', 'encerrado', 'em_analise', 'suspenso'),
        allowNull: false,
        defaultValue: 'em_analise'
    },
    responsavel_interno: {
        type: DataTypes.STRING,
        allowNull: true
    },
    observacoes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    observacoes_tipo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    corpo_contrato: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    pdf_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    anexo_public_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'empresas',
            key: 'id'
        }
    },
    criado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'contratos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Contrato;
