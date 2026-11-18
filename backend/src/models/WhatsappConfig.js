import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WhatsappConfig = sequelize.define('WhatsappConfig', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    numero_whatsapp: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    zapi_instance_id: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    zapi_token: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    zapi_client_token: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    meta_ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    meta_app_id: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    meta_app_secret: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    meta_business_account_id: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    meta_phone_number_id: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    meta_access_token: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    meta_verify_token: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    meta_webhook_token: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    meta_api_version: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'v23.0'
    },
    meta_status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'nao_configurado'
    },
    meta_ultimo_teste_em: {
        type: DataTypes.DATE,
        allowNull: true
    },
    meta_ultimo_erro: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    meta_display_phone_number: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    meta_verified_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    webhook_token: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    nome_empresa: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    nome_responsavel: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    telefone_contato: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    email_suporte: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    email_meta: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    fuso_horario: {
        type: DataTypes.STRING(50),
        defaultValue: 'America/Sao_Paulo'
    },
    idioma: {
        type: DataTypes.STRING(10),
        defaultValue: 'pt-BR'
    },
    observacoes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ia_ativa: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    ia_modelo: {
        type: DataTypes.STRING(100),
        defaultValue: 'llama-3.3-70b-versatile'
    },
    ia_temperatura: {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 0.7
    },
    ia_max_contexto: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    ia_prompt_base: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ia_regras_comerciais: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ia_personalidade: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    horario_comercial: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    mensagens_padrao: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    automacao_agendamento: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
            ativa: false,
            mensagem: 'Olá! Para escolher a unidade, o profissional, os serviços e o melhor horário, faça seu agendamento por aqui:\n{{link}}',
            cooldown_horas: 168
        }
    }
}, {
    tableName: 'whatsapp_config',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default WhatsappConfig;
