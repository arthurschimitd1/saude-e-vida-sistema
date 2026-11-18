import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CrmWhatsappConfig = sequelize.define('CrmWhatsappConfig', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    provider: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'zapi' },
    instance_id: { type: DataTypes.STRING(255), allowNull: false },
    token_encrypted: { type: DataTypes.TEXT, allowNull: false },
    client_token_encrypted: { type: DataTypes.TEXT, allowNull: false },
    webhook_secret: { type: DataTypes.STRING(100), allowNull: false },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    tableName: 'crm_whatsapp_configs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default CrmWhatsappConfig;
