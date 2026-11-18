import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Log de auditoria/eventos do módulo WhatsApp CRM — webhooks recebidos da
// Z-API, falhas de envio, eventos de conexão da instância.
const WhatsappLog = sequelize.define('WhatsappLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    conversa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tipo: {
        type: DataTypes.STRING(30),
        allowNull: false
    },
    mensagem: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
}, {
    tableName: 'whatsapp_logs',
    timestamps: true,
    createdAt: 'criado_em',
    updatedAt: false
});

export default WhatsappLog;
