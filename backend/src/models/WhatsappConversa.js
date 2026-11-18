import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Uma linha por telefone/thread de conversa no WhatsApp CRM (via Z-API).
// cliente_id fica nulo só entre o momento em que a conversa é criada e o
// momento em que o Cliente correspondente é resolvido/criado (mesma
// transação, então na prática nunca fica nulo por muito tempo).
const WhatsappConversa = sequelize.define('WhatsappConversa', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    cliente_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    telefone: {
        type: DataTypes.STRING(30),
        allowNull: false
    },
    nome_contato: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'aberta'
    },
    nao_lidas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    ultima_mensagem_preview: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    ultima_mensagem_em: {
        type: DataTypes.DATE,
        allowNull: true
    },
    responsavel_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    resumo_ia: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ultima_mensagem_direcao: {
        type: DataTypes.STRING(10),
        allowNull: true // 'recebida' | 'enviada' — quem mandou por último
    },
    nome_editado_manualmente: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false // trava o webhook de sobrescrever um nome já ajustado pelo atendente
    },
    resposta_agendamento_em: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'whatsapp_conversas',
    timestamps: true,
    createdAt: 'criado_em',
    updatedAt: 'atualizado_em'
});

export default WhatsappConversa;
