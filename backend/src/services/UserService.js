import User from '../models/UserModel.js';
import ApiError from '../utils/apiError.js';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import AccessControlService from './access/AccessControlService.js';
import { CENTRAL_GESTAO_ROUTE, CENTRAL_GESTAO_VISUALIZAR_FLAG } from '../access/accessCatalog.js';

const FLAGS_INTERNAS = [
  CENTRAL_GESTAO_VISUALIZAR_FLAG,
  'ponto:todos',
  'planejamento:todos',
  'agendamento:todos',
  'comissoes:todos',
  'senha:ver',
  'caixa:pular_senha'
];

const ehDono = ({ tipo, cargo } = {}) =>
  String(tipo ?? '').toUpperCase() === 'EMPRESA'
  || String(cargo ?? '').trim().toLowerCase() === 'dono';

const permissoesUnicas = (permissions = []) => [...new Set(
  (Array.isArray(permissions) ? permissions : []).filter((permission) => typeof permission === 'string')
)];

const permissoesDono = (permissions = []) => permissoesUnicas([
  ...permissions,
  CENTRAL_GESTAO_ROUTE,
  CENTRAL_GESTAO_VISUALIZAR_FLAG
]);

const removerAcessoCentral = (permissions = []) => permissoesUnicas(permissions).filter(
  (permission) => permission !== CENTRAL_GESTAO_ROUTE && permission !== CENTRAL_GESTAO_VISUALIZAR_FLAG
);

