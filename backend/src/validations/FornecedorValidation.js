import { body, param } from 'express-validator';

const cpf = body('cpf')
    .optional({ nullable: true })
    .matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
    .withMessage('CPF deve estar no formato 000.000.000-00');

const cnpj = body('cnpj')
    .optional({ nullable: true })
    .matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)
    .withMessage('CNPJ deve estar no formato 00.000.000/0000-00');

const camposOpcionais = [
    body('email').optional({ nullable: true }).isEmail().withMessage('E-mail inválido').isLength({ max: 255 }),
    body('cep').optional({ nullable: true }).matches(/^\d{5}-\d{3}$/).withMessage('CEP deve estar no formato 00000-000'),
    body('rua').optional({ nullable: true }).isString().isLength({ max: 255 }),
    body('bairro').optional({ nullable: true }).isString().isLength({ max: 150 }),
    body('cidade').optional({ nullable: true }).isString().isLength({ max: 150 }),
    body('estado').optional({ nullable: true }).isString().isLength({ min: 2, max: 2 }).withMessage('Estado deve ter 2 caracteres'),
    body('pais').optional({ nullable: true }).isString().isLength({ max: 100 }),
    body('numero').optional({ nullable: true }).isString().isLength({ max: 30 }),
    body('complemento').optional({ nullable: true }).isString().isLength({ max: 255 }),
    body('pontoReferencia').optional({ nullable: true }).isString().isLength({ max: 255 }),
    body('inscricao_estadual').optional({ nullable: true }).isString().isLength({ max: 50 })
];

export const fornecedorIdSchema = [
    param('id').isInt({ min: 1 }).withMessage('ID do fornecedor inválido')
];

export const createFornecedorSchema = [
    body('nomeCompleto')
        .trim()
        .notEmpty().withMessage('Nome ou razão social é obrigatório')
        .isLength({ max: 200 }).withMessage('Nome deve ter no máximo 200 caracteres'),
    body('telefone')
        .trim()
        .notEmpty().withMessage('Telefone é obrigatório')
        .isLength({ max: 30 }).withMessage('Telefone deve ter no máximo 30 caracteres'),
    cpf,
    cnpj,
    ...camposOpcionais
];

export const updateFornecedorSchema = [
    ...fornecedorIdSchema,
    body('nomeCompleto')
        .optional()
        .trim()
        .notEmpty().withMessage('Nome ou razão social não pode ficar vazio')
        .isLength({ max: 200 }).withMessage('Nome deve ter no máximo 200 caracteres'),
    body('telefone')
        .optional()
        .trim()
        .notEmpty().withMessage('Telefone não pode ficar vazio')
        .isLength({ max: 30 }).withMessage('Telefone deve ter no máximo 30 caracteres'),
    cpf,
    cnpj,
    ...camposOpcionais
];
