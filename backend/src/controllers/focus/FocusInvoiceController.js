// src/controllers/FocusInvoiceController.js

import focusInvoiceService from '../../services/focus/FocusInvoiceService.js';

class FocusInvoiceController {
  /**
   * GET /focus/invoices/:empresaId?type=nfe|nfse
   */
  async listar(req, res) {
    try {
      const {
        type,
        data_inicio,
        data_fim
      } = req.query;

      const { empresaId } = req.params;

      if (
        !type ||
        !['nfe', 'nfse'].includes(type)
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Tipo inválido. Use nfe ou nfse.'
        });
      }

      if (!empresaId) {
        return res.status(400).json({
          success: false,
          error:
            'empresaId é obrigatório.'
        });
      }

      const dateRegex =
        /^\d{4}-\d{2}-\d{2}$/;

      if (
        data_inicio &&
        !dateRegex.test(data_inicio)
      ) {
        return res.status(400).json({
          success: false,
          error:
            'data_inicio deve estar no formato YYYY-MM-DD'
        });
      }

      if (
        data_fim &&
        !dateRegex.test(data_fim)
      ) {
        return res.status(400).json({
          success: false,
          error:
            'data_fim deve estar no formato YYYY-MM-DD'
        });
      }

      console.log(
        `📄 Listando ${type.toUpperCase()} da empresa ${empresaId}`
      );

      const resultado =
        type === 'nfe'
          ? await focusInvoiceService.listarNFeRecebidas(
              empresaId,
              data_inicio,
              data_fim
            )
          : await focusInvoiceService.listarNFSeRecebidas(
              empresaId,
              data_inicio,
              data_fim
            );

      if (!resultado.success) {
        return res.status(400).json({
          ...resultado,
          message:
            resultado.error?.message ||
            'Erro ao listar notas'
        });
      }

      return res.json({
        success: true,
        data: resultado.data,
        meta: resultado.meta
      });
    } catch (error) {
      console.error(
        '❌ Erro ao listar invoices:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          'Erro ao listar notas'
      });
    }
  }

  /**
   * POST /focus/invoices/:empresaId/nfe/:chave/manifestation
   */
  async manifestar(req, res) {
    try {
      const {
        empresaId,
        chave
      } = req.params;

      const { tipo, justificativa } =
        req.body;

      if (!tipo) {
        return res.status(400).json({
          success: false,
          error:
            'Tipo de manifestação é obrigatório.'
        });
      }

      const resultado =
        await focusInvoiceService.manifestarNFe(
          empresaId,
          chave,
          tipo,
          justificativa
        );

      if (!resultado.success) {
        return res.status(400).json({
          ...resultado,
          message:
            resultado.error?.message ||
            'Erro ao manifestar NF-e'
        });
      }

      return res.json({
        success: true,
        data: resultado.data,
        persistence: resultado.persistence
      });
    } catch (error) {
      console.error(
        '❌ Erro ao manifestar NF-e:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          'Erro ao manifestar NF-e'
      });
    }
  }

  /**
   * GET /focus/invoices/:empresaId/nfe/:chave/xml
   */
  async baixarXMLNFe(
    req,
    res
  ) {
    try {
      const {
        empresaId,
        chave
      } = req.params;

      const resultado =
        await focusInvoiceService.baixarXMLNFe(
          empresaId,
          chave
        );

      if (!resultado.success) {
        return res.status(resultado.status === 404 ? 404 : 502).json(
          resultado
        );
      }

      const buffer =
        Buffer.from(
          resultado.data.xml,
          'base64'
        );

      res.setHeader(
        'Content-Type',
        'application/xml'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${resultado.data.filename}"`
      );

      return res.send(buffer);
    } catch (error) {
      console.error(
        '❌ Erro ao baixar XML NF-e:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          'Erro ao baixar XML NF-e'
      });
    }
  }

  /**
   * GET /focus/invoices/:empresaId/nfse/:chave/xml
   */
  async baixarXMLNFSe(
    req,
    res
  ) {
    try {
      const {
        empresaId,
        chave
      } = req.params;

      const resultado =
        await focusInvoiceService.baixarXMLNFSe(
          empresaId,
          chave
        );

      if (!resultado.success) {
        return res.status(resultado.status === 404 ? 404 : 502).json(
          resultado
        );
      }

      const buffer =
        Buffer.from(
          resultado.data.xml,
          'base64'
        );

      res.setHeader(
        'Content-Type',
        'application/xml'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${resultado.data.filename}"`
      );

      return res.send(buffer);
    } catch (error) {
      console.error(
        '❌ Erro ao baixar XML NFS-e:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          'Erro ao baixar XML NFS-e'
      });
    }
  }

  /**
   * GET /focus/invoices/:empresaId/nfe/:chave/pdf
   */
  async baixarPDFNFe(
    req,
    res
  ) {
    try {
      const {
        empresaId,
        chave
      } = req.params;

      const resultado =
        await focusInvoiceService.baixarPDFNFe(
          empresaId,
          chave
        );

      if (!resultado.success) {
        return res.status(resultado.status === 404 ? 404 : 502).json(
          resultado
        );
      }

      const buffer =
        Buffer.from(
          resultado.data.pdf,
          'base64'
        );

      res.setHeader(
        'Content-Type',
        'application/pdf'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${resultado.data.filename}"`
      );

      return res.send(buffer);
    } catch (error) {
      console.error(
        '❌ Erro ao baixar PDF NF-e:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          'Erro ao baixar PDF NF-e'
      });
    }
  }

  /**
   * GET /focus/invoices/:empresaId/nfse/:chave/pdf
   */
  async baixarPDFNFSe(
    req,
    res
  ) {
    try {
      const {
        empresaId,
        chave
      } = req.params;

      const resultado =
        await focusInvoiceService.baixarPDFNFSe(
          empresaId,
          chave
        );

      if (!resultado.success) {
        return res.status(resultado.status === 404 ? 404 : 502).json(
          resultado
        );
      }

      const buffer =
        Buffer.from(
          resultado.data.pdf,
          'base64'
        );

      res.setHeader(
        'Content-Type',
        'application/pdf'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${resultado.data.filename}"`
      );

      return res.send(buffer);
    } catch (error) {
      console.error(
        '❌ Erro ao baixar PDF NFS-e:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          'Erro ao baixar PDF NFS-e'
      });
    }
  }
}

export default new FocusInvoiceController();
