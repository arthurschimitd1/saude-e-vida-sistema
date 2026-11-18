import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Âncora de identidade de um contato do WhatsApp. Um mesmo paciente pode entrar
// no CRM por MAIS DE UMA "porta": o número real (quando manda mensagem), um
// @lid privado (quando o atendente responde pelo celular OU o paciente liga) e
// um callId (id da chamada). O WhatsApp NÃO deixa converter @lid→número, então
// não dá pra casar tudo por telefone — por isso agregamos N identificadores por
// Cliente e o matching passa a buscar por QUALQUER um deles.
//
// confirmado=true  → cruzou de verdade (o número que criou o Cliente, ou um @lid
//                    que o atendente juntou na tela → dali pra frente é fonte de match).
// confirmado=false → candidato ainda não confirmado (não é usado pra casar automático,
//                    só alimenta o palpite de merge — ver DIAGNOSTICO e MergeService).
const WhatsappContatoIdentificador = sequelize.define('WhatsappContatoIdentificador', {
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
        allowNull: false
    },
    tipo: {
        type: DataTypes.STRING(10),
        allowNull: false // 'numero' | 'lid' | 'callId'
    },
    valor: {
        type: DataTypes.STRING(120),
        allowNull: false // número normalizado (só dígitos), o @lid cru, ou o callId
    },
    confirmado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'whatsapp_contato_identificadores',
    timestamps: true,
    createdAt: 'criado_em',
    updatedAt: 'atualizado_em',
    indexes: [
        // Uma âncora (tipo+valor) pertence a UM contato por empresa — trava
        // corrida de webhook que tentaria amarrar o mesmo @lid a 2 clientes.
        { unique: true, fields: ['empresa_id', 'tipo', 'valor'] }
    ]
});

export default WhatsappContatoIdentificador;