class UserService {
  async createUser(userData, currentUser) {
    const permissionsWereExplicit = Object.prototype.hasOwnProperty.call(userData, 'permissoes');
    // empresa_id efetivo: vem do usuário logado ou do payload (MASTER escolhendo empresa)
    const empresaId = currentUser?.empresa_id ?? userData.empresa_id ?? null;

    // Verifica se CPF já existe (apenas quando informado)
    if (userData.cpf) {
      const whereCpf = { cpf: userData.cpf };
      if (empresaId) whereCpf.empresa_id = empresaId;
      const existingUserByCpf = await User.findOne({ where: whereCpf });
      if (existingUserByCpf) {
        throw new ApiError(400, 'CPF já cadastrado nesta empresa');
      }
    }

    // Verifica se email já existe (considerando empresa_id)
    const whereEmail = { email: userData.email };
    if (empresaId) whereEmail.empresa_id = empresaId;
    const existingUserByEmail = await User.findOne({ where: whereEmail });
    if (existingUserByEmail) {
      throw new ApiError(400, 'Email já cadastrado nesta empresa');
    }

    // Garante empresa_id no registro
    if (empresaId) userData.empresa_id = empresaId;

    // Se cargo tem definição customizada na empresa, inicializa permissões a partir dela
    // (apenas quando permissões não foram fornecidas explicitamente no payload)
    const dono = ehDono(userData);
    if ((userData.cargo || dono) && (!userData.permissoes || userData.permissoes.length === 0) && empresaId) {
      const [empresa] = await sequelize.query(
        'SELECT permissoes, cargos FROM empresas WHERE id = :id',
        { replacements: { id: empresaId }, type: sequelize.QueryTypes.SELECT }
      );
      if (empresa) {
        const cargosCustom = Array.isArray(empresa.cargos) ? empresa.cargos : [];
        const cargoConfig = cargosCustom.find(c => c.nome === userData.cargo);
        let empPerms = Array.isArray(empresa.permissoes) ? empresa.permissoes : [];
        try {
          const access = await AccessControlService.getCompanyAccess(empresaId);
          empPerms = access?.permissions ?? empPerms;
        } catch { /* fallback legado acima */ }
        if (dono) {
          userData.permissoes = permissoesDono(empPerms);
        } else if (cargoConfig) {
          // O cargo pode usar qualquer aba do sistema; a empresa não limita
          // mais as permissões disponíveis para seus usuários.
          userData.permissoes = cargoConfig.permissoes ?? [];
        }
      }
    }

    if (dono) userData.permissoes = permissoesDono(userData.permissoes);

    // Criptografa a senha e salva o texto original para recuperação autorizada
    const senhaOriginal = userData.senha;
    const hashedPassword = await bcrypt.hash(userData.senha, 10);
    userData.senha = hashedPassword;
    userData.senha_texto = senhaOriginal;

    const user = await sequelize.transaction(async (transaction) => {
      const createdUser = await User.create(userData, { transaction });
      await AccessControlService.initializeUserProfile(
        createdUser.id,
        dono ? 'INHERIT_COMPANY' : (permissionsWereExplicit ? 'EXPLICIT' : 'INHERIT_ROLE'),
        createdUser.permissoes,
        transaction
      );
      return createdUser;
    });
    
    // Remove senha do retorno
    const { senha, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  async getAllUsers(filters = {}, currentUser) {
    const whereClause = {};

    const empresaEfetiva = currentUser?.empresa_id_override ?? currentUser?.empresa_id;
    if (currentUser && currentUser.tipo !== 'MASTER' && !empresaEfetiva) {
      return [];
    }
    
    // Filtros
    if (filters.nome) {
      whereClause.nomeCompleto = { [Op.iLike]: `%${filters.nome}%` };
    }
    
    if (filters.cargo) {
      whereClause.cargo = filters.cargo;
    }

    // Isolamento multi-tenant
    if (currentUser && currentUser.empresa_id) {
      // Funcionário/dono só vê da própria empresa
      whereClause.empresa_id = currentUser.empresa_id;
    } else if (currentUser && currentUser.tipo === 'MASTER' && currentUser.empresa_id_override) {
      // MASTER com empresa selecionada só vê usuários daquela empresa
      whereClause.empresa_id = currentUser.empresa_id_override;
    } else if (filters.empresa_id) {
      // MASTER pode filtrar por empresa específica via query param
      whereClause.empresa_id = filters.empresa_id;
    }

    const users = await User.unscoped().findAll({
      where: whereClause,
      attributes: { exclude: ['senha', 'senha_texto'] }
    });
    return users;
  }

  async getSalesStaff(currentUser) {
    const empresaId = currentUser?.empresa_id_override ?? currentUser?.empresa_id;
    // Sem empresa efetiva, não há contexto seguro para listar funcionários.
    if (!empresaId) return [];

    // O Caixa precisa de uma lista operacional, não da listagem administrativa
    // de usuários. Usuários antigos podem ter sido criados antes do vínculo
    // obrigatório com empresa_id, mas continuam sendo vendedores válidos quando
    // já possuem vendas registradas nessa empresa. O EXISTS abaixo recupera
    // somente esses usuários e nunca atravessa o limite de empresa da venda.
    const rows = await sequelize.query(`
      SELECT DISTINCT
        u.id,
        u."nomeCompleto",
        u.email,
        u.comissao_tipo,
        u.comissao_valor
      FROM users u
      WHERE (u.tipo IS NULL OR u.tipo <> 'MASTER')
        AND (
          u.empresa_id = :empresaId
          OR EXISTS (
            SELECT 1
            FROM vendas v
            WHERE v.funcionario_id = u.id
              AND v.empresa_id = :empresaId
          )
        )
      ORDER BY u."nomeCompleto" ASC
    `, {
      replacements: { empresaId: Number(empresaId) },
      type: sequelize.QueryTypes.SELECT,
    });

    return rows;
  }

  async getUserById(id, currentUser) {
    const whereClause = { id };
    
    // Isolamento multi-tenant
    if (currentUser && currentUser.empresa_id && currentUser.tipo !== 'MASTER') {
      whereClause.empresa_id = currentUser.empresa_id;
    }
    
    const user = await User.unscoped().findOne({
      where: whereClause,
      attributes: { exclude: ['senha', 'senha_texto'] }
    });

    if (!user) {
      throw new ApiError(404, 'Usuário não encontrado');
    }
    return user;
  }

  async updateUser(id, userData, currentUser) {
    const whereClause = { id };

    // Isolamento multi-tenant
    if (currentUser && currentUser.empresa_id && currentUser.tipo !== 'MASTER') {
      whereClause.empresa_id = currentUser.empresa_id;
    }

    if (userData.permissoes) {
      console.log(`[PERM-AUDIT] PUT /users/${id} | caller: ${currentUser?.email ?? currentUser?.id ?? 'unknown'} (${currentUser?.tipo}) | perms(${userData.permissoes.length}): ${JSON.stringify(userData.permissoes)}`);
    }

    const user = await User.findOne({ where: whereClause });  
    
    if (!user) {
      throw new ApiError(404, 'Usuário não encontrado');
    }

    // Se estiver atualizando o email, verifica se já existe na mesma empresa
    if (userData.email && userData.email !== user.email) {
      const emailWhere = { 
        email: userData.email,
        empresa_id: user.empresa_id
      };
      const existingUser = await User.findOne({ where: emailWhere });
      if (existingUser) {
        throw new ApiError(400, 'Email já cadastrado nesta empresa');
      }
    }

    // Se estiver atualizando o CPF, verifica se já existe na mesma empresa
    if (userData.cpf && userData.cpf !== user.cpf) {
      const cpfWhere = { 
        cpf: userData.cpf,
        empresa_id: user.empresa_id
      };
      const existingUser = await User.findOne({ where: cpfWhere });
      if (existingUser) {
        throw new ApiError(400, 'CPF já cadastrado nesta empresa');
      }
    }

    // Se estiver atualizando a senha, criptografa e salva texto original
    if (userData.senha) {
      userData.senha_texto = userData.senha;
      userData.senha = await bcrypt.hash(userData.senha_texto, 10);
    }

    // Valida permissoes contra os módulos liberados pela empresa.
    // Flags internas de escopo (ex: ponto:todos) não são rotas da empresa — ignorar na validação.
    const seraDono = ehDono({
      tipo: userData.tipo ?? user.tipo,
      cargo: userData.cargo ?? user.cargo
    });
    if (seraDono) {
      const [empresa] = await sequelize.query(
        'SELECT permissoes FROM empresas WHERE id = :id',
        { replacements: { id: user.empresa_id }, type: sequelize.QueryTypes.SELECT }
      );
      userData.permissoes = permissoesDono(empresa?.permissoes ?? user.permissoes);
    } else if (Object.prototype.hasOwnProperty.call(userData, 'permissoes')) {
      userData.permissoes = removerAcessoCentral(userData.permissoes);
    } else if (ehDono(user)) {
      userData.permissoes = removerAcessoCentral(user.permissoes);
    }

    // As permissões do cargo/usuário são independentes do pacote da empresa.
    // O pacote permanece salvo apenas para compatibilidade com dados antigos.

    await sequelize.transaction(async (transaction) => {
      await user.update(userData, { transaction });
      if (Object.prototype.hasOwnProperty.call(userData, 'permissoes')) {
        await AccessControlService.markUserExplicit(user.id, userData.permissoes, transaction);
      }
    });
    
    // Retorna sem senha
    const { senha, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  async deleteUser(id, currentUser) {
    const whereClause = { id };
    
    // Isolamento multi-tenant
    if (currentUser && currentUser.empresa_id && currentUser.tipo !== 'MASTER') {
      whereClause.empresa_id = currentUser.empresa_id;
    }
    
    const user = await User.findOne({ where: whereClause });
    if (!user) {
      throw new ApiError(404, 'Usuário não encontrado');
    }

    // Bloqueia deleção de contas MASTER
    if (user.tipo === 'MASTER' || user.email === 'admin@master.com') {
      throw new ApiError(403, 'A conta Master não pode ser removida');
    }

    // Desvincula o usuário de todos os registros relacionados antes de deletar
    const desvincular = [
      // Mantém o colaborador e seus agendamentos, removendo somente o vínculo
      // com o usuário que será excluído.
      'UPDATE agendamento_colaboradores SET usuario_id = NULL WHERE usuario_id = :id',
      'UPDATE inventarios SET usuario_id = NULL WHERE usuario_id = :id',
      'UPDATE movimentos SET usuario_id = NULL WHERE usuario_id = :id',
      'UPDATE vendas SET funcionario_id = NULL WHERE funcionario_id = :id',
      'UPDATE orcamentos SET funcionario_id = NULL WHERE funcionario_id = :id',
      'UPDATE comissoes SET funcionario_id = NULL WHERE funcionario_id = :id',
    ];
    for (const sql of desvincular) {
      await sequelize.query(sql, { replacements: { id } }).catch(() => {});
    }

    await user.destroy();
    return { message: 'Usuário deletado com sucesso' };
  }

  async getUserByEmail(email) {
    const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
    return await User.unscoped().findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), emailNormalizado)
    });
  }

