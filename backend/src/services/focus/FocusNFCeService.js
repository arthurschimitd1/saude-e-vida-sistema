// src/services/focus/FocusNFCeService.js

import FocusResellerService from './FocusResellerService.js';
import { Op } from 'sequelize';
import NotaFiscalEmitida from '../../models/NotaFiscalEmitida.js';
import {
  notaPodeSerReemitida,
  notaTemEmissaoAtiva,
  prepararPayloadParaReemissao,
  carregarClienteDaNota
} from './fiscalRetry.js';

class FocusNFCeService {
  gerarReferencia(vendaId) {
    return `NFCE_${vendaId}_${Date.now()}`;
  }

  async criarRegistro({
    empresaId,
    vendaId,
    referencia,
    payload,
    ambiente
    }) {
    return await NotaFiscalEmitida.create({
        empresa_id: empresaId,
        venda_id: vendaId,
        tipo: 'NFCE',
        referencia_externa: referencia,
        provedor: 'FOCUS',
        ambiente,
        status: 'PROCESSANDO',
        valor_total: payload.valor_total,
        emitente_nome: payload.emitente_nome,
        emitente_cnpj: payload.cnpj_emitente,
        destinatario_nome: payload.nome_destinatario || null,
        destinatario_documento:
        payload.cpf_destinatario ||
        payload.cnpj_destinatario ||
        null,
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
        message: error.response?.data?.mensagem || error.message,
        code: error.response?.data?.codigo || error.response?.status,
        errors: error.response?.data?.erros || [],
        details: error.response?.data
      }
    };
  }

