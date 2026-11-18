// src/controllers/fiscal/NFeController.js

import Venda from '../../models/Venda.js';
import Cliente from '../../models/Cliente.js';
import Product from '../../models/Product.js';
import ConfiguracaoFiscal from '../../models/ConfiguracaoFiscal.js';
import NotaFiscalEmitida from '../../models/NotaFiscalEmitida.js';

import NFePayloadBuilder from '../../services/builders/NFePayloadBuilder.js';
import FocusNFeService from '../../services/focus/FocusNFeService.js';
import VendaService from '../../services/VendaService.js';
import { selecionarItensFiscais } from '../../utils/prepararVendaFiscal.js';
import { usuarioPodeAcessarNota } from '../../utils/notaFiscalAccess.js';
import { buildPublicNfeUrl } from '../../utils/publicNfeLink.js';

class NFeController {
  async emitir(req, res) {
    try {
      const {
        vendaId,
        itemIds,
        destinatarioIsentoIE = false
      } = req.body;

      const venda = await VendaService.getById(vendaId, req.currentUser);
      const { itens: itensSelecionados, vendaFiscal } =
        selecionarItensFiscais(venda, itemIds);

      if (!venda) {
        return res.status(404).json({
          success: false,
          message: 'Venda não encontrada.'
        });
      }

      const configuracaoFiscal = await ConfiguracaoFiscal.findOne({
        where: {
          empresa_id: venda.empresa_id
        }
      });

      if (!configuracaoFiscal) {
        return res.status(400).json({
          success: false,
          message: 'Configuração fiscal não encontrada.'
        });
      }

      const cliente = venda.cliente_id
        ? await Cliente.findByPk(venda.cliente_id)
        : null;

      const produtoIds = itensSelecionados
    .map(item => item.produto_id)
    .filter(Boolean);

    const produtos = await Product.findAll({
    where: {
        id: produtoIds
    }
    });

    const produtosMap = new Map(
    produtos.map(produto => [produto.id, produto])
    );

    const itens = itensSelecionados.map(item => ({
    ...item.toJSON(),
    produto: produtosMap.get(item.produto_id)
    }));

      const payload = NFePayloadBuilder.build({
        venda: vendaFiscal,
        cliente,
        configuracaoFiscal,
        itens,
        destinatarioIsentoIE: destinatarioIsentoIE === true
      });

      const resultado = await FocusNFeService.emitir(
        venda.empresa_id,
        vendaId,
        payload
      );

      return res.status(200).json({
        success: true,
        data: resultado
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async consultar(req, res) {
    try {
      const { id } = req.params;

      const nota = await NotaFiscalEmitida.findByPk(id);

      if (!nota) {
        return res.status(404).json({
          success: false,
          message: 'Nota fiscal não encontrada.'
        });
      }

      const resultado = await FocusNFeService.consultar(nota.empresa_id, nota.referencia_externa);

      return res.json({
        success: true,
        data: resultado
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async refazer(req, res) {
    try {
      const nota = await NotaFiscalEmitida.findOne({
        where: {
          id: req.params.id,
          tipo: 'NFE'
        }
      });

      if (!nota) {
        return res.status(404).json({
          success: false,
          message: 'Nota fiscal não encontrada.'
        });
      }

      if (!usuarioPodeAcessarNota(nota, req.user || req.currentUser)) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado a esta nota fiscal.'
        });
      }

      const resultado = await FocusNFeService.refazer(
        nota,
        req.body?.ajustes || {}
      );

      return res.status(resultado.success ? 200 : 422).json({
        success: resultado.success,
        data: resultado.data,
        registro: resultado.registro,
        origem_id: resultado.origem_id,
        error: resultado.error,
        message: resultado.error?.message
      });
    } catch (error) {
      console.error('Erro ao refazer NF-e:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async baixarXml(req, res) {
    try {
      const { id } = req.params;

      const nota = await NotaFiscalEmitida.findByPk(id);

      if (!nota) {
        return res.status(404).json({
          success: false,
          message: 'Nota fiscal não encontrada'
        });
      }

      if (!nota.xml_url) {
        return res.status(400).json({
          success: false,
          message: 'XML ainda não disponível'
        });
      }

      const xml = await FocusNFeService.baixarArquivo(
        nota.empresa_id,
        nota.xml_url,
        'text'
      );

      const nomeArquivo = `nfe-${nota.numero || nota.id}.xml`;

      return res
        .status(200)
        .setHeader('Content-Type', 'application/xml; charset=utf-8')
        .setHeader(
          'Content-Disposition',
          `attachment; filename="${nomeArquivo}"`
        )
        .send(xml);
    } catch (error) {
      console.error('Erro ao baixar XML:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao baixar XML'
      });
    }
  }

  async baixarPdf(req, res) {
    try {
      const { id } = req.params;

      const nota = await NotaFiscalEmitida.findByPk(id);

      if (!nota) {
        return res.status(404).json({
          success: false,
          message: 'Nota fiscal não encontrada'
        });
      }

      const pdfUrl = nota.pdf_url || nota.danfe_url;

      if (!pdfUrl) {
        return res.status(400).json({
          success: false,
          message: 'PDF ainda não disponível'
        });
      }

      const pdf = await FocusNFeService.baixarArquivo(
        nota.empresa_id,
        pdfUrl,
        'arraybuffer'
      );

      return res
        .setHeader('Content-Type', 'application/pdf')
        .setHeader(
          'Content-Disposition',
          `inline; filename="nfe-${nota.numero || nota.id}.pdf"`
        )
        .send(Buffer.from(pdf));

    } catch (error) {
      console.error('Erro ao baixar PDF:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao baixar PDF'
      });
    }
  }

  async cancelar(req, res) {
    try {
      const { id } = req.params;
      const { justificativa } = req.body;

      const nota = await NotaFiscalEmitida.findByPk(id);

      if (!nota) {
        return res.status(404).json({
          success: false,
          message: 'Nota fiscal não encontrada.'
        });
      }

      const resultado = await FocusNFeService.cancelar(
        nota.empresa_id,
        nota.referencia_externa,
        justificativa
      );

      return res.json({
        success: true,
        data: resultado
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async listar(req, res) {
    try {
      const { empresaId } = req.query;

      const notas = await NotaFiscalEmitida.findAll({
        where: {
          empresa_id: empresaId,
          tipo: 'NFE'
        },
        order: [['created_at', 'DESC']]
      });

      const vendaIds = notas
        .map(nota => nota.venda_id)
        .filter(Boolean);
      const vendas = vendaIds.length
        ? await Venda.findAll({
            where: {
              id: vendaIds,
              empresa_id: empresaId
            },
            attributes: ['id'],
            include: [{
              model: Cliente,
              as: 'cliente',
              required: false,
              attributes: [
                'id', 'nomeCompleto', 'cpf', 'cnpj', 'inscricao_estadual',
                'telefone', 'email', 'cep', 'rua', 'numero', 'complemento',
                'bairro', 'cidade', 'estado', 'pais'
              ]
            }]
          })
        : [];
      const clientesPorVenda = new Map(
        vendas.map(venda => [Number(venda.id), venda.cliente ? venda.cliente.toJSON() : null])
      );
      const dados = notas.map(nota => {
        let publicUrl = null;
        try {
          if (['autorizado', 'cancelado'].includes(String(nota.status || '').toLowerCase()) && nota.pdf_url) {
            publicUrl = buildPublicNfeUrl(req, nota.id);
          }
        } catch (error) {
          // A listagem de NF-e não pode falhar apenas porque o ambiente não
          // configurou a chave para os links públicos.
          console.warn('[NF-e] Link público indisponível:', error.message);
        }

        return {
          ...nota.toJSON(),
          cliente: clientesPorVenda.get(Number(nota.venda_id)) ?? null,
          public_url: publicUrl
        };
      });

      return res.json({
        success: true,
        data: dados
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async buscarPorId(req, res) {
    try {
      const { id } = req.params;

      const nota = await NotaFiscalEmitida.findOne({
        where: {
          id,
          tipo: 'NFE'
        }
      });

      if (!nota) {
        return res.status(404).json({
          success: false,
          message: 'Nota fiscal não encontrada.'
        });
      }

      return res.json({
        success: true,
        data: nota
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async buscarPorVenda(req, res) {
    try {
      const { vendaId } = req.params;

      const nota = await NotaFiscalEmitida.findOne({
        where: {
          venda_id: vendaId,
          tipo: 'NFE'
        }
      });

      return res.json({
        success: true,
        data: nota
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new NFeController();
