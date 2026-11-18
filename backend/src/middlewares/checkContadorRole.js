// src/middlewares/checkContadorRole.js
import { usuarioPodeAcessarAreaContador } from '../utils/contadorAccess.js';

export default async function checkContadorRole(req, res, next) {
  try {
    const autorizado = await usuarioPodeAcessarAreaContador(req.user);

    if (autorizado) {
      return next();
    }

    return res.status(403).json({ error: 'Acesso restrito a empresas com Pacote Contador.' });
  } catch (error) {
    next(error);
  }
}
