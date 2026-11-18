// src/services/focus/FocusNFSeService.js

import FocusResellerService from './FocusResellerService.js';
import NotaFiscalServicoEmitida from '../../models/NotaFiscalServicoEmitida.js';

class FocusNFSeService {
    gerarReferencia(origemId) {
        return `NFSE_${origemId || 'AVULSA'}_${Date.now()}`;
    }

    async criarRegistro({ empresaId, clienteId, servicoId, vendaId, referencia, payload, ambiente }) {
        const prestador = payload.prestador || {};
        const tomador = payload.tomador || {};
        const servico = payload.servico || {};

        return NotaFiscalServicoEmitida.create({
            empresa_id: empresaId,
            cliente_id: clienteId,
            servico_id: servicoId,
            venda_id: vendaId || null,
            tipo: 'NFSE',
            referencia_externa: referencia,
            provedor: 'FOCUS',
            ambiente,
            status: 'PROCESSANDO',

            emitente_nome: prestador.razao_social || prestador.nome || null,
            emitente_cnpj: prestador.cnpj || null,

            destinatario_nome: tomador.razao_social || null,
            destinatario_documento: tomador.cnpj || tomador.cpf || null,
            destinatario_email: tomador.email || null,
            destinatario_telefone: tomador.telefone || null,
            destinatario_endereco: tomador.endereco || null,

            servico_nome: servico.nome || null,
            servico_descricao: servico.discriminacao || null,
            item_lista_servico: servico.item_lista_servico || null,
            codigo_tributacao_municipio: servico.codigo_tributacao_municipio || null,
            codigo_cnae: servico.codigo_cnae || null,

            valor_total: servico.valor_servicos || 0,
            base_calculo: servico.base_calculo || 0,
            deducoes: servico.deducoes || 0,
            valor_liquido: servico.valor_liquido || 0,
            iss: servico.valor_iss || 0,
            iss_retido: servico.iss_retido || false,

            natureza_operacao: payload.natureza_operacao || null,
            regime_especial_tributacao: payload.regime_especial_tributacao || null,
            optante_simples_nacional: payload.optante_simples_nacional || false,
            incentivador_cultural: payload.incentivador_cultural || false,

            data_emissao: payload.data_emissao || new Date(),
            payload_enviado: payload
        });
    }

    async atualizarRegistro(registro, dados) {
        await registro.update(dados);
        return registro;
    }

    tratarErroFocus(error) {
        return {
            success: false,
            error: {
                message:
                    error.response?.data?.mensagem ||
                    error.response?.data?.message ||
                    error.message,
                code:
                    error.response?.data?.codigo ||
                    error.response?.data?.status ||
                    error.response?.status,
                errors: error.response?.data?.erros || [],
                details: error.response?.data
            }
        };
    }

    async emitir(empresaId, clienteId, servicoId, payload, { vendaId = null } = {}) {
        let registro = null;

        try {
            const { client, ambiente } = await FocusResellerService.getEmpresaClient(empresaId);
            const referencia = this.gerarReferencia(vendaId || servicoId);

            registro = await this.criarRegistro({
                empresaId,
                clienteId,
                servicoId,
                vendaId,
                referencia,
                payload,
                ambiente
            });

            const { data } = await client.post(`/v2/nfse?ref=${referencia}`, payload);

            await this.atualizarRegistro(registro, {
                status: data.status || 'processando_autorizacao',
                numero: data.numero || data.nfse_number || null,
                serie: data.serie || null,
                codigo_verificacao: data.codigo_verificacao || null,
                rps_numero: data.numero_rps || data.rps_numero || null,
                xml_url: data.caminho_xml_nota_fiscal || null,
                pdf_url: data.caminho_danfse || null,
                mensagem_retorno: data.mensagem || data.mensagem_sefaz || null,
                codigo_retorno: data.codigo || data.codigo_status || data.status_sefaz || null,
                data_autorizacao: data.status === 'autorizado' ? new Date() : null,
                resposta_provedor: data
            });

            return {
                success: true,
                data,
                registro
            };
        } catch (error) {
            if (registro) {
                await registro.update({
                    status: 'ERRO',
                    mensagem_retorno:
                        error.response?.data?.mensagem ||
                        error.response?.data?.message ||
                        error.message,
                    codigo_retorno:
                        error.response?.data?.codigo ||
                        error.response?.status,
                    resposta_provedor: error.response?.data || { message: error.message }
                }).catch(() => {});
            }

            return this.tratarErroFocus(error);
        }
    }

