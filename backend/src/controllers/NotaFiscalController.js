import NotaFiscalService from '../services/NotaFiscalService.js';
import NotaFiscal from '../models/NotaFiscal.js';
import Venda from '../models/Venda.js';
import Cliente from '../models/Cliente.js';
import EmpresaConfigFiscal from '../models/EmpresaConfigFiscal.js';
import AutomacaoEngine from '../services/AutomacaoEngine.js';
import { aplicarEmpresaScope } from '../utils/empresaScope.js';
import axios from 'axios';
import { Op } from 'sequelize';

export const getAllNotas = async (req, res) => {
  try {
    const where = {};
    aplicarEmpresaScope(where, req.user);

    const notas = await NotaFiscal.findAll({
      where,
      include: [
        {
          model: Venda,
          as: 'venda',
          required: false,
          include: [
            { model: Cliente, as: 'cliente', required: false }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(notas);
  } catch (error) {
    console.error('Erro ao listar notas:', error);
    res.status(500).json({ error: error.message });
  }
};

export const importarNotasFocus = async (req, res) => {
  try {
    const { dataInicio, dataFim, tipo } = req.query;

    const config = await EmpresaConfigFiscal.findOne({
      where: { empresa_id: req.user.empresa_id }
    });

    if (!config) {
      return res.status(400).json({ error: 'Empresa não possui configuração fiscal. Cadastre o token e CNPJ.' });
    }

    const baseUrl = config.ambiente === 'producao'
      ? 'https://api.focusnfe.com.br/v2'
      : 'https://homologacao.focusnfe.com.br/v2';

    const endpoint = tipo === 'nfce' ? '/nfce' : '/nfe';

    const params = {};
    if (dataInicio) params.data_inicio = dataInicio;
    if (dataFim) params.data_fim = dataFim;

    console.log(`Buscando notas ${tipo || 'NF-e/NFC-e'} da Focus...`);

    const response = await axios.get(`${baseUrl}${endpoint}`, {
      auth: { username: config.focusnfe_token, password: '' },
      params
    });

    const notasFocus = Array.isArray(response.data) ? response.data : [response.data];
    let importadas = 0;
    let ignoradas = 0;
    let erros = 0;

    for (const notaFocus of notasFocus) {
      try {
        const notaExistente = await NotaFiscal.findOne({
          where: {
            [Op.or]: [
              { chave_acesso: notaFocus.chave_nfe },
              { referencia: notaFocus.ref }
            ]
          }
        });

        if (notaExistente) {
          ignoradas++;
          continue;
        }

        let vendaId = null;
        if (notaFocus.ref && notaFocus.ref.startsWith('venda_')) {
          const vendaIdMatch = notaFocus.ref.match(/venda_(\d+)_/);
          if (vendaIdMatch) {
            vendaId = parseInt(vendaIdMatch[1]);
          }
        }

        await NotaFiscal.create({
          empresa_id: req.user.empresa_id,
          venda_id: vendaId,
          referencia: notaFocus.ref,
          tipo: tipo === 'nfce' ? 'nfce' : 'nfe',
          status: notaFocus.status === 'autorizado' ? 'autorizada' :
            (notaFocus.status === 'cancelado' ? 'cancelada' :
              (notaFocus.status === 'rejeitada' ? 'rejeitada' : 'processando')),
          chave_acesso: notaFocus.chave_nfe,
          numero: notaFocus.numero,
          serie: notaFocus.serie,
          caminho_xml: notaFocus.caminho_xml_nota_fiscal,
          caminho_danfe: notaFocus.caminho_danfe,
          qrcode_url: notaFocus.qrcode_url,
          protocolo_sefaz: notaFocus.protocolo_sefaz,
          mensagem_sefaz: notaFocus.mensagem_sefaz,
          data_emissao: notaFocus.data_emissao || new Date(),
          payload_enviado: null,
          resposta_api: notaFocus
        });

        AutomacaoEngine.dispararEvento('nota_fiscal_recebida', req.user.empresa_id, { referencia: notaFocus.ref, tipo });
        importadas++;
      } catch (err) {
        console.error(`Erro ao importar nota ${notaFocus.ref}:`, err.message);
        erros++;
      }
    }

    res.json({
      message: 'Importação concluída',
      total_encontradas: notasFocus.length,
      importadas,
      ignoradas,
      erros
    });

  } catch (error) {
    console.error('Erro na importação:', error);
    if (error.response) {
      return res.status(400).json({
        error: `Erro na API Focus: ${error.response.data.mensagem || error.response.statusText}`
      });
    }
    res.status(500).json({ error: error.message });
  }
};

export const emitirNFCe = async (req, res) => {
  try {
    const { venda_id } = req.body;
    if (!venda_id) return res.status(400).json({ error: 'venda_id é obrigatório' });
    const nota = await NotaFiscalService.emitirNFCe(venda_id, req.user);
    AutomacaoEngine.dispararEvento('nota_fiscal_emitida', req.user.empresa_id, { nota, tipo: 'nfce' });
    if (nota?.status && nota.status !== 'autorizado') {
      AutomacaoEngine.dispararEvento('inconsistencia_fiscal', req.user.empresa_id, {
        tipo: 'rejeicao_sefaz', referencia: nota.ref,
        mensagem: nota.mensagem_sefaz || 'NFC-e rejeitada pela SEFAZ'
      });
    }
    res.status(201).json(nota);
  } catch (error) {
    console.error('Erro detalhado na emissão NFC-e:', error);
    AutomacaoEngine.dispararEvento('inconsistencia_fiscal', req.user?.empresa_id, {
      tipo: 'erro_comunicacao', mensagem: error.message
    });
    if (error.response) {
      console.error('Resposta da Focus:', error.response.data);
      return res.status(400).json({ error: error.response.data.mensagem || error.response.data });
    }
    res.status(400).json({ error: error.message });
  }
};

export const emitirNFe = async (req, res) => {
  try {
    const { venda_id } = req.body;
    if (!venda_id) return res.status(400).json({ error: 'venda_id é obrigatório' });
    const nota = await NotaFiscalService.emitirNFe(venda_id, req.user);
    AutomacaoEngine.dispararEvento('nota_fiscal_emitida', req.user.empresa_id, { nota, tipo: 'nfe' });

    // TESTE TEMPORÁRIO — remover após validar
    AutomacaoEngine.dispararEvento('inconsistencia_fiscal', req.user.empresa_id, {
      tipo: 'rejeicao_sefaz',
      referencia: 'TESTE-001',
      mensagem: 'Simulação de rejeição SEFAZ para teste'
    });

    if (nota?.status && nota.status !== 'autorizado') {
      AutomacaoEngine.dispararEvento('inconsistencia_fiscal', req.user.empresa_id, {
        tipo: 'rejeicao_sefaz', referencia: nota.ref,
        mensagem: nota.mensagem_sefaz || 'NF-e rejeitada pela SEFAZ'
      });
    }
    res.status(201).json(nota);
  } catch (error) {
    console.error('Erro detalhado na emissão NF-e:', error);
    AutomacaoEngine.dispararEvento('inconsistencia_fiscal', req.user?.empresa_id, {
      tipo: 'erro_comunicacao', mensagem: error.message
    });
    if (error.response) {
      console.error('Resposta da Focus:', error.response.data);
      return res.status(400).json({ error: error.response.data.mensagem || error.response.data });
    }
    res.status(400).json({ error: error.message });
  }
};

export const consultarNota = async (req, res) => {
  try {
    const { id } = req.params;
    const nota = await NotaFiscalService.consultarStatus(id, req.user);
    res.json(nota);
  } catch (error) {
    console.error('Erro ao consultar nota:', error);
    res.status(400).json({ error: error.message });
  }
};

export const cancelarNota = async (req, res) => {
  try {
    const { id } = req.params;
    const { justificativa } = req.body;
    const nota = await NotaFiscalService.cancelarNota(id, justificativa, req.user);
    res.json(nota);
  } catch (error) {
    console.error('Erro ao cancelar nota:', error);
    res.status(400).json({ error: error.message });
  }
};

export const enviarEmailNota = async (req, res) => {
  try {
    const { id } = req.params;
    const { emails } = req.body;
    const result = await NotaFiscalService.enviarEmail(id, emails, req.user);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    res.status(400).json({ error: error.message });
  }
};