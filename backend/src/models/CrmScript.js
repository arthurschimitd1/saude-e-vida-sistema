import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CrmScript = sequelize.define('CrmScript', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    campaign_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    script_type: {
        type: DataTypes.STRING(100),
        defaultValue: 'primeiro_contato'
    }
}, {
    tableName: 'crm_scripts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default CrmScript;
