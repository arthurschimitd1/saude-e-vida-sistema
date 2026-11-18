import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AgendamentoUnidade = sequelize.define('AgendamentoUnidade', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    nome: { type: DataTypes.STRING(150), allowNull: false },
    endereco: { type: DataTypes.STRING(300), allowNull: true },
    telefone: { type: DataTypes.STRING(30), allowNull: true },
    ativa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    principal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
    tableName: 'agendamento_unidades',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default AgendamentoUnidade;
