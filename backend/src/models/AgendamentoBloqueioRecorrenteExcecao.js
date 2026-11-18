import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AgendamentoBloqueioRecorrenteExcecao = sequelize.define('AgendamentoBloqueioRecorrenteExcecao', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    colaborador_id: { type: DataTypes.INTEGER, allowNull: false },
    recorrente_id: { type: DataTypes.INTEGER, allowNull: false },
    data: { type: DataTypes.DATEONLY, allowNull: false },
}, {
    tableName: 'agendamento_bloqueios_recorrentes_excecoes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default AgendamentoBloqueioRecorrenteExcecao;