  async getUsersByEmail(email) {
    // Retorna TODAS as contas com esse email (multi-empresa)
    const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
    return await User.unscoped().findAll({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), emailNormalizado)
    });
  }

   // NOVO: Upload de avatar
  async uploadAvatar(userId, file, currentUser) {
    const whereClause = { id: userId };
    
    // Isolamento multi-tenant
    if (currentUser && currentUser.empresa_id && currentUser.tipo !== 'MASTER') {
      whereClause.empresa_id = currentUser.empresa_id;
    }
    
    const user = await User.findOne({ where: whereClause });
    if (!user) {
      throw new ApiError(404, 'Usuário não encontrado');
    }

    // Deleta avatar antigo do Cloudinary se existir
    if (user.avatar_url) {
      try {
        const publicId = this.extractPublicId(user.avatar_url);
        await CloudinaryService.deleteFile(publicId, 'image');
        console.log('[UserService] Avatar antigo deletado:', publicId);
      } catch (err) {
        console.warn('[UserService] Erro ao deletar avatar antigo:', err.message);
      }
    }

    // Faz upload do novo avatar
    const result = await CloudinaryService.uploadFile(
      file.buffer,
      file.originalname,
      'lucromais/usuarios/avatars'
    );

    // Atualiza o usuário com a nova URL
    await user.update({ avatar_url: result.secure_url });

    return {
      avatar_url: result.secure_url,
      public_id: result.public_id
    };
  }

  // NOVO: Deletar avatar
  async deleteAvatar(userId, currentUser) {
    const whereClause = { id: userId };
    
    // Isolamento multi-tenant
    if (currentUser && currentUser.empresa_id && currentUser.tipo !== 'MASTER') {
      whereClause.empresa_id = currentUser.empresa_id;
    }
    
    const user = await User.findOne({ where: whereClause });
    if (!user) {
      throw new ApiError(404, 'Usuário não encontrado');
    }

    // Deleta do Cloudinary
    if (user.avatar_url) {
      const publicId = this.extractPublicId(user.avatar_url);
      await CloudinaryService.deleteFile(publicId, 'image');
      console.log('[UserService] Avatar deletado:', publicId);
    }

    // Limpa a URL no banco
    await user.update({ avatar_url: null });

    return { message: 'Avatar removido' };
  }

  // Método auxiliar para extrair public_id da URL do Cloudinary
  extractPublicId(avatarUrl) {
    try {
      // URL example: https://res.cloudinary.com/demo/image/upload/v1234567890/lucromais/usuarios/avatars/filename_1234567890.jpg
      const url = new URL(avatarUrl);
      const pathname = url.pathname;
      
      // Remove a extensão e o caminho base
      const parts = pathname.split('/');
      const filenameWithExt = parts[parts.length - 1];
      const filename = filenameWithExt.substring(0, filenameWithExt.lastIndexOf('.'));
      
      // Reconstrói o public_id (pasta + nome do arquivo)
      const folderIndex = parts.indexOf('avatars');
      if (folderIndex !== -1) {
        const folderPath = parts.slice(folderIndex).join('/');
        return folderPath.substring(0, folderPath.lastIndexOf('.')) || folderPath;
      }
      
      return filename;
    } catch (error) {
      console.warn('[UserService] Erro ao extrair public_id:', error.message);
      return null;
    }
  }
}

export default new UserService();
