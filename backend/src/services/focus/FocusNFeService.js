// src/services/focus/FocusNFeService.js

import FocusResellerService from './FocusResellerService.js';
import { Op } from 'sequelize';
import NotaFiscalEmitida from '../../models/NotaFiscalEmitida.js';
import {
  notaPodeSerReemitida,
  notaTemEmissaoAtiva,
  prepararPayloadParaReemissao,
  carregarClienteDaNota
} from './fiscalRetry.js';

class FocusNFeService {
  gerarReferencia(vendaId) {
    return `NFE_${vendaId}_${Date.now()}`;
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
        tipo: 'NFE',
        referencia_externa: referencia,
        provedor: 'FOCUS',
        ambiente,
        status: 'PROCESSANDO',
        valor_total: payload.valor_total,
        emitente_nome: payload.emitente?.nome || payload.emitente_nome,
        emitente_cnpj: payload.emitente?.cnpj || payload.cnpj_emitente,
        destinatario_nome:
        payload.destinatario?.nome || payload.nome_destinatario,
        destinatario_documento:
        payload.destinatario?.cpf ||
        payload.destinatario?.cnpj ||
        payload.cpf_destinatario ||
        payload.cnpj_destinatario,
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

      const { data } = await client.post(`/v2/nfe?ref=${referencia}`, payload);

      await this.atualizarRegistro(registro, {
        status: data.status,
        numero: data.numero || null,
        serie: data.serie || null,
        chave_acesso: data.chave_nfe || null,
        protocolo_autorizacao: data.protocolo_autorizacao || null,
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
              tipo: 'NFE',
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

      const { data } = await client.post(`/v2/nfe?ref=${referencia}`, payload);

      await this.atualizarRegistro(registro, {
        status: data.status,
        numero: data.numero || null,
        serie: data.serie || null,
        chave_acesso: data.chave_nfe || null,
        protocolo_autorizacao: data.protocolo_autorizacao || null,
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
    console.log('trying');

    const { client } = await FocusResellerService.getEmpresaClient(empresaId);

    const { data } = await client.get(`/v2/nfe/${referencia}`);
    console.log('RETORNO FOCUS:', data);

    const registro = await NotaFiscalEmitida.findOne({
      where: {
        empresa_id: empresaId,
        referencia_externa: referencia,
        tipo: 'NFE'
      }
    });

    console.log('REGISTRO ENCONTRADO:', registro?.id);

    let registroAtualizado = registro;

    if (registro) {
      const atualizacao = {
        ultima_consulta: new Date(),
        status: data.status,
        numero: data.numero || registro.numero,
        serie: data.serie || registro.serie,
        chave_acesso: data.chave_nfe || registro.chave_acesso,
        protocolo_autorizacao:
          data.protocolo_autorizacao ||
          data.protocolo ||
          registro.protocolo_autorizacao,
        mensagem_retorno:
          data.mensagem_sefaz ||
          data.mensagem ||
          registro.mensagem_retorno,
        codigo_retorno:
          data.status_sefaz ||
          data.codigo_status ||
          registro.codigo_retorno,
        xml_url:
          data.caminho_xml_nota_fiscal ||
          registro.xml_url,
        pdf_url:
          data.caminho_danfe ||
          registro.pdf_url,
        data_autorizacao:
          data.status === 'autorizado'
            ? new Date()
            : registro.data_autorizacao,
        resposta_provedor: data
      };

      console.log('ATUALIZAÇÃO QUE SERÁ SALVA:', atualizacao);

      const [linhasAtualizadas] = await NotaFiscalEmitida.update(atualizacao, {
        where: {
          id: registro.id
        }
      });

      console.log('Linhas atualizadas:', linhasAtualizadas);

      registroAtualizado = await NotaFiscalEmitida.findByPk(registro.id);

      console.log('Depois do update:', {
        id: registroAtualizado.id,
        status: registroAtualizado.status,
        numero: registroAtualizado.numero,
        serie: registroAtualizado.serie,
        chave_acesso: registroAtualizado.chave_acesso,
        xml_url: registroAtualizado.xml_url,
        pdf_url: registroAtualizado.pdf_url,
        ultima_consulta: registroAtualizado.ultima_consulta
      });
    }

    return {
      success: true,
      data: registroAtualizado
    };

  } catch (error) {
    console.error('ERRO AO CONSULTAR NFE:', error);
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
      if (!justificativa) {
        return {
          success: false,
          error: {
            message: 'Apresente uma justificativa.'
          }
        };
      }

      const { client } = await FocusResellerService.getEmpresaClient(empresaId);

      const { data } = await client.delete(`/v2/nfe/${referencia}`, {
        data: {
          justificativa
        }
      });

      const registro = await NotaFiscalEmitida.findOne({
        where: {
          empresa_id: empresaId,
          referencia_externa: referencia,
          tipo: 'NFE'
        }
      });

      if (registro) {
        await this.atualizarRegistro(registro, {
            status: data.status || 'cancelado',
            mensagem_retorno: data.mensagem_sefaz || data.mensagem || null,
            codigo_retorno: data.status_sefaz || data.codigo_status || null,
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

export default new FocusNFeService();
