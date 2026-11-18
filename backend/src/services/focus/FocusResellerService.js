// src/services/FocusResellerService.js

import { focusResellerClient, createFocusClient } from '../../config/focus.js';
import EmpresaFocusIntegracao from '../../models/EmpresaFocusIntegracao.js';
import ConfiguracaoFiscal from '../../models/ConfiguracaoFiscal.js';
import FocusMunicipioService from './FocusMunicipioService.js';

class FocusResellerService {

  async salvarConfiguracaoFiscal(empresaId, payload) {
    const codigoMunicipio =
      await FocusMunicipioService.buscarCodigoMunicipio(
        payload.municipio,
        payload.uf
      );

    return ConfiguracaoFiscal.upsert({
      empresa_id: empresaId,

      cnpj: payload.cnpj,
      razao_social: payload.nome,
      nome_fantasia: payload.nome_fantasia,

      email: payload.email,
      telefone: payload.telefone,

      inscricao_estadual: payload.inscricao_estadual,
      inscricao_municipal: payload.inscricao_municipal,

      regime_tributario: payload.regime_tributario,

      logradouro: payload.logradouro,
      numero: payload.numero,
      complemento: payload.complemento,
      bairro: payload.bairro,

      municipio: payload.municipio,
      codigo_municipio: codigoMunicipio,
      uf: payload.uf,
      cep: payload.cep,
    });
  }

  async verificarConfiguracao(
    empresaId
  ) {
    const configuracaoFiscal = await ConfiguracaoFiscal.findOne({
      where: {
        empresa_id: empresaId
      }
    });

    const configuracao =
      await EmpresaFocusIntegracao.findOne({
        where: {
          empresa_id: empresaId,
          ativo: true
        }
      });

    if (!configuracao) {
      return {
        configurada: false,
        tipo: null,
        configuracao: null,
        configuracaoFiscal
      };
    }

    return {
      configurada: true,
      tipo:
        configuracao.tipo_integracao,
      configuracao,
      configuracaoFiscal: configuracaoFiscal
    };
  }

  async getEmpresaClient(
    empresaId
  ) {
    const integracao =
      await EmpresaFocusIntegracao.findOne({
        where: {
          empresa_id: empresaId,
          ativo: true
        }
      });

    if (!integracao) {
      throw new Error(
        'Integração Focus não encontrada.'
      );
    }

    const token =
      integracao.ambiente ===
      'homologacao'
        ? integracao.focusnfe_token_homologacao
        : integracao.focusnfe_token;

    if (!token) {
      throw new Error(
        'Token Focus não configurado.'
      );
    }

    if (!integracao.cnpj_emitente) {
      throw new Error(
        'CNPJ do emitente não configurado.'
      );
    }

    return {
      cnpj:
        integracao.cnpj_emitente,
      client:
        createFocusClient({
          token,
          ambiente:
            integracao.ambiente
        }),
      ambiente:
        integracao.ambiente,
      configuracao:
        integracao
    };
  }

  async listarEmpresas(params = {}) {
    const { data } =
      await focusResellerClient.get(
        '/v2/empresas',
        { params }
      );

    return data;
  }

  async detalharEmpresa(focusEmpresaId) {
    const { data } =
      await focusResellerClient.get(
        `/v2/empresas/${focusEmpresaId}`
      );

    return data;
  }

  async associarEmpresa(
    empresaId,
    payload
  ) {
    const existente =
      await EmpresaFocusIntegracao.findOne({
        where: {
          empresa_id: empresaId,
          ativo: true
        }
      });

    if (existente) {
      throw new Error(
        'Empresa já possui integração configurada.'
      );
    }

    if (
      !payload.token_producao &&
      !payload.token_homologacao
    ) {
      throw new Error(
        'Informe ao menos um token.'
      );
    }

    const configuracao =
      await EmpresaFocusIntegracao.create({
        empresa_id: empresaId,

        cnpj_emitente: payload.cnpj,

        tipo_integracao:
          'ASSOCIADA',

        focus_empresa_id: null,

        focusnfe_token:
          payload.token_producao ??
          null,

        focusnfe_token_homologacao:
          payload.token_homologacao ??
          null,

        ambiente:
          payload.ambiente ??
          'producao',

        status: 'ACTIVE',

        dados_emitente: {},

        ultima_sincronizacao:
          new Date(),

        ativo: true
      });

    await this.salvarConfiguracaoFiscal( empresaId, payload );

    return configuracao;
  }

