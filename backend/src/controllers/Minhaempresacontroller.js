import bcrypt from 'bcrypt';
import MinhaEmpresa from '../models/Minhaempresa.js';
import sequelize from '../config/database.js';
import { CENTRAL_GESTAO_ROUTE, CENTRAL_GESTAO_VISUALIZAR_FLAG } from '../access/accessCatalog.js';

// Módulos liberados para donos cadastrados via Minha Empresa
// Equivale ao Pacote 1 (Home + Operacional + Comercial + Financeiro + Entradas/Saídas + Admin)
const PERMISSOES_EMPRESA_MINHA_EMPRESA = [
  CENTRAL_GESTAO_ROUTE,
  '/', '/dashboard',                                             // Home
  '/uikit/formlayout', '/uikit/overlay', '/uikit/producao', '/uikit/relatorios-produtos', '/uikit/pedidos', '/uikit/fornecedores', '/uikit/agendamentos', // Operacional
  '/uikit/button', '/uikit/tree', '/uikit/input', '/uikit/servicos', '/uikit/servicos-nfe', '/uikit/servicos-nfce', '/uikit/historico-notas', // Comercial
  '/uikit/list', '/uikit/table', '/uikit/comissoes', '/uikit/notas-fiscais', // Financeiro
  '/financeiro/entradas', '/financeiro/contas-receber', '/financeiro/saidas', // Entradas/Saídas
  '/uikit/invalidstate', '/uikit/panel', '/uikit/media', '/uikit/integracao-focus', // Administração
];
const PERMISSOES_DONO_MINHA_EMPRESA = [
  ...PERMISSOES_EMPRESA_MINHA_EMPRESA,
  CENTRAL_GESTAO_VISUALIZAR_FLAG
];

// Garante estrutura necessária nas tabelas
(async () => {
  try {
    await sequelize.query(`ALTER TABLE minha_empresa ADD COLUMN IF NOT EXISTS empresa_id INTEGER`);
    await sequelize.query(`ALTER TABLE users ALTER COLUMN cpf DROP NOT NULL`);
  } catch {}
})();

