import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CrmCampanhaFiltro = sequelize.define('CrmCampanhaFiltro', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    campaign_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    state: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    city: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    neighborhood: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    radius: {
        type: DataTypes.INTEGER,
        defaultValue: 5
    }
}, {
    tableName: 'crm_campanha_filtros',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

export default CrmCampanhaFiltro;
