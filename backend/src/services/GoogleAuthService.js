import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import User from '../models/UserModel.js';
import ApiError from '../utils/apiError.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class GoogleAuthService {
  async verifyGoogleToken(credential) {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      throw new ApiError(401, 'Email não verificado pelo Google. Verifique sua conta Google antes de continuar.');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      nomeCompleto: payload.name || payload.email,
      avatar_url: payload.picture || null,
    };
  }

  async findOrCreateByGoogle(googlePayload, empresaEscolhida) {
    const { googleId, email, nomeCompleto, avatar_url } = googlePayload;

    // Busca todas as contas com esse email (suporte multi-empresa)
    const contas = await User.unscoped().findAll({ where: { email } });

    if (contas.length > 0) {
      const contasAtivas = contas.filter(c => c.status !== 'bloqueado');
      if (!contasAtivas.length) {
        throw new ApiError(403, 'Usuário bloqueado. Procure o administrador.');
      }

      // Vincula o google_id e avatar_url nas contas existentes (sem alterar outros dados)
      await User.update(
        { google_id: googleId, avatar_url },
        { where: { email } }
      );

      const isMaster = contasAtivas[0].tipo === 'MASTER' || contasAtivas[0].email === 'admin@master.com';

      if (!isMaster && contasAtivas.length > 1 && !empresaEscolhida) {
        return { multiEmpresa: true, contas: contasAtivas };
      }

      const user = empresaEscolhida
        ? contasAtivas.find(c => c.empresa_id === Number(empresaEscolhida))
        : contasAtivas[0];

      if (!user) {
        throw new ApiError(404, 'Conta não encontrada para esta empresa');
      }

      return { user };
    }

    // Usuário não existe — cria automaticamente
    // Gera hash aleatório para satisfazer a constraint NOT NULL de senha
    const senhaHash = await bcrypt.hash(randomUUID(), 10);

    const novoUser = await User.create({
      nomeCompleto,
      email,
      cargo: 'Colaborador',
      tipo: 'USUARIO',
      status: 'ativo',
      senha: senhaHash,
      google_id: googleId,
      avatar_url,
      permissoes: [],
    });

    return { user: novoUser };
  }
}

export default new GoogleAuthService();
