import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import sequelize from '../config/database.js';
import googleAuthService from '../services/GoogleAuthService.js';

dotenv.config();

class GoogleAuthController {
  async googleLogin(req, res, next) {
    const { credential, empresa_id: empresaEscolhida } = req.body;

    try {
      if (!credential) {
        return res.status(400).json({ message: 'Token do Google não fornecido' });
      }

      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(500).json({ message: 'Autenticação com Google não configurada no servidor' });
      }

      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET não configurado');
      }

      const googlePayload = await googleAuthService.verifyGoogleToken(credential);
      const result = await googleAuthService.findOrCreateByGoogle(googlePayload, empresaEscolhida);

      // Multi-empresa: retorna lista de empresas para o frontend selecionar
      if (result.multiEmpresa) {
        const empresaIds = [...new Set(result.contas.map(c => c.empresa_id).filter(Boolean))];
        const empresas = await sequelize.query(
          'SELECT id, nome FROM empresas WHERE id IN (:ids)',
          { replacements: { ids: empresaIds }, type: sequelize.QueryTypes.SELECT }
        );
        const empresaMap = Object.fromEntries(empresas.map(e => [e.id, e.nome]));

        return res.status(200).json({
          multiEmpresa: true,
          empresas: result.contas.map(c => ({
            empresa_id: c.empresa_id,
            nome: empresaMap[c.empresa_id] ?? `Empresa #${c.empresa_id}`,
            cargo: c.cargo,
          }))
        });
      }

      const user = result.user;

      // Gera exatamente o mesmo JWT utilizado no login tradicional
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          nome: user.nomeCompleto,
          cargo: user.cargo,
          empresa_id: user.empresa_id,
          tipo: user.tipo || 'USUARIO',
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(200).json({
        token,
        user: {
          id: user.id,
          nome: user.nomeCompleto,
          email: user.email,
          cargo: user.cargo,
          empresa_id: user.empresa_id,
          tipo: user.tipo || 'USUARIO',
          permissoes: user.permissoes,
          comissao_tipo: user.comissao_tipo,
          comissao_valor: user.comissao_valor,
        }
      });
    } catch (error) {
      console.error('[GoogleAuthController] ERRO:', error.message);
      next(error);
    }
  }
}

export default new GoogleAuthController();
