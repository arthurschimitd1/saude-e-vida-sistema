import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CrmWhatsappConversa = sequelize.define('CrmWhatsappConversa', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    prospect_id: { type: DataTypes.INTEGER, allowNull: true },
    cliente_id: { type: DataTypes.INTEGER, allowNull: true },
    assigned_user_id: { type: DataTypes.INTEGER, allowNull: true },
    phone: { type: DataTypes.STRING(30), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    avatar_url: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'aberto' },
    tags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    unread_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_message_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: 'crm_whatsapp_conversas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default CrmWhatsappConversa;
