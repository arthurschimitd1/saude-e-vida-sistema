import ManifestoService from '../../services/manifestos/ManifestoService.js';

const contexto = (req) => ({
  ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip
});

const resposta = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });

class ManifestoController {
  dashboard = async (req, res, next) => {
    try {
      return resposta(res, await ManifestoService.dashboard(req.manifestoEmpresaId));
    } catch (error) { return next(error); }
  };

  documentosElegiveis = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.listarDocumentosElegiveis(
          req.manifestoEmpresaId,
          req.query.busca
        )
      );
    } catch (error) { return next(error); }
  };

  listarVeiculos = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.listarVeiculos(
          req.manifestoEmpresaId,
          req.query.incluir_inativos === 'true'
        )
      );
    } catch (error) { return next(error); }
  };

  criarVeiculo = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.salvarVeiculo(req.manifestoEmpresaId, req.body),
        201
      );
    } catch (error) { return next(error); }
  };

  atualizarVeiculo = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.salvarVeiculo(
          req.manifestoEmpresaId,
          req.body,
          req.params.id
        )
      );
    } catch (error) { return next(error); }
  };

  excluirVeiculo = async (req, res, next) => {
    try {
      await ManifestoService.excluirVeiculo(req.manifestoEmpresaId, req.params.id);
      return resposta(res, { message: 'Veículo arquivado com sucesso.' });
    } catch (error) { return next(error); }
  };

  listarCondutores = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.listarCondutores(
          req.manifestoEmpresaId,
          req.query.incluir_inativos === 'true'
        )
      );
    } catch (error) { return next(error); }
  };

  criarCondutor = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.salvarCondutor(req.manifestoEmpresaId, req.body),
        201
      );
    } catch (error) { return next(error); }
  };

  atualizarCondutor = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.salvarCondutor(
          req.manifestoEmpresaId,
          req.body,
          req.params.id
        )
      );
    } catch (error) { return next(error); }
  };

  excluirCondutor = async (req, res, next) => {
    try {
      await ManifestoService.excluirCondutor(req.manifestoEmpresaId, req.params.id);
      return resposta(res, { message: 'Condutor arquivado com sucesso.' });
    } catch (error) { return next(error); }
  };

  listarMdfe = async (req, res, next) => {
    try {
      return res.json({
        success: true,
        ...(await ManifestoService.listarMdfe(req.manifestoEmpresaId, req.query))
      });
    } catch (error) { return next(error); }
  };

  detalharMdfe = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.detalharMdfe(req.manifestoEmpresaId, req.params.id)
      );
    } catch (error) { return next(error); }
  };

  criarMdfe = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.criarMdfe(
          req.manifestoEmpresaId,
          req.user.id,
          req.body,
          contexto(req)
        ),
        201
      );
    } catch (error) { return next(error); }
  };

  atualizarMdfe = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.atualizarMdfe(
          req.manifestoEmpresaId,
          req.user.id,
          req.params.id,
          req.body,
          contexto(req)
        )
      );
    } catch (error) { return next(error); }
  };

  validarMdfe = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.validar(req.manifestoEmpresaId, req.params.id)
      );
    } catch (error) { return next(error); }
  };

  emitirMdfe = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.emitir(
          req.manifestoEmpresaId,
          req.user.id,
          req.params.id,
          contexto(req)
        )
      );
    } catch (error) { return next(error); }
  };

  consultarMdfe = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.consultar(
          req.manifestoEmpresaId,
          req.user.id,
          req.params.id,
          contexto(req)
        )
      );
    } catch (error) { return next(error); }
  };

  cancelarMdfe = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.cancelar(
          req.manifestoEmpresaId,
          req.user.id,
          req.params.id,
          req.body.justificativa,
          contexto(req)
        )
      );
    } catch (error) { return next(error); }
  };

  encerrarMdfe = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.encerrar(
          req.manifestoEmpresaId,
          req.user.id,
          req.params.id,
          req.body,
          contexto(req)
        )
      );
    } catch (error) { return next(error); }
  };

  incluirCondutor = async (req, res, next) => {
    try {
      return resposta(
        res,
        await ManifestoService.incluirCondutor(
          req.manifestoEmpresaId,
          req.user.id,
          req.params.id,
          req.body.condutor_id,
          contexto(req)
        )
      );
    } catch (error) { return next(error); }
  };

  arquivarMdfe = async (req, res, next) => {
    try {
      await ManifestoService.arquivar(
        req.manifestoEmpresaId,
        req.user.id,
        req.params.id,
        contexto(req)
      );
      return resposta(res, { message: 'Rascunho arquivado com sucesso.' });
    } catch (error) { return next(error); }
  };
}

export default new ManifestoController();
