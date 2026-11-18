// src/controllers/focus/FocusResellerController.js

import FocusResellerService from '../../services/focus/FocusResellerService.js';

class FocusResellerController {
  async verificarConfiguracao(
    req,
    res,
    next
  ) {
    try {
      const { empresaId } =
        req.params;

      const configuracao =
        await FocusResellerService.verificarConfiguracao(
          Number(empresaId)
        );

      return res.json(
        configuracao
      );
    } catch (err) {
      next(err);
    }
  }

  async listarEmpresas(
    req,
    res,
    next
  ) {
    try {
      const empresas =
        await FocusResellerService.listarEmpresas(
          req.query
        );

      return res.json(
        empresas
      );
    } catch (err) {
      next(err);
    }
  }

  async detalharEmpresa(
    req,
    res,
    next
  ) {
    try {
      const { focusEmpresaId } =
        req.params;

      const empresa =
        await FocusResellerService.detalharEmpresa(
          Number(
            focusEmpresaId
          )
        );

      return res.json(
        empresa
      );
    } catch (err) {
      next(err);
    }
  }

  async criarEmpresa(
    req,
    res,
    next
  ) {
    console.log('CRIAR');
    try {
      const { empresaId } =
        req.params;
      console.log(empresaId)
      const integracao =
        await FocusResellerService.criarEmpresa(
          Number(empresaId),
          req.body
        );
      console.log('integracao', integracao);
      return res
        .status(201)
        .json(integracao);
    } catch (err) {
      next(err);
    }
  }

  async associarEmpresa(
    req,
    res,
    next
  ) {
    try {
      const { empresaId } =
        req.params;

      const integracao =
        await FocusResellerService.associarEmpresa(
          Number(empresaId),
          req.body
        );

      return res
        .status(201)
        .json(integracao);
    } catch (err) {
      next(err);
    }
  }

  async validarCriacao(
    req,
    res,
    next
  ) {

    console.log('VALIDAR');
    try {
      const resultado =
        await FocusResellerService.validarCriacao(
          req.body
        );

      return res.json(
        resultado
      );
    } catch (err) {
      next(err);
    }
  }

  async editarEmpresa(
    req,
    res,
    next
  ) {
    try {
      const { empresaId } =
        req.params;

      const integracao =
        await FocusResellerService.editarEmpresa(
          Number(empresaId),
          req.body
        );

      return res.json(
        integracao
      );
    } catch (err) {
      next(err);
    }
  }

  async deletarEmpresa(
    req,
    res,
    next
  ) {
    try {
      const { empresaId } =
        req.params;

      const resultado =
        await FocusResellerService.deletarEmpresa(
          Number(empresaId)
        );

      return res.json(
        resultado
      );
    } catch (err) {
      next(err);
    }
  }
}

export default new FocusResellerController();