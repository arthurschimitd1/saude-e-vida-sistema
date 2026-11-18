import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Contador = sequelize.define('Contador', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: 'contadores_user_id_key',
        references: {
            model: 'users',
            key: 'id',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        }
    },
    status: {
        type: DataTypes.ENUM('online', 'offline', 'ausente'),
        defaultValue: 'offline',
        allowNull: false
    },
    telefone_profissional: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    whatsapp_profissional: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    horario_atendimento: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    ultimo_acesso: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: true
    }
}, {
    tableName: 'contadores',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Contador;
