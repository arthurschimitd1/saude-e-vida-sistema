import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WhatsappMensagem = sequelize.define('WhatsappMensagem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    conversa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    direcao: {
        type: DataTypes.STRING(10),
        allowNull: false // 'recebida' | 'enviada'
    },
    tipo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'texto' // 'texto' | 'imagem' | 'documento' | 'audio'
    },
    conteudo_texto: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    midia_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    midia_nome: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    midia_mime: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    zapi_message_id: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'enviada' // 'enviando' | 'enviada' | 'entregue' | 'lida' | 'falha'
    },
    enviado_por_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    editado_em: {
        type: DataTypes.DATE,
        allowNull: true
    },
    transcricao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    origem: {
        type: DataTypes.STRING(50),
        allowNull: true
    }
}, {
    tableName: 'whatsapp_mensagens',
    timestamps: true,
    createdAt: 'criado_em',
    updatedAt: false
});

export default WhatsappMensagem;
