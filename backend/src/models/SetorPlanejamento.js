import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const SetorPlanejamento = sequelize.define('SetorPlanejamento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    nome: { type: DataTypes.STRING(100), allowNull: false },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    cor: { type: DataTypes.STRING(20), defaultValue: '#3b82f6' },
    criado_por: { type: DataTypes.INTEGER, allowNull: true },
    // Array de user_ids com acesso — JSONB para consultas simples sem tabela extra
    membros: { type: DataTypes.JSONB, defaultValue: [] },
}, {
    tableName: 'setores_planejamento',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default SetorPlanejamento;
