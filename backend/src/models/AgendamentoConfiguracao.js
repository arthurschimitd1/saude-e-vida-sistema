import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AgendamentoConfiguracao = sequelize.define('AgendamentoConfiguracao', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    hora_inicio: { type: DataTypes.TIME, allowNull: false },
    hora_fim: { type: DataTypes.TIME, allowNull: false },
    intervalo_min: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'agendamento_configuracoes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default AgendamentoConfiguracao;
