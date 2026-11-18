import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RateioAutomatico = sequelize.define('RateioAutomatico', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    centro_custo_id: { type: DataTypes.INTEGER, allowNull: false },
    metodo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['proporcional_area', 'por_usuario', 'por_departamento', 'personalizado']],
        },
    },
    configuracao: { type: DataTypes.JSONB, defaultValue: {} },
    ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
    tableName: 'rateio_automatico',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default RateioAutomatico;