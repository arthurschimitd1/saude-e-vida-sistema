import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Subtarefa = sequelize.define('Subtarefa', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tarefa_id: { type: DataTypes.INTEGER, allowNull: false },
    titulo: { type: DataTypes.STRING(300), allowNull: false },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    peso: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    concluida: { type: DataTypes.BOOLEAN, defaultValue: false },
    ordem: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
    tableName: 'subtarefas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Subtarefa;