    async consultar(empresaId, referencia) {
        try {
            const { client } = await FocusResellerService.getEmpresaClient(empresaId);
            const { data } = await client.get(`/v2/nfse/${referencia}`);

            const registro = await NotaFiscalServicoEmitida.findOne({
                where: {
                    empresa_id: empresaId,
                    referencia_externa: referencia,
                    tipo: 'NFSE'
                }
            });

            if (!registro) {
                return {
                    success: false,
                    error: {
                        message: 'Registro da NFS-e não encontrado.'
                    }
                };
            }

            await this.atualizarRegistro(registro, {
                ultima_consulta: new Date(),
                status: data.status || registro.status,
                numero: data.numero || data.nfse_number || registro.numero,
                serie: data.serie || registro.serie,
                codigo_verificacao: data.codigo_verificacao || registro.codigo_verificacao,
                rps_numero: data.numero_rps || data.rps_numero || registro.rps_numero,
                xml_url: data.caminho_xml_nota_fiscal || registro.xml_url,
                pdf_url: data.caminho_danfse || registro.pdf_url,
                mensagem_retorno:
                    data.mensagem ||
                    data.mensagem_sefaz ||
                    registro.mensagem_retorno,
                codigo_retorno:
                    data.codigo ||
                    data.codigo_status ||
                    data.status_sefaz ||
                    registro.codigo_retorno,
                data_autorizacao:
                    data.status === 'autorizado'
                        ? registro.data_autorizacao || new Date()
                        : registro.data_autorizacao,
                resposta_provedor: data
            });

            return {
                success: true,
                data,
                registro
            };
        } catch (error) {
            return this.tratarErroFocus(error);
        }
    }

    async cancelar(empresaId, referencia, justificativa) {
        try {
            if (!justificativa?.trim()) {
                return {
                    success: false,
                    error: {
                        message: 'Apresente uma justificativa.'
                    }
                };
            }

            const { client } = await FocusResellerService.getEmpresaClient(empresaId);

            const { data } = await client.delete(`/v2/nfse/${referencia}`, {
                data: {
                    justificativa: justificativa.trim()
                }
            });

            const registro = await NotaFiscalServicoEmitida.findOne({
                where: {
                    empresa_id: empresaId,
                    referencia_externa: referencia,
                    tipo: 'NFSE'
                }
            });

            if (registro) {
                await this.atualizarRegistro(registro, {
                    status: data.status || 'cancelado',
                    motivo_cancelamento: justificativa.trim(),
                    data_cancelamento: new Date(),
                    mensagem_retorno: data.mensagem || data.mensagem_sefaz || null,
                    codigo_retorno:
                        data.codigo ||
                        data.codigo_status ||
                        data.status_sefaz ||
                        null,
                    resposta_provedor: data
                });
            }

            return {
                success: true,
                data,
                registro
            };
        } catch (error) {
            return this.tratarErroFocus(error);
        }
    }

    async reenviarEmail(empresaId, referencia, emails) {
        try {
            const emailsValidos = Array.isArray(emails)
                ? emails.filter(email => typeof email === 'string' && email.trim())
                : [];

            if (!emailsValidos.length) {
                return {
                    success: false,
                    error: {
                        message: 'Informe ao menos um e-mail.'
                    }
                };
            }

            const { client } = await FocusResellerService.getEmpresaClient(empresaId);
            const ref = encodeURIComponent(referencia);

            const { data } = await client.post(`/v2/nfse/${ref}/email`, {
                emails: emailsValidos
            });

            const registro = await NotaFiscalServicoEmitida.findOne({
                where: {
                    empresa_id: empresaId,
                    referencia_externa: referencia,
                    tipo: 'NFSE'
                }
            });

            if (registro) {
                await this.atualizarRegistro(registro, {
                    email_enviado_em: new Date(),
                    resposta_provedor: data
                });
            }

            return {
                success: true,
                data,
                registro
            };
        } catch (error) {
            return this.tratarErroFocus(error);
        }
    }

    async baixarArquivo(empresaId, caminhoArquivo, responseType = 'text') {
        const { client } = await FocusResellerService.getEmpresaClient(empresaId);
        const { data } = await client.get(caminhoArquivo, { responseType });
        return data;
    }
}

export default new FocusNFSeService();
