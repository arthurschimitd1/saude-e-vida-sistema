import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CrmProspect = sequelize.define('CrmProspect', {
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
    company_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    responsible_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    phone: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    landline: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    instagram: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    linkedin: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    youtube: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    tiktok: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    website: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    city: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    state: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    google_place_id: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    google_rating: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: true
    },
    google_reviews: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lead_score: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'Novo'
    },
    observations: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'crm_prospects',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default CrmProspect;
