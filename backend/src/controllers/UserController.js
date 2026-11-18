import userService from '../services/UserService.js';
import ApiResponse from '../utils/apiResponse.js';
import CloudinaryService from '../utils/CloudinaryService.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import sequelize from '../config/database.js';
import UserModel from '../models/UserModel.js';
import AccessControlService from '../services/access/AccessControlService.js';

dotenv.config();

class UserController {
  async create(req, res, next) {
    console.log('[UserController] CREATE - Início do método');
    const dadosSeguros = req.body && typeof req.body === 'object'
      ? { ...req.body, ...(req.body.senha ? { senha: '[REDACTED]' } : {}) }
      : req.body;
    console.log('[UserController] Dados recebidos:', JSON.stringify(dadosSeguros, null, 2));

    try {
      // Passa o usuário logado (para associar à empresa)
      const user = await userService.createUser(req.body, req.user);
      console.log('[UserController] Usuário criado com sucesso');

      new ApiResponse(res).success(201, user, 'Usuário criado com sucesso');
    } catch (error) {
      console.error('[UserController] ERRO no create:', error);
      next(error);
    }
  }

  async getAll(req, res, next) {
    console.log('[UserController] GET_ALL - Início do método');

    try {
      const filters = {
        nome: req.query.nome,
        cargo: req.query.cargo,
        empresa_id: req.query.empresa_id ? Number(req.query.empresa_id) : undefined,
      };

      // Passa o usuário logado para filtrar por empresa
      const users = await userService.getAllUsers(filters, req.user);

      new ApiResponse(res).success(200, users);
    } catch (error) {
      console.error('[UserController] ERRO no getAll:', error);
      next(error);
    }
  }

  async getSalesStaff(req, res, next) {
    try {
      const users = await userService.getSalesStaff(req.user);
      new ApiResponse(res).success(200, users);
    } catch (error) {
      console.error('[UserController] ERRO no getSalesStaff:', error);
      next(error);
    }
  }

  async getById(req, res, next) {
    console.log('[UserController] GET_BY_ID - ID:', req.params.id);

    try {
      // Passa o usuário logado para verificar permissão
      const user = await userService.getUserById(req.params.id, req.user);

      new ApiResponse(res).success(200, user);
    } catch (error) {
      console.error('[UserController] ERRO no getById:', error);
      next(error);
    }
  }

  async update(req, res, next) {
    console.log('[UserController] UPDATE - ID:', req.params.id);

    try {
      // Passa o usuário logado para verificar permissão
      const user = await userService.updateUser(req.params.id, req.body, req.user);

      new ApiResponse(res).success(200, user, 'Usuário atualizado com sucesso');
    } catch (error) {
      console.error('[UserController] ERRO no update:', error);
      next(error);
    }
  }

  async delete(req, res, next) {
    console.log('[UserController] DELETE - ID:', req.params.id);

    try {
      // Passa o usuário logado para verificar permissão
      await userService.deleteUser(req.params.id, req.user);

      new ApiResponse(res).success(200, null, 'Usuário deletado com sucesso');
    } catch (error) {
      console.error('[UserController] ERRO no delete:', error);
      next(error);
    }
  }

