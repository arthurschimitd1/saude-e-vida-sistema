import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CrmWhatsappMensagem = sequelize.define('CrmWhatsappMensagem', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    conversa_id: { type: DataTypes.INTEGER, allowNull: false },
    external_id: { type: DataTypes.STRING(255), allowNull: true },
    direction: { type: DataTypes.STRING(10), allowNull: false },
    type: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'text' },
    content: { type: DataTypes.TEXT, allowNull: true },
    media_url: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'recebida' },
    sent_by: { type: DataTypes.INTEGER, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    raw_payload: { type: DataTypes.JSONB, allowNull: true },
}, {
    tableName: 'crm_whatsapp_mensagens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
});

export default CrmWhatsappMensagem;
