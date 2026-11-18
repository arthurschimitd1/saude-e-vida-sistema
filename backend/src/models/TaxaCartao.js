import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TaxaCartao = sequelize.define('TaxaCartao', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    adquirente: { type: DataTypes.STRING(100), allowNull: false },
    bandeira: { type: DataTypes.STRING(40), allowNull: false },
    tipo_cartao: { type: DataTypes.STRING(20), allowNull: false },
    parcelas_de: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    parcelas_ate: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    percentual: { type: DataTypes.DECIMAL(7, 4), allowNull: false, defaultValue: 0 },
    taxa_fixa: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    vigencia_inicio: { type: DataTypes.DATEONLY, allowNull: false },
    vigencia_fim: { type: DataTypes.DATEONLY, allowNull: true },
    ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
    tableName: 'taxas_cartao',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default TaxaCartao;
