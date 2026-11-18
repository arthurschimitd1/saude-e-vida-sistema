// src/controllers/fiscal/NFCeController.js
import puppeteer from 'puppeteer';

import Venda from '../../models/Venda.js';
import Cliente from '../../models/Cliente.js';
import Product from '../../models/Product.js';
import ConfiguracaoFiscal from '../../models/ConfiguracaoFiscal.js';
import NotaFiscalEmitida from '../../models/NotaFiscalEmitida.js';

import NFCePayloadBuilder from '../../services/builders/NFCePayloadBuilder.js';
import FocusNFCeService from '../../services/focus/FocusNFCeService.js';
import { usuarioPodeAcessarNota } from '../../utils/notaFiscalAccess.js';
import VendaService from '../../services/VendaService.js';
import { selecionarItensFiscais } from '../../utils/prepararVendaFiscal.js';

class NFCeController {
  async emitir(req, res) {
    try {
      const { vendaId, itemIds } = req.body;

      const venda = await VendaService.getById(
        vendaId,
        req.currentUser
      );
      const { itens: itensSelecionados, vendaFiscal } =
        selecionarItensFiscais(venda, itemIds);

      if (!venda) {
        return res.status(404).json({
          success: false,
          message: 'Venda não encontrada.'
        });
      }

      const configuracaoFiscal =
        await ConfiguracaoFiscal.findOne({
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

      const payload = NFCePayloadBuilder.build({
        venda: vendaFiscal,
        cliente,
        configuracaoFiscal,
        itens
      });

      const resultado = await FocusNFCeService.emitir(
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

      const nota =
        await NotaFiscalEmitida.findByPk(id);

      if (!nota) {
        return res.status(404).json({
          success: false,
          message: 'Nota fiscal não encontrada.'
        });
      }

      const resultado =
        await FocusNFCeService.consultar(nota);

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
          tipo: 'NFCE'
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

      const resultado = await FocusNFCeService.refazer(
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
      console.error('Erro ao refazer NFC-e:', error);
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

      const xml = await FocusNFCeService.baixarArquivo(
        nota.empresa_id,
        nota.xml_url,
        'text'
      );

      return res
        .setHeader('Content-Type', 'application/xml')
        .setHeader(
          'Content-Disposition',
          `inline; filename="nfce-${nota.numero || nota.id}.xml"`
        )
        .send(xml);

    } catch (error) {
      console.error('Erro ao baixar XML NFC-e:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao baixar XML NFC-e'
      });
    }
  }

  async baixarPdf(req, res) {
    let browser;

    try {
      const { id } = req.params;

      const nota = await NotaFiscalEmitida.findByPk(id);

      if (!nota) {
        return res.status(404).json({
          success: false,
          message: 'Nota fiscal não encontrada'
        });
      }

      // Na NFC-e, a Focus retorna o DANFE em HTML.
      // Atualmente essa URL pode estar salva em pdf_url.
      const danfeUrl = nota.danfe_url || nota.pdf_url;

      if (!danfeUrl) {
        return res.status(400).json({
          success: false,
          message: 'DANFE ainda não disponível'
        });
      }

      const html = await FocusNFCeService.baixarArquivo(
        nota.empresa_id,
        danfeUrl,
        'text'
      );

      if (!html || typeof html !== 'string') {
        return res.status(502).json({
          success: false,
          message: 'O provedor não retornou um DANFE HTML válido'
        });
      }

      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      });

      const page = await browser.newPage();
      const formato = req.query.formato === '58x297'
        ? '58x297'
        : 'a4';

      await page.setContent(html, {
        waitUntil: 'networkidle0'
      });

      await page.emulateMediaType('screen');

      if (formato === '58x297') {
        await page.addStyleTag({
          content: `
            @page {
              size: 58mm 297mm !important;
              margin: 1mm 2mm !important;
            }
            html, body {
              width: 54mm !important;
              max-width: 54mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              max-width: 100% !important;
            }
            table {
              width: 100% !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
            }
            th, td, p, span, div {
              white-space: normal !important;
              overflow: visible !important;
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
              text-overflow: clip !important;
            }
            img, svg, canvas {
              height: auto !important;
              max-width: 100% !important;
            }
          `
        });
      }

      const pdf = await page.pdf(
        formato === '58x297'
          ? {
              printBackground: true,
              preferCSSPageSize: false,
              width: '58mm',
              height: '297mm',
              margin: {
                top: '1mm',
                right: '2mm',
                bottom: '1mm',
                left: '2mm'
              }
            }
          : {
              printBackground: true,
              preferCSSPageSize: true,
              format: 'A4',
              margin: {
                top: '5mm',
                right: '5mm',
                bottom: '5mm',
                left: '5mm'
              }
            }
      );

      const nomeArquivo = `nfce-${nota.numero || nota.id}.pdf`;

      return res
        .status(200)
        .setHeader('Content-Type', 'application/pdf')
        .setHeader(
          'Content-Disposition',
          `attachment; filename="${nomeArquivo}"`
        )
        .setHeader('Content-Length', pdf.length)
        .send(Buffer.from(pdf));
    } catch (error) {
      console.error('Erro ao gerar PDF da NFC-e:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar PDF da NFC-e'
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async visualizarDanfe(req, res) {
    try {
      const { id } = req.params;

      const nota = await NotaFiscalEmitida.findByPk(id);

      if (!nota) {
        return res.status(404).json({
          success: false,
          message: 'Nota fiscal não encontrada'
        });
      }

      // Atualmente a URL HTML da NFC-e está salva em pdf_url
      const danfeUrl = nota.danfe_url || nota.pdf_url;

      if (!danfeUrl) {
        return res.status(400).json({
          success: false,
          message: 'DANFE ainda não disponível'
        });
      }

      const html = await FocusNFCeService.baixarArquivo(
        nota.empresa_id,
        danfeUrl,
        'text'
      );

      return res
        .status(200)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .setHeader(
          'Content-Disposition',
          `inline; filename="nfce-${nota.numero || nota.id}.html"`
        )
        .send(html);
    } catch (error) {
      console.error('Erro ao visualizar DANFE NFC-e:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao visualizar DANFE NFC-e'
      });
    }
  }

  async cancelar(req, res) {
    try {
      const { id } = req.params;
      const { justificativa } = req.body;

      const nota =
        await NotaFiscalEmitida.findByPk(id);

      if (!nota) {
        return res.status(404).json({
          success: false,
          message: 'Nota fiscal não encontrada.'
        });
      }

      const resultado =
        await FocusNFCeService.cancelar({
          nota,
          justificativa
        });

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

      const notas =
        await NotaFiscalEmitida.findAll({
          where: {
            empresa_id: empresaId,
            tipo: 'NFCE'
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
      const dados = notas.map(nota => ({
        ...nota.toJSON(),
        cliente: clientesPorVenda.get(Number(nota.venda_id)) ?? null
      }));

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

      const nota =
        await NotaFiscalEmitida.findOne({
          where: {
            id,
            tipo: 'NFCE'
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

      const nota =
        await NotaFiscalEmitida.findOne({
          where: {
            venda_id: vendaId,
            tipo: 'NFCE'
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

export default new NFCeController();