  async criarEmpresa(empresaId, payload) {
    const { data } =
      await focusResellerClient.post(
        '/v2/empresas',
        payload
      );

    const [configuracao] =
      await EmpresaFocusIntegracao.upsert({
        empresa_id: empresaId,

        cnpj_emitente: data.cnpj,

        tipo_integracao: 'PROVISIONADA',

        focus_empresa_id: data.id,

        focusnfe_token:
          data.token_producao ?? null,

        focusnfe_token_homologacao:
          data.token_homologacao ?? null,

        ambiente:
          payload.ambiente ?? 'producao',

        status: 'ACTIVE',

        dados_emitente: data,

        ultima_sincronizacao: new Date(),

        ativo: true
      });

    await this.salvarConfiguracaoFiscal(
      empresaId,
      payload
    );

    return configuracao;
  }

  async validarCriacao(payload) {
  try {
    console.log('PAYLOAD:');
    console.log(
      JSON.stringify(
        payload,
        null,
        2
      )
    );

    const { data } =
      await focusResellerClient.post(
        '/v2/empresas?dry_run=1',
        payload
      );

    console.log(
      'RESPOSTA:',
      data
    );

    return data;
  } catch (err) {
    console.error(
      'STATUS:',
      err.response?.status
    );

    console.error(
      'FOCUS RESPONSE:'
    );

    console.error(
      JSON.stringify(
        err.response?.data,
        null,
        2
      )
    );

    throw err;
  }
}

  async editarEmpresa(
    empresaId,
    payload
  ) {
    const integracao =
      await EmpresaFocusIntegracao.findOne({
        where: {
          empresa_id: empresaId,
          ativo: true
        }
      });

    if (!integracao) {
      throw new Error(
        'Integração Focus não encontrada.'
      );
    }

    let dadosEmitente =
      integracao.dados_emitente;

    if (
      integracao.tipo_integracao ===
        'PROVISIONADA' &&
      integracao.focus_empresa_id
    ) {
      const response =
        await focusResellerClient.put(
          `/v2/empresas/${integracao.focus_empresa_id}`,
          payloadParaFocus(payload)
        );

      dadosEmitente =
        response.data;
    }

    await integracao.update({
      focusnfe_token:
        payload.token_producao ??
        integracao.focusnfe_token,

      focusnfe_token_homologacao:
        payload.token_homologacao ??
        integracao.focusnfe_token_homologacao,

      ambiente:
        payload.ambiente ??
        integracao.ambiente,

      dados_emitente: {
        ...integracao.dados_emitente,
        ...payload,
        ...dadosEmitente
      },

      ultima_sincronizacao:
        new Date()
    });

    await this.salvarConfiguracaoFiscal(
      empresaId,
      payload
    );

    return integracao.reload();
  }

  async deletarEmpresa(
    empresaId
  ) {
    const integracao =
      await EmpresaFocusIntegracao.findOne({
        where: {
          empresa_id: empresaId,
          ativo: true
        }
      });

    if (!integracao) {
      throw new Error(
        'Integração Focus não encontrada.'
      );
    }

    if (
      integracao.focus_empresa_id
    ) {
      await focusResellerClient.delete(
        `/v2/empresas/${integracao.focus_empresa_id}`
      );
    }

    await integracao.update({
      ativo: false,
      status: 'PENDING',
      ultima_sincronizacao:
        new Date()
    });

    return {
      success: true
    };
  }
}

export default new FocusResellerService();
