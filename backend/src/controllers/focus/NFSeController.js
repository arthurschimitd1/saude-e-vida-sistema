// src/controllers/fiscal/NFSeController.js

import Cliente from '../../models/Cliente.js';
import Service from '../../models/Service.js';
import Venda from '../../models/Venda.js';
import NotaFiscalServicoEmitida from '../../models/NotaFiscalServicoEmitida.js';
import ConfiguracaoFiscal from '../../models/ConfiguracaoFiscal.js';

import NFSePayloadBuilder from '../../services/builders/NFSePayloadBuilder.js';
import FocusNFSeService from '../../services/focus/FocusNFSeService.js';
import { notaTemEmissaoAtiva } from '../../services/focus/fiscalRetry.js';

import { aplicarEmpresaScope, empresaParaGravar } from '../../utils/empresaScope.js';

async function buscarNota(id, req) {
    const where = {
        id,
        tipo: 'NFSE'
    };

    aplicarEmpresaScope(
        where,
        req.currentUser || req.user
    );

    if (!where.empresa_id && req.query.empresaId) {
        where.empresa_id =
            Number(req.query.empresaId);
    }

    if (!where.empresa_id && req.query.empresa_id) {
        where.empresa_id =
            Number(req.query.empresa_id);
    }

    if (!where.empresa_id && req.body?.empresa_id) {
        where.empresa_id =
            Number(req.body.empresa_id);
    }

    if (!where.empresa_id) {
        return null;
    }

    return NotaFiscalServicoEmitida.findOne({
        where
    });
}

function statusErro(error) {
    const status = Number(error?.code);

    return status >= 400 && status <= 599
        ? status
        : 500;
}

const servicoAvulso = (dados = {}) => ({
    ativo: true,
    name: String(dados.servico_nome || '').trim(),
    description: String(dados.servico_descricao || '').trim(),
    discriminacao_padrao: String(dados.servico_descricao || '').trim(),
    item_lista_servico: String(dados.item_lista_servico || '').trim(),
    codigo_tributacao_municipio: String(dados.codigo_tributacao_municipio || '').trim(),
    codigo_cnae: String(dados.codigo_cnae || '').trim(),
    codigo_indicador_operacao: String(dados.codigo_indicador_operacao || '').trim(),
    ibs_cbs_situacao_tributaria: String(dados.ibs_cbs_situacao_tributaria || '').trim(),
    ibs_cbs_classificacao_tributaria: String(dados.ibs_cbs_classificacao_tributaria || '').trim(),
    aliquota: Number(dados.aliquota ?? 0),
    natureza_operacao: Number(dados.natureza_operacao ?? 1)
});