// GET /api/minha-empresa
export const listarEmpresas = async (req, res) => {
  try {
    const where = {};
    if (req.query.empresa_id) where.empresa_id = Number(req.query.empresa_id);
    const empresas = await MinhaEmpresa.findAll({
      where,
      attributes: { exclude: ['senha_contato'] }
    });
    res.json(empresas);
  } catch (error) {
    console.error('Erro ao listar empresas:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/minha-empresa/:id
export const buscarEmpresa = async (req, res) => {
  try {
    const empresa = await MinhaEmpresa.findByPk(req.params.id, {
      attributes: { exclude: ['senha_contato'] }
    });
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    res.json(empresa);
  } catch (error) {
    console.error('Erro ao buscar empresa:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/minha-empresa
export const criarEmpresa = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const dados = { ...req.body };
    const { email, senha_contato, responsavel, cpf_responsavel, razao_social } = dados;

    let empresaId = null;

    // Se tem email e senha, cria o acesso de login para o responsável
    if (email && senha_contato) {
      // Verifica se já existe usuário com esse email
      const [existente] = await sequelize.query(
        'SELECT id FROM users WHERE email = :email LIMIT 1',
        { replacements: { email }, type: sequelize.QueryTypes.SELECT, transaction: t }
      );

      if (existente) {
        await t.rollback();
        return res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail' });
      }

      // Cria empresa no sistema de acesso com os módulos padrão do dono
      const [empresaResult] = await sequelize.query(
        'INSERT INTO empresas (nome, permissoes) VALUES ($1, $2) RETURNING id',
        { bind: [razao_social || 'Empresa', PERMISSOES_EMPRESA_MINHA_EMPRESA], type: sequelize.QueryTypes.INSERT, transaction: t }
      );
      empresaId = empresaResult[0]?.id;

      // Cria usuário de login para o responsável (dono) com os módulos padrão
      const senhaHash = await bcrypt.hash(senha_contato, 10);
      await sequelize.query(
        `INSERT INTO users
          ("nomeCompleto", cpf, cargo, email, senha, senha_texto, rua, bairro, cidade, estado, numero, tipo, status, permissoes, empresa_id, created_at, updated_at)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EMPRESA', 'ativo', $12, $13, NOW(), NOW())`,
        {
          bind: [
            responsavel || razao_social || 'Responsável',
            cpf_responsavel || null,
            'Dono',
            email,
            senhaHash,
            senha_contato,
            '', '', '', '', '',
            PERMISSOES_DONO_MINHA_EMPRESA,
            empresaId
          ],
          type: sequelize.QueryTypes.INSERT,
          transaction: t
        }
      );

      dados.empresa_id = empresaId;

      // Armazena hash da senha de contato
      dados.senha_contato = senhaHash;
    } else if (dados.senha_contato) {
      dados.senha_contato = await bcrypt.hash(dados.senha_contato, 10);
    }

    const empresa = await MinhaEmpresa.create(dados, { transaction: t });
    await t.commit();

    const { senha_contato: _sc, ...empresaSemSenha } = empresa.toJSON();
    res.status(201).json(empresaSemSenha);
  } catch (error) {
    await t.rollback();
    console.error('Erro ao criar empresa:', error);
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/minha-empresa/:id
export const atualizarEmpresa = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const empresa = await MinhaEmpresa.findByPk(req.params.id, { transaction: t });
    if (!empresa) {
      await t.rollback();
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    const dados = { ...req.body };

    const empresaId = empresa.dataValues.empresa_id;

    // Sincroniza nome da empresa no sistema de acesso
    if (dados.razao_social && empresaId) {
      await sequelize.query(
        'UPDATE empresas SET nome = :nome WHERE id = :id',
        { replacements: { nome: dados.razao_social, id: empresaId }, type: sequelize.QueryTypes.UPDATE, transaction: t }
      );
    }

    // Se nova senha foi informada, atualiza o hash e o usuário de login
    if (dados.senha_contato) {
      const senhaHash = await bcrypt.hash(dados.senha_contato, 10);

      const emailAtual = dados.email || empresa.dataValues.email;
      if (empresaId && emailAtual) {
        await sequelize.query(
          'UPDATE users SET senha = :hash, senha_texto = :texto, updated_at = NOW() WHERE empresa_id = :eid AND email = :email',
          {
            replacements: { hash: senhaHash, texto: dados.senha_contato, eid: empresaId, email: emailAtual },
            type: sequelize.QueryTypes.UPDATE,
            transaction: t
          }
        );
      }

      dados.senha_contato = senhaHash;
    }

    await empresa.update(dados, { transaction: t });
    await t.commit();

    const { senha_contato, ...empresaSemSenha } = empresa.toJSON();
    res.json(empresaSemSenha);
  } catch (error) {
    await t.rollback();
    console.error('Erro ao atualizar empresa:', error);
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/minha-empresa/:id
export const deletarEmpresa = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const empresa = await MinhaEmpresa.findByPk(req.params.id, { transaction: t });
    if (!empresa) {
      await t.rollback();
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    const empresaId = empresa.dataValues.empresa_id;

    // Remove registros vinculados no sistema de acesso
    if (empresaId) {
      await sequelize.query(
        'DELETE FROM users WHERE empresa_id = :id',
        { replacements: { id: empresaId }, type: sequelize.QueryTypes.DELETE, transaction: t }
      );
      await sequelize.query(
        'DELETE FROM empresas WHERE id = :id',
        { replacements: { id: empresaId }, type: sequelize.QueryTypes.DELETE, transaction: t }
      );
    }

    await empresa.destroy({ transaction: t });
    await t.commit();
    res.json({ message: 'Empresa deletada com sucesso' });
  } catch (error) {
    await t.rollback();
    console.error('Erro ao deletar empresa:', error);
    res.status(500).json({ error: error.message });
  }
};
