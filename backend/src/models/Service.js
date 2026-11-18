import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Service = sequelize.define('Service', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    category: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    value: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    item_lista_servico: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    codigo_tributacao_municipio: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    codigo_cnae: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    codigo_indicador_operacao: {
        type: DataTypes.STRING(6),
        allowNull: true,
    },
    ibs_cbs_situacao_tributaria: {
        type: DataTypes.STRING(3),
        allowNull: true,
    },
    ibs_cbs_classificacao_tributaria: {
        type: DataTypes.STRING(6),
        allowNull: true,
    },
    aliquota: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
    },
    codigo_municipio: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    discriminacao_padrao: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    percentual_tributos: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    tableName: 'services',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
});

export default Service;
