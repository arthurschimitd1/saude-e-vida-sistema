import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Marketing = sequelize.define('Marketing', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'empresas', key: 'id' }
    },
    nome: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    responsavel: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    descricao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    canal: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('planejado', 'em_andamento', 'pausado', 'concluido'),
        allowNull: false,
        defaultValue: 'planejado'
    },
    orcamento: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    gasto_real: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    retorno_estimado: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    retorno_real: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    data_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    data_fim: {
        type: DataTypes.DATEONLY,
        allowNull: true
    }
}, {
    tableName: 'projetos_marketing',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Marketing;
