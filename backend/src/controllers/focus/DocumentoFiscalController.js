import FocusNFCeService from '../services/focus/FocusNFCeService.js';
import FocusNFeService from '../services/focus/FocusNFeService.js';

class DocumentoFiscalController {

  async emitir(req, res) {
    try {
      const { empresaId, vendaId, tipo, payload } = req.body;

      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'empresaId é obrigatório.'
        });
      }

      if (!vendaId) {
        return res.status(400).json({
          success: false,
          message: 'vendaId é obrigatório.'
        });
      }

      if (!tipo) {
        return res.status(400).json({
          success: false,
          message: 'tipo é obrigatório.'
        });
      }

      let resultado;

      switch (tipo.toUpperCase()) {
        case 'NFCE':
          resultado = await FocusNFCeService.emitir(
            empresaId,
            vendaId,
            payload
          );
          break;

        case 'NFE':
          resultado = await FocusNFeService.emitir(
            empresaId,
            vendaId,
            payload
          );
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de nota inválido. Utilize NFE ou NFCE.'
          });
      }

      return res
        .status(resultado.success ? 200 : 400)
        .json(resultado);

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async consultar(req, res) {
    try {
      const { empresaId, referencia } = req.params;
      const { tipo } = req.query;

      if (!tipo) {
        return res.status(400).json({
          success: false,
          message: 'tipo é obrigatório.'
        });
      }

      let resultado;

      switch (tipo.toUpperCase()) {
        case 'NFCE':
          resultado = await FocusNFCeService.consultar(
            empresaId,
            referencia
          );
          break;

        case 'NFE':
          resultado = await FocusNFeService.consultar(
            empresaId,
            referencia
          );
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de nota inválido.'
          });
      }

      return res
        .status(resultado.success ? 200 : 400)
        .json(resultado);

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async cancelar(req, res) {
    try {
      const { empresaId, referencia } = req.params;
      const { tipo, justificativa } = req.body;

      if (!tipo) {
        return res.status(400).json({
          success: false,
          message: 'tipo é obrigatório.'
        });
      }

      let resultado;

      switch (tipo.toUpperCase()) {
        case 'NFCE':
          resultado = await FocusNFCeService.cancelar(
            empresaId,
            referencia,
            justificativa
          );
          break;

        case 'NFE':
          resultado = await FocusNFeService.cancelar(
            empresaId,
            referencia,
            justificativa
          );
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de nota inválido.'
          });
      }

      return res
        .status(resultado.success ? 200 : 400)
        .json(resultado);

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async baixarXML(req, res) {
    try {
      const { empresaId, referencia } = req.params;
      const { tipo } = req.query;

      let resultado;

      switch (tipo?.toUpperCase()) {
        case 'NFCE':
          resultado = await FocusNFCeService.baixarXML(
            empresaId,
            referencia
          );
          break;

        case 'NFE':
          resultado = await FocusNFeService.baixarXML(
            empresaId,
            referencia
          );
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de nota inválido.'
          });
      }

      return res
        .status(resultado.success ? 200 : 400)
        .json(resultado);

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async baixarPDF(req, res) {
    try {
      const { empresaId, referencia } = req.params;
      const { tipo } = req.query;

      let resultado;

      switch (tipo?.toUpperCase()) {
        case 'NFCE':
          resultado = await FocusNFCeService.baixarPDF(
            empresaId,
            referencia
          );
          break;

        case 'NFE':
          resultado = await FocusNFeService.baixarPDF(
            empresaId,
            referencia
          );
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de nota inválido.'
          });
      }

      return res
        .status(resultado.success ? 200 : 400)
        .json(resultado);

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new DocumentoFiscalController();