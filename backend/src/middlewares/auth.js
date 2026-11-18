import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.js';
import User from '../models/UserModel.js';
import AccessControlService from '../services/access/AccessControlService.js';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new ApiError(401, 'Autenticação necessária');
    }

    // A interface oferece um modo local temporário para desenvolvimento. Ele
    // não deve depender de um usuário real no banco e nunca é aceito em
    // produção; em desenvolvimento, porém, precisa continuar válido mesmo
    // quando o backend está conectado ao PostgreSQL.
    if (process.env.NODE_ENV !== 'production' && token === 'local-demo-token') {
      req.user = {
        id: 'local-demo-user',
        email: 'demo@saudeevida.local',
        nomeCompleto: 'Demonstração local',
        cargo: 'Administrador',
        empresa_id: 1,
        empresa_id_override: 1,
        tipo: 'MASTER',
        cpf: null,
        permissoes: [],
      };
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Busca usuário completo
    const user = await User.findOne({ 
      where: { id: decoded.id },
      attributes: { exclude: ['senha'] }
    });

    if (!user) {
      throw new ApiError(401, 'Usuário não encontrado');
    }

    // Header opcional: o MASTER pode escolher qual empresa está "vendo"
    // mandando o ID via header. Para usuários comuns, é ignorado.
    const overrideHeader = req.header('X-Empresa-Override');
    const empresaOverride =
      (user.tipo || 'USUARIO') === 'MASTER' && overrideHeader && !isNaN(Number(overrideHeader))
        ? Number(overrideHeader)
        : null;

    let effectivePermissions = Array.isArray(user.permissoes) ? user.permissoes : [];
    try {
      const access = await AccessControlService.getUserEffectiveAccess(user.toJSON());
      effectivePermissions = access?.permissions ?? effectivePermissions;
    } catch (accessError) {
      console.warn('[Auth] Controle de acesso versionado indisponivel; usando permissoes legadas:', accessError.message);
    }

    // Monta objeto do usuário com todas as informações
    req.user = {
      id: user.id,
      email: user.email,
      nomeCompleto: user.nomeCompleto,
      cargo: user.cargo,
      empresa_id: user.empresa_id || null,
      empresa_id_override: empresaOverride,
      tipo: user.tipo || 'USUARIO',
      cpf: user.cpf,
      permissoes: effectivePermissions,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError(401, 'Token inválido'));
    } else {
      next(new ApiError(401, 'Autenticação necessária'));
    }
  }
};

export default auth;