class NFSeController {
    async emitir(req, res) {
        try {
            const empresaId =
                empresaParaGravar(req.currentUser || req.user) ??
                Number(req.body.empresa_id);

            if (!empresaId) {
                return res.status(400).json({
                    success: false,
                    message: 'Empresa não identificada.'
                });
            }

            const vendaId = Number(req.body.venda_id) || null;
            const clienteSolicitadoId = Number(req.body.cliente_id);
            const servicoId = Number(req.body.service_id);
            const usarServicoAvulso = Boolean(req.body.servico_avulso);

            if (!clienteSolicitadoId && !vendaId) {
                return res.status(400).json({
                    success: false,
                    message: 'Selecione o cliente ou uma venda realizada.'
                });
            }

            if (!servicoId && !usarServicoAvulso) {
                return res.status(400).json({
                    success: false,
                    message: 'Selecione o serviço ou informe os dados fiscais manualmente.'
                });
            }

            const [venda, configuracaoFiscal] = await Promise.all([
                vendaId
                    ? Venda.findOne({ where: { id: vendaId, empresa_id: empresaId } })
                    : null,
                ConfiguracaoFiscal.findOne({ where: { empresa_id: empresaId } })
            ]);

            if (vendaId && !venda) {
                return res.status(404).json({
                    success: false,
                    message: 'Venda não encontrada para esta empresa.'
                });
            }

            const clienteId = venda ? Number(venda.cliente_id) : clienteSolicitadoId;
            if (!clienteId) {
                return res.status(400).json({
                    success: false,
                    message: 'A venda selecionada não possui cliente. Cadastre o cliente antes de emitir a NFS-e.'
                });
            }

            const [cliente, servico] = await Promise.all([
                Cliente.findOne({ where: { id: clienteId, empresa_id: empresaId } }),
                usarServicoAvulso
                    ? Promise.resolve(servicoAvulso(req.body))
                    : Service.findOne({ where: { id: servicoId, empresa_id: empresaId } })
            ]);

            if (!cliente) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente não encontrado.'
                });
            }

            if (!servico) {
                return res.status(404).json({
                    success: false,
                    message: 'Serviço não encontrado.'
                });
            }

            if (servico.ativo === false) {
                return res.status(400).json({
                    success: false,
                    message: 'O serviço selecionado está inativo.'
                });
            }

            if (!configuracaoFiscal) {
                return res.status(400).json({
                    success: false,
                    message: 'Configuração fiscal não encontrada.'
                });
            }

            if (vendaId) {
                const notasDaVenda = await NotaFiscalServicoEmitida.findAll({
                    where: { empresa_id: empresaId, venda_id: vendaId },
                    attributes: ['id', 'status']
                });
                if (notasDaVenda.some(nota => notaTemEmissaoAtiva(nota.status))) {
                    return res.status(409).json({
                        success: false,
                        message: 'Esta venda já possui uma NFS-e autorizada ou em processamento.'
                    });
                }
            }

            const dadosEmissao = {
                ...req.body,
                cliente_id: clienteId,
                venda_id: vendaId,
                // A origem é uma venda já finalizada: o valor emitido vem
                // sempre dela, não do campo editável enviado pela tela.
                ...(venda ? { valor_total: Number(venda.valor_total) } : {})
            };

            const payload = NFSePayloadBuilder.build({
                cliente,
                servico,
                configuracaoFiscal,
                dadosEmissao
            });

            const resultado = await FocusNFSeService.emitir(
                empresaId,
                cliente.id,
                servico.id ?? null,
                payload,
                { vendaId }
            );

            if (!resultado.success) {
                return res.status(statusErro(resultado.error)).json({
                    success: false,
                    message: resultado.error?.message || 'Erro ao emitir NFS-e.',
                    errors: resultado.error?.errors || [],
                    details: resultado.error?.details
                });
            }

            return res.status(201).json({
                success: true,
                data: resultado.registro,
                focus: resultado.data
            });
        } catch (error) {
            console.error('Erro ao emitir NFS-e:', error);

            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Erro ao emitir NFS-e.'
            });
        }
    }
    
    async consultar(req, res) {
        try {
            const nota = await buscarNota(req.params.id, req);

            if (!nota) {
                return res.status(404).json({
                    success: false,
                    message: 'NFS-e não encontrada.'
                });
            }

            const resultado = await FocusNFSeService.consultar(
                nota.empresa_id,
                nota.referencia_externa
            );

            if (!resultado.success) {
                return res.status(statusErro(resultado.error)).json({
                    success: false,
                    message: resultado.error?.message || 'Erro ao consultar NFS-e.',
                    errors: resultado.error?.errors || [],
                    details: resultado.error?.details
                });
            }

            return res.json({
                success: true,
                data: resultado.registro,
                focus: resultado.data
            });
        } catch (error) {
            console.error('Erro ao consultar NFS-e:', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Erro ao consultar NFS-e.'
            });
        }
    }

    async cancelar(req, res) {
        try {
            const justificativa = req.body.justificativa?.trim();

            if (!justificativa) {
                return res.status(400).json({
                    success: false,
                    message: 'A justificativa é obrigatória.'
                });
            }

            const nota = await buscarNota(req.params.id, req);

            if (!nota) {
                return res.status(404).json({
                    success: false,
                    message: 'NFS-e não encontrada.'
                });
            }

            if (String(nota.status).toLowerCase() === 'cancelado') {
                return res.status(400).json({
                    success: false,
                    message: 'Esta NFS-e já está cancelada.'
                });
            }

            const resultado = await FocusNFSeService.cancelar(
                nota.empresa_id,
                nota.referencia_externa,
                justificativa
            );

            if (!resultado.success) {
                return res.status(statusErro(resultado.error)).json({
                    success: false,
                    message: resultado.error?.message || 'Erro ao cancelar NFS-e.',
                    errors: resultado.error?.errors || [],
                    details: resultado.error?.details
                });
            }

            return res.json({
                success: true,
                data: resultado.registro,
                focus: resultado.data
            });
        } catch (error) {
            console.error('Erro ao cancelar NFS-e:', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Erro ao cancelar NFS-e.'
            });
        }
    }

    async listar(req, res) {
        try {
            const { empresaId } = req.query;

            if (!empresaId) {
                return res.status(400).json({
                    success: false,
                    message: 'O parâmetro empresaId é obrigatório.'
                });
            }

            const notas = await NotaFiscalServicoEmitida.findAll({
                where: {
                    empresa_id: Number(empresaId),
                    tipo: 'NFSE'
                },
                order: [['created_at', 'DESC']]
            });

            return res.json({
                success: true,
                data: notas
            });
        } catch (error) {
            console.error('Erro ao listar NFS-e:', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Erro ao listar NFS-e.'
            });
        }
    }

    async buscarPorId(req, res) {
        try {
            const nota = await buscarNota(req.params.id, req);

            if (!nota) {
                return res.status(404).json({
                    success: false,
                    message: 'NFS-e não encontrada.'
                });
            }

            return res.json({
                success: true,
                data: nota
            });
        } catch (error) {
            console.error('Erro ao buscar NFS-e:', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Erro ao buscar NFS-e.'
            });
        }
    }

    async reenviarEmail(req, res) {
        try {
            const nota = await buscarNota(req.params.id, req);

            if (!nota) {
                return res.status(404).json({
                    success: false,
                    message: 'NFS-e não encontrada.'
                });
            }

            const emails = Array.isArray(req.body.emails)
                ? req.body.emails.filter(email => typeof email === 'string' && email.trim())
                : nota.destinatario_email
                    ? [nota.destinatario_email]
                    : [];

            if (!emails.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Nenhum e-mail informado.'
                });
            }

            const resultado = await FocusNFSeService.reenviarEmail(
                nota.empresa_id,
                nota.referencia_externa,
                emails
            );

            if (!resultado.success) {
                return res.status(statusErro(resultado.error)).json({
                    success: false,
                    message: resultado.error?.message || 'Erro ao reenviar NFS-e por e-mail.',
                    errors: resultado.error?.errors || [],
                    details: resultado.error?.details
                });
            }

            return res.json({
                success: true,
                data: resultado.registro,
                focus: resultado.data
            });
        } catch (error) {
            console.error('Erro ao reenviar NFS-e por e-mail:', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Erro ao reenviar NFS-e por e-mail.'
            });
        }
    }
}

export default new NFSeController();
