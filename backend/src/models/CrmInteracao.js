import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CrmInteracao = sequelize.define('CrmInteracao', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    prospect_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    interaction_type: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'crm_interacoes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

export default CrmInteracao;
