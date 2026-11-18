import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Catálogo de etiquetas do WhatsApp CRM (ex: Cliente VIP, Em negociação,
// Convertido). A IA (fase futura) poderá sugerir etiquetas; o atendente
// decide se aceita — ver WhatsappClienteEtiqueta.status.
// `tipo` reaproveita a mesma tabela/vínculo pro catálogo de Protocolos
// (mesma UX de seleção/criação, só filtrado por tipo) — evita duplicar
// WhatsappClienteEtiqueta inteiro só pra protocolo.
const WhatsappEtiqueta = sequelize.define('WhatsappEtiqueta', {
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
        allowNull: false,
        defaultValue: 'etiqueta'
    },
    nome: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    cor: {
        type: DataTypes.STRING(20),
        defaultValue: '#64748b'
    }
}, {
    tableName: 'whatsapp_etiquetas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

export default WhatsappEtiqueta;
