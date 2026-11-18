import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ServiceInvoice = sequelize.define('ServiceInvoice', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    reference: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: true,
    },
    rps_numero: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    service_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    service_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    service_description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    customer_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    customer_cpf_cnpj: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    customer_email: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    customer_phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    customer_inscricao_municipal: {
        type: DataTypes.STRING(30),
        allowNull: true,
    },
    customer_logradouro: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    customer_numero: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    customer_complemento: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    customer_bairro: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    customer_cidade: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    customer_uf: {
        type: DataTypes.STRING(2),
        allowNull: true,
    },
    customer_cep: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    customer_codigo_municipio: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    valor_servicos: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    desconto: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    deducoes: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    valor_liquido: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    pis: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    cofins: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    inss: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    irrf: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    csll: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    iss: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    iss_retido: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    outras_retencoes: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
    },
    item_lista_servico: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    codigo_tributacao_municipio: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    codigo_cnae: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    aliquota: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
    },
    natureza_operacao: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
    },
    optante_simples_nacional: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'pendente',
    },
    nfse_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    verification_code: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    xml_url: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    pdf_url: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    focus_response: {
        type: DataTypes.JSONB,
        allowNull: true,
    },
    error_messages: {
        type: DataTypes.JSONB,
        allowNull: true,
    },
    cancelamento_justificativa: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    email_enviado_em: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'service_invoices',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
});

export default ServiceInvoice;
