import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Palpite de "estes dois são a mesma pessoa?" (opção B aprovada pelo Iago).
// Quando chega um evento só com @lid puro (sem número comum) e o sistema NÃO
// consegue casar com segurança, ele NÃO junta automático (zero risco de fundir
// paciente errado). Em vez disso registra um candidato: a conversa órfã do @lid
// + a conversa "alvo" que o palpite aponta (por nome exato + janela de tempo).
// O atendente vê o banner na tela e confirma "juntar" (→ IdentificadorService
// amarra o @lid ao Cliente alvo e funde as conversas) ou "não é" (→ descartado,
// nunca mais sugere esse par).
const WhatsappMergeCandidato = sequelize.define('WhatsappMergeCandidato', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    // Conversa órfã (a que nasceu do @lid puro, sem número).
    conversa_origem_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    // Conversa "de verdade" (do número real) pra onde o palpite quer juntar.
    conversa_alvo_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    // Por que o sistema achou que são a mesma pessoa (nome exato / janela de tempo).
    motivo: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(15),
        allowNull: false,
        defaultValue: 'pendente' // 'pendente' | 'confirmado' | 'descartado'
    }
}, {
    tableName: 'whatsapp_merge_candidatos',
    timestamps: true,
    createdAt: 'criado_em',
    updatedAt: 'atualizado_em',
    indexes: [
        // Não repetir o mesmo palpite (origem→alvo) enquanto ele está de pé.
        { unique: true, fields: ['empresa_id', 'conversa_origem_id', 'conversa_alvo_id'] }
    ]
});

export default WhatsappMergeCandidato;
