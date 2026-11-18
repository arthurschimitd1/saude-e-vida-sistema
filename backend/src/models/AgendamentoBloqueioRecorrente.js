import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AgendamentoBloqueioRecorrente = sequelize.define('AgendamentoBloqueioRecorrente', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    colaborador_id: { type: DataTypes.INTEGER, allowNull: false },
    data_inicio: { type: DataTypes.DATEONLY, allowNull: false },
    data_fim: { type: DataTypes.DATEONLY, allowNull: true },
    dias_semana: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    hora_inicio: { type: DataTypes.TIME, allowNull: true },
    hora_fim: { type: DataTypes.TIME, allowNull: true },
    motivo: { type: DataTypes.STRING(300), allowNull: true },
    ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    tableName: 'agendamento_bloqueios_recorrentes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default AgendamentoBloqueioRecorrente;
