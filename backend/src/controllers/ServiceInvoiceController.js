import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { fiscalDateTime } from '../utils/businessTime.js';
import ServiceInvoice from '../models/ServiceInvoice.js';
import EmpresaConfigFiscal from '../models/EmpresaConfigFiscal.js';
import focusService from '../services/focus/FocusNFSeService.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

const getEmpresaId = (req) => {
    const fromUser = empresaParaGravar(req.user);
    if (fromUser) return fromUser;
    if (req.query.empresa_id) return Number(req.query.empresa_id);
    if (req.body?.empresa_id) return Number(req.body.empresa_id);
    return null;
};

export const listar = async (req, res) => {
    try {
        const where = {};
        aplicarEmpresaScope(where, req.user);
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }

        if (req.query.status) {
            where.status = req.query.status;
        }
        if (req.query.search) {
            where[Op.or] = [
                { customer_name: { [Op.iLike]: `%${req.query.search}%` } },
                { reference: { [Op.iLike]: `%${req.query.search}%` } },
                { service_name: { [Op.iLike]: `%${req.query.search}%` } },
            ];
        }
        if (req.query.data_inicio) {
            where.createdAt = { ...where.createdAt, [Op.gte]: new Date(req.query.data_inicio) };
        }
        if (req.query.data_fim) {
            const fim = new Date(req.query.data_fim);
            fim.setHours(23, 59, 59, 999);
            where.createdAt = { ...where.createdAt, [Op.lte]: fim };
        }

        const invoices = await ServiceInvoice.findAll({ where, order: [['createdAt', 'DESC']] });
        res.json(invoices);
    } catch (err) {
        console.error('Erro ao listar NFS-e:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getById = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }
        const invoice = await ServiceInvoice.findOne({ where });
        if (!invoice) return res.status(404).json({ error: 'NFS-e não encontrada' });
        res.json(invoice);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const emitir = async (req, res) => {
    let invoice = null;
    try {
        const empresa_id = getEmpresaId(req);
        if (!empresa_id) return res.status(400).json({ error: 'empresa_id é obrigatório' });

        // 1. Carregar configuração fiscal
        const config = await EmpresaConfigFiscal.findOne({ where: { empresa_id } });
        if (!config) return res.status(400).json({ error: 'Configuração fiscal não encontrada. Cadastre o token e CNPJ.' });
        if (!config.focusnfe_token) return res.status(400).json({ error: 'Token Focus NFe não configurado.' });

        // 2. Carregar configuração NFS-e
        const [nfseConfig] = await sequelize.query(
            `SELECT * FROM nfse_configs WHERE empresa_id = :empresa_id LIMIT 1`,
            { replacements: { empresa_id }, type: sequelize.QueryTypes.SELECT }
        );

        // 3. Gerar referência única
        const reference = `NFSE-${empresa_id}-${Date.now()}`;

        const body = req.body;
        const valorServicos = parseFloat(body.valor_servicos || 0);
        const desconto = parseFloat(body.desconto || 0);
        const deducoes = parseFloat(body.deducoes || 0);
        const aliquota = parseFloat(body.aliquota || 0);
        const iss = parseFloat(body.iss || (valorServicos * aliquota / 100));
        const issRetido = body.iss_retido === true || body.iss_retido === 'true';
        const pis = parseFloat(body.pis || 0);
        const cofins = parseFloat(body.cofins || 0);
        const inss = parseFloat(body.inss || 0);
        const irrf = parseFloat(body.irrf || 0);
        const csll = parseFloat(body.csll || 0);
        const outrasRetencoes = parseFloat(body.outras_retencoes || 0);
        const valorLiquido = parseFloat(body.valor_liquido || (valorServicos - desconto - pis - cofins - inss - irrf - csll - (issRetido ? iss : 0) - outrasRetencoes));

        // 4. Criar registro com status processando
        invoice = await ServiceInvoice.create({
            empresa_id,
            reference,
            service_id: body.service_id || null,
            service_name: body.service_name || '',
            service_description: body.service_description || '',
            customer_name: body.customer_name || '',
            customer_cpf_cnpj: body.customer_cpf_cnpj || '',
            customer_email: body.customer_email || '',
            customer_phone: body.customer_phone || '',
            customer_inscricao_municipal: body.customer_inscricao_municipal || '',
            customer_logradouro: body.customer_logradouro || '',
            customer_numero: body.customer_numero || '',
            customer_complemento: body.customer_complemento || '',
            customer_bairro: body.customer_bairro || '',
            customer_cidade: body.customer_cidade || '',
            customer_uf: body.customer_uf || '',
            customer_cep: body.customer_cep || '',
            customer_codigo_municipio: body.customer_codigo_municipio || '',
            valor_servicos: valorServicos,
            desconto,
            deducoes,
            valor_liquido: valorLiquido,
            pis,
            cofins,
            inss,
            irrf,
            csll,
            iss,
            iss_retido: issRetido,
            outras_retencoes: outrasRetencoes,
            item_lista_servico: body.item_lista_servico || '',
            codigo_tributacao_municipio: body.codigo_tributacao_municipio || '',
            codigo_cnae: body.codigo_cnae || '',
            aliquota,
            natureza_operacao: body.natureza_operacao || 1,
            optante_simples_nacional: body.optante_simples_nacional || false,
            status: 'processando',
        });

        // 5. Montar payload Focus NFe
        const cpfCnpj = (body.customer_cpf_cnpj || '').replace(/\D/g, '');
        const tomadorDoc = cpfCnpj.length === 11
            ? { cpf: cpfCnpj }
            : cpfCnpj.length === 14
                ? { cnpj: cpfCnpj }
                : {};

        const payload = {
            data_emissao: fiscalDateTime(),
            prestador: {
                cnpj: (config.cnpj_emitente || '').replace(/\D/g, ''),
                inscricao_municipal: nfseConfig?.inscricao_municipal || '',
                codigo_municipio: nfseConfig?.codigo_municipio || body.customer_codigo_municipio || '',
            },
            tomador: {
                ...tomadorDoc,
                razao_social: body.customer_name || '',
                email: body.customer_email || '',
                telefone: (body.customer_phone || '').replace(/\D/g, ''),
                inscricao_municipal: body.customer_inscricao_municipal || undefined,
                endereco: {
                    logradouro: body.customer_logradouro || '',
                    numero: body.customer_numero || '',
                    complemento: body.customer_complemento || undefined,
                    bairro: body.customer_bairro || '',
                    codigo_municipio: body.customer_codigo_municipio || '',
                    uf: body.customer_uf || '',
                    cep: (body.customer_cep || '').replace(/\D/g, ''),
                },
            },
            servico: {
                aliquota: aliquota / 100,
                base_calculo: valorServicos - deducoes,
                discriminacao: body.service_description || body.service_name || '',
                iss_retido: issRetido,
                item_lista_servico: body.item_lista_servico || '',
                codigo_cnae: body.codigo_cnae || undefined,
                codigo_tributacao_municipio: body.codigo_tributacao_municipio || undefined,
                valor_iss: iss,
                valor_liquido: valorLiquido,
                valor_servicos: valorServicos,
                deducoes,
                desconto_condicionado: 0,
                desconto_incondicionado: desconto,
                outras_retencoes: outrasRetencoes,
                pis,
                cofins,
                inss,
                irrf,
                csll,
            },
            natureza_operacao: body.natureza_operacao || 1,
            optante_simples_nacional: nfseConfig?.optante_simples_nacional ?? body.optante_simples_nacional ?? false,
            incentivador_cultural: nfseConfig?.incentivador_cultural ?? false,
        };

        // 6. Chamar Focus NFe
        const focusService = new FocusNFSeService(config.focusnfe_token, config.ambiente);
        let focusResponse;
        try {
            focusResponse = await focusService.emitirNFSe(reference, payload);
        } catch (focusErr) {
            const errData = focusErr.response?.data || focusErr.message;
            await invoice.update({
                status: 'erro_autorizacao',
                focus_response: errData,
                error_messages: errData,
            });
            return res.status(focusErr.response?.status || 500).json({ error: errData, invoice });
        }

        // 7. Atualizar registro com resposta
        const novoStatus = focusResponse.status || 'processando_autorizacao';
        await invoice.update({
            status: novoStatus,
            nfse_number: focusResponse.numero || focusResponse.nfse_number || null,
            verification_code: focusResponse.codigo_verificacao || null,
            xml_url: focusResponse.caminho_xml_nota_fiscal || null,
            pdf_url: focusResponse.caminho_danfse || null,
            focus_response: focusResponse,
        });

        res.status(201).json({ invoice, focus: focusResponse });
    } catch (err) {
        console.error('Erro ao emitir NFS-e:', err);
        if (invoice) {
            await invoice.update({ status: 'erro_autorizacao', error_messages: { error: err.message } }).catch(() => {});
        }
        res.status(500).json({ error: err.message });
    }
};

export const consultar = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }
        const invoice = await ServiceInvoice.findOne({ where });
        if (!invoice) return res.status(404).json({ error: 'NFS-e não encontrada' });

        const config = await EmpresaConfigFiscal.findOne({ where: { empresa_id: invoice.empresa_id } });
        if (!config) return res.status(400).json({ error: 'Configuração fiscal não encontrada' });

        const focusService = new FocusNFSeService(config.focusnfe_token, config.ambiente);
        try {
            const focusResponse = await focusService.consultarNFSe(invoice.reference);
            await invoice.update({
                status: focusResponse.status || invoice.status,
                nfse_number: focusResponse.numero || invoice.nfse_number,
                verification_code: focusResponse.codigo_verificacao || invoice.verification_code,
                xml_url: focusResponse.caminho_xml_nota_fiscal || invoice.xml_url,
                pdf_url: focusResponse.caminho_danfse || invoice.pdf_url,
                focus_response: focusResponse,
            });
            res.json({ invoice, focus: focusResponse });
        } catch (focusErr) {
            res.status(focusErr.response?.status || 500).json({ error: focusErr.response?.data || focusErr.message });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const cancelar = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }
        const invoice = await ServiceInvoice.findOne({ where });
        if (!invoice) return res.status(404).json({ error: 'NFS-e não encontrada' });

        const justificativa = req.body?.justificativa || 'Cancelamento solicitado pelo emitente';

        const config = await EmpresaConfigFiscal.findOne({ where: { empresa_id: invoice.empresa_id } });
        if (!config) return res.status(400).json({ error: 'Configuração fiscal não encontrada' });

        const focusService = new FocusNFSeService(config.focusnfe_token, config.ambiente);
        try {
            const focusResponse = await focusService.cancelarNFSe(invoice.reference, justificativa);
            await invoice.update({
                status: 'cancelado',
                cancelamento_justificativa: justificativa,
                focus_response: focusResponse,
            });
            res.json({ invoice, focus: focusResponse });
        } catch (focusErr) {
            res.status(focusErr.response?.status || 500).json({ error: focusErr.response?.data || focusErr.message });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const reenviarEmail = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }
        const invoice = await ServiceInvoice.findOne({ where });
        if (!invoice) return res.status(404).json({ error: 'NFS-e não encontrada' });

        const emails = req.body?.emails || (invoice.customer_email ? [invoice.customer_email] : []);
        if (!emails.length) return res.status(400).json({ error: 'Nenhum email informado' });

        const config = await EmpresaConfigFiscal.findOne({ where: { empresa_id: invoice.empresa_id } });
        if (!config) return res.status(400).json({ error: 'Configuração fiscal não encontrada' });

        const focusService = new FocusNFSeService(config.focusnfe_token, config.ambiente);
        try {
            const focusResponse = await focusService.reenviarEmail(invoice.reference, emails);
            await invoice.update({ email_enviado_em: new Date() });
            res.json({ success: true, focus: focusResponse });
        } catch (focusErr) {
            res.status(focusErr.response?.status || 500).json({ error: focusErr.response?.data || focusErr.message });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
