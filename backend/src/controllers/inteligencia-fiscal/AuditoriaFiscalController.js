// src/controllers/inteligencia-fiscal/AuditoriaFiscalController.js

import AuditoriaFiscalService from '../../services/inteligencia-fiscal/AuditoriaFiscalService.js';

class AuditoriaFiscalController {
  async executarNota(req, res, next) {
    try {
      console.log("executando nota");
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;
      const usuarioId = req.user?.id ?? req.query.userId;
      const notaFiscalId = req.params.notaFiscalId;

      console.log({
        notaFiscalId,
        empresaId,
        usuarioId,
      });

      const resultado = await AuditoriaFiscalService.executarNota({
        empresaId,
        usuarioId,
        notaFiscalId,
      });

      return res.status(201).json({
        message: 'Auditoria executada com sucesso.',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  }

  async executarPeriodo(req, res, next) {
    try {
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;
      const usuarioId = req.user?.id ?? req.query.userId;

      const resultado = await AuditoriaFiscalService.executarPeriodo({
        empresaId,
        usuarioId,
        ...req.body,
      });

      return res.status(201).json({
        message: 'Auditoria executada com sucesso.',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  }

  async listar(req, res, next) {
    try {
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;

      const resultado = await AuditoriaFiscalService.listar({
        empresaId,
        ...req.query,
      });

      return res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  async buscarDetalhes(req, res, next) {
    try {
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;

      const resultado = await AuditoriaFiscalService.buscarDetalhes({
        empresaId,
        auditoriaId: req.params.id,
      });

      return res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  async obterDashboard(req, res, next) {
    try {
      const empresaId = req.user?.empresa_id ?? req.query.empresaId;

      const resultado = await AuditoriaFiscalService.obterDashboard({
        empresaId,
        ...req.query,
      });

      return res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }
}

export default new AuditoriaFiscalController();