// src/controllers/inteligencia-fiscal/InconsistenciaFiscalController.js

import InconsistenciaFiscalService from '../../services/inteligencia-fiscal/InconsistenciaFiscalService.js';

class InconsistenciaFiscalController {
  async listar(req, res, next) {
    try {
      const resultado = await InconsistenciaFiscalService.listar({
        ...req.query,
      });

      return res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  async obterResumo(req, res, next) {
    try {
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;

      const resumo =
        await InconsistenciaFiscalService.obterResumo({
          empresaId,
          ...req.query,
        });

      return res.status(200).json(resumo);
    } catch (error) {
      next(error);
    }
  }

  async buscarDetalhes(req, res, next) {
    try {
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;

      const resultado =
        await InconsistenciaFiscalService.buscarDetalhes({
          empresaId,
          inconsistenciaId: req.params.id,
        });

      return res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  async alterarStatus(req, res, next) {
    try {
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;
      const usuarioId = req.user?.id ?? req.query.userId;

      const resultado =
        await InconsistenciaFiscalService.alterarStatus({
          empresaId,
          usuarioId,
          inconsistenciaId: req.params.id,
          ...req.body,
        });

      return res.status(200).json({
        message: 'Status atualizado com sucesso.',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  }

  async resolver(req, res, next) {
    try {
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;
      const usuarioId = req.user?.id ?? req.query.userId;

      const resultado =
        await InconsistenciaFiscalService.resolver({
          empresaId,
          usuarioId,
          inconsistenciaId: req.params.id,
          ...req.body,
        });

      return res.status(200).json({
        message: 'Inconsistência resolvida com sucesso.',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  }

  async atribuirResponsavel(req, res, next) {
    try {
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;
      const usuarioId = req.user?.id ?? req.query.userId;

      const resultado =
        await InconsistenciaFiscalService.atribuirResponsavel({
          empresaId,
          usuarioId,
          inconsistenciaId: req.params.id,
          ...req.body,
        });

      return res.status(200).json({
        message: 'Responsável atualizado com sucesso.',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  }

  async definirPrazo(req, res, next) {
    try {
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;
      const usuarioId = req.user?.id ?? req.query.userId;

      const resultado =
        await InconsistenciaFiscalService.definirPrazo({
          empresaId,
          usuarioId,
          inconsistenciaId: req.params.id,
          ...req.body,
        });

      return res.status(200).json({
        message: 'Prazo atualizado com sucesso.',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new InconsistenciaFiscalController();