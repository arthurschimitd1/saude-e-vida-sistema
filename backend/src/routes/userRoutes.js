import express from 'express';
import userController from '../controllers/UserController.js';
import validate from '../middlewares/validate.js';
import { createUserSchema, updateUserSchema } from '../validations/user.validation.js';
import auth from '../middlewares/auth.js';
import { uploadAvatar } from '../middlewares/upload.js';
import sequelize from '../config/database.js';
import bcrypt from 'bcrypt';
import requireCargo, { PERM_USUARIOS_FULL, PERM_USUARIOS_LISTA_FULL } from '../middlewares/requireCargo.js';

const router = express.Router();

// Rotas protegidas (todas precisam de auth exceto listagem pública se houver)
const gerenciarUsuarios = requireCargo({ permissoes: PERM_USUARIOS_FULL, mensagem: 'Sem permissão para gerenciar usuários' });
const consultarUsuarios = requireCargo({ permissoes: PERM_USUARIOS_LISTA_FULL, mensagem: 'Sem permissão para consultar usuários' });

router.post('/', auth, gerenciarUsuarios, validate(createUserSchema), userController.create);
// Compatibilidade com o Caixa: a tela precisa consultar os funcionários
// mesmo quando o operador não possui permissão administrativa de usuários.
router.get('/', auth, userController.getAll);
// Lista mínima de funcionários para o Caixa. Não expõe a base administrativa
// completa de usuários e permite que operadores com acesso a vendas selecionem
// o responsável pela venda.
router.get('/funcionarios-venda', auth, userController.getSalesStaff);

// Rotas de avatar
router.post('/avatar/upload', auth, uploadAvatar, userController.uploadAvatar);
router.delete('/:id/avatar', auth, requireCargo({ permissoes: PERM_USUARIOS_FULL, permitirProprio: true }), userController.deleteAvatar);

// A própria ficha continua disponível para o layout e o perfil; alterações
// administrativas permanecem restritas a gestão/permissão explícita.
router.get('/:id', auth, requireCargo({ permissoes: PERM_USUARIOS_LISTA_FULL, permitirProprio: true }), userController.getById);
router.put('/:id', auth, gerenciarUsuarios, validate(updateUserSchema), userController.update);
router.delete('/:id', auth, gerenciarUsuarios, userController.delete);

// Rota especial: revela a senha de um usuário (só Gerente, Dono ou MASTER)
router.get('/:id/senha', auth, async (req, res) => {
    try {
        const solicitante = req.user;
        const cargosPermitidos = ['Gerente', 'Dono', 'Administrador'];
        const permissoes = Array.isArray(solicitante?.permissoes) ? solicitante.permissoes : [];
        const temPermissao =
            solicitante?.tipo === 'MASTER' ||
            solicitante?.email === 'admin@master.com' ||
            cargosPermitidos.includes(solicitante?.cargo) ||
            permissoes.includes('senha:ver');

        if (!temPermissao) {
            return res.status(403).json({ error: 'Sem permissão para visualizar senhas' });
        }

        const rows = await sequelize.query(
            'SELECT senha_texto FROM users WHERE id = :id',
            { replacements: { id: req.params.id }, type: sequelize.QueryTypes.SELECT }
        );
        if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });

        const senhaTexto = rows[0].senha_texto;
        if (!senhaTexto) {
            return res.status(404).json({ error: 'Senha não disponível. O usuário precisa redefinir a senha para que ela possa ser visualizada.' });
        }
        res.json({ senha: senhaTexto });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
