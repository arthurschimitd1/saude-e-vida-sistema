import {
  FiscalEmpresaScopeError,
  resolverEmpresaFiscal
} from '../utils/fiscalEmpresaScope.js';

export default function resolveFiscalEmpresa(req, res, next) {
  try {
    req.fiscalEmpresaId = resolverEmpresaFiscal(req.user, req.params.empresaId);
    req.params.empresaId = String(req.fiscalEmpresaId);
    return next();
  } catch (error) {
    if (error instanceof FiscalEmpresaScopeError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
}
