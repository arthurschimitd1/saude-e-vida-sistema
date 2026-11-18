import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TarefaStatusLog = sequelize.define('TarefaStatusLog', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tarefa_id: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING(50), allowNull: false },
    responsavel: { type: DataTypes.STRING(200), allowNull: true },
    iniciado_em: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    finalizado_em: { type: DataTypes.DATE, allowNull: true },
    duracao_min: { type: DataTypes.INTEGER, allowNull: true }
}, {
    tableName: 'tarefa_status_logs',
    timestamps: false
});

export default TarefaStatusLog;
