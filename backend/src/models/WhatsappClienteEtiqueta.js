import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Vínculo entre um cliente (WhatsappClienteCrm) e uma etiqueta do catálogo
// (WhatsappEtiqueta). Guarda se a sugestão veio da IA e se o atendente
// aceitou/rejeitou — preparado para a fase futura de IA, sem depender dela.
const WhatsappClienteEtiqueta = sequelize.define('WhatsappClienteEtiqueta', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    cliente_crm_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    etiqueta_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'aceita'
    },
    sugerida_por_ia: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'whatsapp_cliente_etiquetas',
    timestamps: true,
    createdAt: 'criado_em',
    updatedAt: false
});

export default WhatsappClienteEtiqueta;