  async emitir(empresaId, vendaId, payload) {
    let registro = null;

    try {
      const { client, ambiente } = await FocusResellerService.getEmpresaClient(empresaId);

      const referencia = this.gerarReferencia(vendaId);

      registro = await this.criarRegistro({
        empresaId,
        vendaId,
        referencia,
        payload,
        ambiente
      });

      const { data } = await client.post(`/v2/nfce?ref=${referencia}`, payload);

      await this.atualizarRegistro(registro, {
        status: data.status,
        numero: data.numero || null,
        serie: data.serie || null,
        chave_acesso: data.chave_nfe || null,
        valor_total: payload.valor_total,
        mensagem_retorno: data.mensagem_sefaz || data.mensagem || null,
        codigo_retorno: data.status_sefaz || data.codigo_status || null,
        xml_url: data.caminho_xml_nota_fiscal || null,
        pdf_url: data.caminho_danfe || null,
        data_autorizacao:
            data.status === 'autorizado'
            ? new Date()
            : null,
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
          mensagem_retorno: error.response?.data?.mensagem || error.message,
          codigo_retorno: error.response?.data?.codigo || error.response?.status,
          resposta_provedor: error.response?.data || { message: error.message }
        });
      }

      return this.tratarErroFocus(error);
    }
  }

  async refazer(nota, ajustes = {}) {
    if (!notaPodeSerReemitida(nota.status)) {
      return {
        success: false,
        error: {
          message: 'Somente notas rejeitadas ou com erro podem ser refeitas'
        }
      };
    }

    let registro = null;

    try {
      const tentativasAnteriores = nota.venda_id
        ? await NotaFiscalEmitida.findAll({
            where: {
              empresa_id: nota.empresa_id,
              venda_id: nota.venda_id,
              tipo: 'NFCE',
              // A própria tentativa com erro nunca pode bloquear o seu
              // refazimento. Filtrar no banco também evita comparação de IDs
              // com tipos diferentes (string/número) em respostas antigas.
              id: { [Op.ne]: nota.id }
            },
            attributes: ['id', 'status']
          })
        : [];

      const existeTentativaAtiva = tentativasAnteriores.some(tentativa =>
        notaTemEmissaoAtiva(tentativa.status)
      );

      if (existeTentativaAtiva) {
        return {
          success: false,
          error: {
            message: 'Esta venda já possui uma emissão fiscal autorizada ou em processamento'
          }
        };
      }

      const cliente = ajustes?.destinatario?.usar_dados_cliente
        ? await carregarClienteDaNota(nota)
        : null;

      if (ajustes?.destinatario?.usar_dados_cliente && !cliente) {
        throw new Error('A venda não possui um cliente cadastrado com dados para o destinatário');
      }

      const payload = prepararPayloadParaReemissao(
        nota.payload_enviado,
        ajustes,
        { cliente }
      );
      const { client, ambiente } = await FocusResellerService.getEmpresaClient(nota.empresa_id);
      const referencia = this.gerarReferencia(nota.venda_id);

      registro = await this.criarRegistro({
        empresaId: nota.empresa_id,
        vendaId: nota.venda_id,
        referencia,
        payload,
        ambiente
      });

      const { data } = await client.post(`/v2/nfce?ref=${referencia}`, payload);

      await this.atualizarRegistro(registro, {
        status: data.status,
        numero: data.numero || null,
        serie: data.serie || null,
        chave_acesso: data.chave_nfe || null,
        valor_total: payload.valor_total,
        mensagem_retorno: data.mensagem_sefaz || data.mensagem || null,
        codigo_retorno: data.status_sefaz || data.codigo_status || null,
        xml_url: data.caminho_xml_nota_fiscal || null,
        pdf_url: data.caminho_danfe || null,
        data_autorizacao: data.status === 'autorizado' ? new Date() : null,
        resposta_provedor: data
      });

      return { success: true, data, registro, origem_id: nota.id };
    } catch (error) {
      if (registro) {
        await registro.update({
          status: 'ERRO',
          mensagem_retorno: error.response?.data?.mensagem || error.message,
          codigo_retorno: error.response?.data?.codigo || error.response?.status,
          resposta_provedor: error.response?.data || { message: error.message }
        });
      }

      return this.tratarErroFocus(error);
    }
  }

    async consultar(empresaId, referencia) {
    try {
      const { client } = await FocusResellerService.getEmpresaClient(empresaId);

      const { data } = await client.get(`/v2/nfce/${referencia}`);

      const registro = await NotaFiscalEmitida.findOne({
        where: {
          empresa_id: empresaId,
          referencia_externa: referencia,
          tipo: 'NFCE'
        }
      });

      if (registro) {
        const atualizacao = {
            ultima_consulta: new Date()
        };

        if (registro.status !== data.status) {
            atualizacao.status = data.status;
        }

        if (data.numero && registro.numero !== data.numero) {
            atualizacao.numero = data.numero;
        }

        if (data.serie && registro.serie !== data.serie) {
            atualizacao.serie = data.serie;
        }

        if (data.chave_nfe && registro.chave_acesso !== data.chave_nfe) {
            atualizacao.chave_acesso = data.chave_nfe;
        }

        const mensagem =
            data.mensagem_sefaz || data.mensagem;

        if (mensagem && registro.mensagem_retorno !== mensagem) {
            atualizacao.mensagem_retorno = mensagem;
        }

        const codigo =
            data.status_sefaz || data.codigo_status;

        if (codigo && registro.codigo_retorno !== codigo) {
            atualizacao.codigo_retorno = codigo;
        }

        if (
            data.caminho_xml_nota_fiscal &&
            registro.xml_url !== data.caminho_xml_nota_fiscal
        ) {
            atualizacao.xml_url = data.caminho_xml_nota_fiscal;
        }

        if (
            data.caminho_danfe &&
            registro.pdf_url !== data.caminho_danfe
        ) {
            atualizacao.pdf_url = data.caminho_danfe;
        }

        if (
            data.status === 'autorizado' &&
            !registro.data_autorizacao
        ) {
            atualizacao.data_autorizacao = new Date();
        }

        atualizacao.resposta_provedor = data;

        if (Object.keys(atualizacao).length > 2) {
            await this.atualizarRegistro(registro, atualizacao);
        } else {
            await registro.update({
            ultima_consulta: atualizacao.ultima_consulta
            });
        }
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return this.tratarErroFocus(error);
    }
  }

  async baixarArquivo(empresaId, caminhoArquivo, responseType = 'text') {
    const { client } = await FocusResellerService.getEmpresaClient(empresaId);

    const { data } = await client.get(caminhoArquivo, {
      responseType
    });

    return data;
  }

  async cancelar(empresaId, referencia, justificativa) {
    try {
      if (!justificativa || justificativa.trim().length < 15) {
        return {
          success: false,
          error: {
            message: 'A justificativa deve possuir no mínimo 15 caracteres.'
          }
        };
      }

      const { client } = await FocusResellerService.getEmpresaClient(empresaId);

      const { data } = await client.delete(`/v2/nfce/${referencia}`, {
        data: {
          justificativa
        }
      });

      const registro = await NotaFiscalEmitida.findOne({
        where: {
          empresa_id: empresaId,
          referencia_externa: referencia,
          tipo: 'NFCE'
        }
      });

      if (registro) {
        await this.atualizarRegistro(registro, {
          status: data.status || 'cancelado',
          mensagem_retorno: data.mensagem_sefaz || data.mensagem || null,
          codigo_retorno: data.status_sefaz || null,
          protocolo_cancelamento: data.protocolo_cancelamento || null,
          motivo_cancelamento: justificativa,
          data_cancelamento: new Date(),
          resposta_provedor: data
        });
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return this.tratarErroFocus(error);
    }
  }
}

export default new FocusNFCeService();
