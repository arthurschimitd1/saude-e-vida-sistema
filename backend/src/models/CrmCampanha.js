import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CrmCampanha = sequelize.define('CrmCampanha', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    segment: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    states: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    cities: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    neighborhoods: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    radius: {
        type: DataTypes.INTEGER,
        defaultValue: 5
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'crm_campanhas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default CrmCampanha;
