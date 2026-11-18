// src/services/focusService.js
import axios from 'axios';
import FocusConfiguracao from '../models/FocusConfiguracao.js';
import NotaFiscalFocus from '../models/NotaFiscalFocus.js';
import { getFocusBaseUrl } from '../../config/focus.js';
import { Op } from 'sequelize';

class FocusService {
  async buscarNotasRecebidas(empresaId, configOverride = null) {
    let config = configOverride;
    if (!config) {
      config = await FocusConfiguracao.findOne({ where: { empresa_id: empresaId } });
    }
    if (!config || !config.token) {
      throw new Error('Focus NFe não configurada para esta empresa');
    }

    const baseURL = getFocusBaseUrl(config.ambiente);

    // Obter o CNPJ da empresa a partir da tabela empresas (você precisa implementar ou já ter o campo CNPJ em empresas)
    const empresa = await (await import('../models/Empresa.js')).default.findByPk(empresaId);
    if (!empresa || !empresa.cnpj) throw new Error('CNPJ da empresa não encontrado');

    const url = `${baseURL}/v2/nfes_recebidas?cnpj=${empresa.cnpj}`;
    const response = await axios.get(url, {
      auth: { username: config.token, password: '' }
    });

    const notas = response.data; // array de objetos resumidos
    let novas = 0;

    for (const nota of notas) {
      const existe = await NotaFiscalFocus.findOne({
        where: { chave_acesso: nota.chave }
      });
      if (existe) continue;

      // Se não manifestada, manifestar automaticamente (opcional)
      if (!nota.manifestada) {
        await this.manifestarNota(config, nota.chave);
      }

      // Obter detalhes completos
      const detalhes = await this.obterDetalhesNota(config, nota.chave);
      const xmlContent = detalhes.xml || null; // Pode ou não ter XML no retorno; a Focus pode exigir outro endpoint para XML

      await NotaFiscalFocus.create({
        empresa_id: empresaId,
        chave_acesso: nota.chave,
        numero: detalhes.numero,
        serie: detalhes.serie,
        data_emissao: detalhes.data_emissao,
        valor_total: detalhes.valor_total,
        emitente_cnpj: detalhes.emitente?.cnpj,
        emitente_nome: detalhes.emitente?.nome,
        xml_content: xmlContent,
        manifestada: true,
        data_manifestacao: new Date(),
        status_focus: 'recebida'
      });
      novas++;
    }

    // Atualizar última consulta
    await config.update({ ultima_consulta: new Date() });
    return { novas, total: notas.length };
  }

  async manifestarNota(config, chave) {
    const baseURL = config.ambiente === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';
    const url = `${baseURL}/v2/nfes_recebidas/${chave}/manifesto`;
    // Corpo: { tipo: "ciencia" } – veja a documentação para outros tipos
    await axios.post(url, { tipo: 'ciencia' }, {
      auth: { username: config.token, password: '' }
    });
  }

  async obterDetalhesNota(config, chave) {
    const baseURL = config.ambiente === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';
    const url = `${baseURL}/v2/nfes_recebidas/${chave}`;
    const response = await axios.get(url, {
      auth: { username: config.token, password: '' }
    });
    return response.data;
  }

  // Método para executar busca para todas as empresas com Focus configurado
  async buscarParaTodasEmpresas() {
    const configs = await FocusConfiguracao.findAll();
    const results = [];
    for (const cfg of configs) {
      try {
        const result = await this.buscarNotasRecebidas(cfg.empresa_id, cfg);
        results.push({ empresa_id: cfg.empresa_id, ...result });
      } catch (err) {
        console.error(`Erro ao buscar notas para empresa ${cfg.empresa_id}:`, err.message);
        results.push({ empresa_id: cfg.empresa_id, erro: err.message });
      }
    }
    return results;
  }
}

export default new FocusService();
