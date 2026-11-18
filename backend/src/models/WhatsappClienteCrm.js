import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Overlay de atendimento do WhatsApp CRM sobre o Cliente já existente
// (não duplica dados de identidade do cliente — só o estado de atendimento).
// estagio/motivo_clinico apontam pra `chave` de um WhatsappCatalogo por
// empresa (catálogo editável pelo usuário — ver CatalogoService).

const WhatsappClienteCrm = sequelize.define('WhatsappClienteCrm', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    cliente_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    status_atendimento: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'aberto'
    },
    estagio: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'novo_lead'
    },
    motivo_clinico: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    // Profissional responsável pelo paciente — aponta pra `chave` de um
    // WhatsappCatalogo tipo='profissional' (mesmo padrão de estagio/motivo).
    // Opcional na atribuição antecipada; obrigatório no fechamento (Agendamentos).
    profissional: {
        type: DataTypes.STRING(60),
        allowNull: true
    },
    origem: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    responsavel_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    proximo_retorno: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    observacoes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'whatsapp_cliente_crm',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default WhatsappClienteCrm;
