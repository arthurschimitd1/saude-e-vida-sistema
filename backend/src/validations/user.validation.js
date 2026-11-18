import { body } from 'express-validator';

export const createUserSchema = [
  body('nomeCompleto').notEmpty().withMessage('Nome completo é obrigatório'),
  body('cpf')
    .optional({ checkFalsy: true })
    .isLength({ min: 14, max: 14 }).withMessage('CPF deve ter 11 dígitos')
    .matches(/^\d{3}\.\d{3}\.\d{3}\-\d{2}$/).withMessage('CPF deve estar no formato 000.000.000-00'),
  body('cargo').notEmpty().withMessage('Cargo é obrigatório'),
  body('email')
    .notEmpty().withMessage('Email é obrigatório')
    .isEmail().withMessage('Email inválido'),
  body('senha')
    .notEmpty().withMessage('Senha é obrigatória')
    .isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('rua').optional({ checkFalsy: true }),
  body('bairro').optional({ checkFalsy: true }),
  body('cidade').optional({ checkFalsy: true }),
  body('estado').optional({ checkFalsy: true }),
  body('numero').optional({ checkFalsy: true }),
  body('tipo')
    .optional()
    .isIn(['MASTER', 'EMPRESA', 'CONTADOR', 'USUARIO'])
    .withMessage('Tipo deve ser MASTER, EMPRESA, CONTADOR ou USUARIO'),
  body('avatar_position')
    .optional({ nullable: true })
    .matches(/^\d{1,3}%\s\d{1,3}%$/)
    .withMessage('avatar_position deve estar no formato "50% 50%"')
];

export const updateUserSchema = [
  body('nomeCompleto').optional().notEmpty().withMessage('Nome completo é obrigatório'),
  body('cpf')
    .optional({ checkFalsy: true })
    .isLength({ min: 14, max: 14 }).withMessage('CPF deve ter 11 dígitos')
    .matches(/^\d{3}\.\d{3}\.\d{3}\-\d{2}$/).withMessage('CPF deve estar no formato 000.000.000-00'),
  body('cargo').optional().notEmpty().withMessage('Cargo é obrigatório'),
  body('email')
    .optional()
    .isEmail().withMessage('Email inválido'),
  body('senha')
    .optional()
    .isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('rua').optional({ checkFalsy: true }),
  body('bairro').optional({ checkFalsy: true }),
  body('cidade').optional({ checkFalsy: true }),
  body('estado').optional({ checkFalsy: true }),
  body('numero').optional({ checkFalsy: true }),
  body('tipo')
    .optional()
    .isIn(['MASTER', 'EMPRESA', 'CONTADOR', 'USUARIO'])
    .withMessage('Tipo deve ser MASTER, EMPRESA, CONTADOR ou USUARIO'),
  body('status')
    .optional()
    .isIn(['ativo', 'bloqueado'])
    .withMessage('Status deve ser ativo ou bloqueado'),
  body('permissoes')
    .optional()
    .isArray()
    .withMessage('Permissões devem ser uma lista'),
  body('comissao_tipo')
    .optional({ nullable: true })
    .isIn(['percent', 'valor'])
    .withMessage('comissao_tipo deve ser "percent" ou "valor"'),
  body('comissao_valor')
    .optional({ nullable: true })
    .isDecimal()
    .withMessage('comissao_valor deve ser número'),
  body('avatar_position')
    .optional({ nullable: true })
    .matches(/^\d{1,3}%\s\d{1,3}%$/)
    .withMessage('avatar_position deve estar no formato "50% 50%"')
];

export default {
  createUserSchema,
  updateUserSchema
};
