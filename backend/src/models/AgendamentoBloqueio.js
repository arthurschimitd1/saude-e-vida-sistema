import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AgendamentoBloqueio = sequelize.define('AgendamentoBloqueio', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    colaborador_id: { type: DataTypes.INTEGER, allowNull: false },
    data: { type: DataTypes.DATEONLY, allowNull: false },
    hora_inicio: { type: DataTypes.TIME, allowNull: true },
    hora_fim: { type: DataTypes.TIME, allowNull: true },
    motivo: { type: DataTypes.STRING(300), allowNull: true },
}, {
    tableName: 'agendamento_bloqueios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default AgendamentoBloqueio;
