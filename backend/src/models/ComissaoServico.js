import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ComissaoServico = sequelize.define('ComissaoServico', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'empresas', key: 'id' }
    },
    funcionario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    servico_nome: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    servico_chave: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    percentual: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    }
}, {
    tableName: 'comissao_servicos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default ComissaoServico;
