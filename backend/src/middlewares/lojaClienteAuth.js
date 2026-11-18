import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.js';
import Cliente from '../models/Cliente.js';
import lojaOnlineService from '../services/LojaOnlineService.js';

const lojaClienteAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new ApiError(401, 'Faça login para finalizar o pedido');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tipo !== 'CLIENTE_LOJA' || !decoded.id || !decoded.empresa_id) {
      throw new ApiError(401, 'Sessão de cliente inválida');
    }

    const empresa = await lojaOnlineService.resolverEmpresa(req.params.slug);
    if (Number(decoded.empresa_id) !== Number(empresa.id)) {
      throw new ApiError(401, 'A sessão não pertence a esta loja');
    }

    const cliente = await Cliente.findOne({
      where: { id: decoded.id, empresa_id: empresa.id },
    });
    if (!cliente || !cliente.loja_senha_hash) throw new ApiError(401, 'Sessão de cliente expirada');
    req.lojaCliente = cliente;
    req.lojaEmpresa = empresa;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) return next(new ApiError(401, 'Sessão de cliente expirada'));
    return next(error instanceof ApiError ? error : new ApiError(401, 'Autenticação de cliente necessária'));
  }
};

export default lojaClienteAuth;