  async login(req, res, next) {
    const { email, senha, empresa_id: empresaEscolhida } = req.body;
    try {
      if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não configurado');

      // Teclados móveis e gerenciadores de senha podem inserir espaços ou
      // capitalizar o e-mail. O identificador de login deve ser estável,
      // sem alterar a senha informada pelo usuário.
      const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const contas = await userService.getUsersByEmail(emailNormalizado);
      if (!contas.length) return res.status(401).json({ message: 'Credenciais inválidas' });

      // Valida senha contra cada conta individualmente (cada empresa pode ter senha diferente)
      const resultadosSenha = await Promise.all(
        contas.map(async (c) => {
          const valida = await bcrypt.compare(senha, c.senha);
          return valida ? c : null;
        })
      );
      const contasComSenhaValida = resultadosSenha.filter(Boolean);
      if (!contasComSenhaValida.length) return res.status(401).json({ message: 'Credenciais inválidas' });

      // Filtra contas ativas (com senha correta)
      const contasAtivas = contasComSenhaValida.filter(c => c.status !== 'bloqueado');
      if (!contasAtivas.length) return res.status(403).json({ message: 'Usuário bloqueado. Procure o administrador.' });

      // MASTER não tem empresa_id — login direto
      const isMaster = contasAtivas[0].tipo === 'MASTER' || contasAtivas[0].email === 'admin@master.com';

      // Multi-empresa: se há mais de uma conta ativa e não escolheu ainda
      if (!isMaster && contasAtivas.length > 1 && !empresaEscolhida) {
        // Busca nomes das empresas
        const empresaIds = [...new Set(contasAtivas.map(c => c.empresa_id).filter(Boolean))];
        const empresas = await sequelize.query(
          'SELECT id, nome FROM empresas WHERE id IN (:ids)',
          { replacements: { ids: empresaIds }, type: sequelize.QueryTypes.SELECT }
        );
        const empresaMap = Object.fromEntries(empresas.map(e => [e.id, e.nome]));

        return res.status(200).json({
          multiEmpresa: true,
          empresas: contasAtivas.map(c => ({
            empresa_id: c.empresa_id,
            nome: empresaMap[c.empresa_id] ?? `Empresa #${c.empresa_id}`,
            cargo: c.cargo,
          }))
        });
      }

      // Seleciona a conta correta (única ou a escolhida)
      const user = empresaEscolhida
        ? contasAtivas.find(c => c.empresa_id === Number(empresaEscolhida))
        : contasAtivas[0];

      if (!user) return res.status(404).json({ message: 'Conta não encontrada para esta empresa' });

      let effectivePermissions = Array.isArray(user.permissoes) ? user.permissoes : [];
      try {
        const access = await AccessControlService.getUserEffectiveAccess(user.toJSON());
        effectivePermissions = access?.permissions ?? effectivePermissions;
      } catch (accessError) {
        console.warn('[Login] Controle de acesso versionado indisponivel; usando permissoes legadas:', accessError.message);
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, nome: user.nomeCompleto, cargo: user.cargo, empresa_id: user.empresa_id, tipo: user.tipo || 'USUARIO' },
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
          permissoes: effectivePermissions,
          comissao_tipo: user.comissao_tipo,
          comissao_valor: user.comissao_valor
        }
      });
    } catch (error) {
      console.error('[UserController] ERRO no login:', error);
      next(error);
    }
  }

  async checkToken(req, res, next) {
    try {
      new ApiResponse(res).success(200, {
        valid: true,
        user: req.user
      });
    } catch (error) {
      next(error);
    }
  }

  // Verifica se a senha de um usuário específico está correta (sem gerar token)
  async verificarSenha(req, res, next) {
    const { user_id, senha } = req.body;
    try {
      if (!user_id || !senha) return res.status(400).json({ ok: false, message: 'user_id e senha são obrigatórios' });
      // Usa unscoped para incluir o campo senha (excluído pelo defaultScope)
      const user = await UserModel.unscoped().findByPk(user_id);
      if (!user) return res.status(404).json({ ok: false, message: 'Usuário não encontrado' });
      const valida = await bcrypt.compare(senha, user.senha);
      if (!valida) return res.status(401).json({ ok: false, message: 'Senha incorreta' });
      res.json({ ok: true, nome: user.nomeCompleto, email: user.email });
    } catch (error) {
      next(error);
    }
  }

   // NOVO: Upload de avatar
  async uploadAvatar(req, res, next) {
    console.log('[UserController] UPLOAD AVATAR - Início');
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      console.log('[UserController] Arquivo recebido:', {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // Upload para Cloudinary (mesmo padrão do Estoque de Roupas)
      const result = await CloudinaryService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        'lucromais/usuarios/avatars'
      );

      console.log('[UserController] Upload concluído:', {
        secure_url: result.secure_url,
        public_id: result.public_id
      });

      return res.json({
        avatar_url: result.secure_url,
        public_id: result.public_id
      });
    } catch (error) {
      console.error('[UserController] ERRO no uploadAvatar:', error);
      next(error);
    }
  }

  // NOVO: Deletar avatar
  async deleteAvatar(req, res, next) {
    console.log('[UserController] DELETE AVATAR - ID:', req.params.id);
    
    try {
      await userService.deleteAvatar(req.params.id, req.user);
      
      return res.json({ message: 'Avatar removido com sucesso' });
    } catch (error) {
      console.error('[UserController] ERRO no deleteAvatar:', error);
      next(error);
    }
  }
}

export default new UserController();
