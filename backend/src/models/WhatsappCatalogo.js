import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Catálogo genérico e editável por empresa para os dois campos que antes eram
// enum fixo em código (estágio do lead e motivo clínico). `chave` é o valor
// estável gravado em whatsapp_cliente_crm.estagio/motivo_clinico — os valores
// padrão usam as mesmas chaves que já existiam como enum, então dados antigos
// continuam válidos sem migração. `tipo` distingue as duas listas na mesma tabela.
const WhatsappCatalogo = sequelize.define('WhatsappCatalogo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    tipo: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    chave: {
        type: DataTypes.STRING(60),
        allowNull: false
    },
    nome: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    cor: {
        type: DataTypes.STRING(20),
        defaultValue: '#64748b'
    },
    ordem: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'whatsapp_catalogos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

export default WhatsappCatalogo;
