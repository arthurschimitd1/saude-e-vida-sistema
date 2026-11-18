import {
  FiscalEmpresaScopeError,
  resolverEmpresaFiscal
} from '../utils/fiscalEmpresaScope.js';

export default function resolveManifestoEmpresa(req, res, next) {
  try {
    req.manifestoEmpresaId = resolverEmpresaFiscal(req.user, undefined);
    return next();
  } catch (error) {
    if (error instanceof FiscalEmpresaScopeError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    return next(error);
  }
}
