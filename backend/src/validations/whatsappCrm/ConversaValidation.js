import { body } from 'express-validator';

export const statusSchema = [
    body('status').notEmpty().withMessage('status é obrigatório').isIn(['aberta', 'em_atendimento', 'resolvida']),
];

export const responsavelSchema = [
    body('responsavel_id').optional({ nullable: true }).isInt(),
];

export const mensagemSchema = [
    body('texto').optional({ nullable: true }).isString(),
];

export const iniciarConversaSchema = [
    body('cliente_id').optional({ nullable: true }).isInt(),
    body('telefone').optional({ nullable: true }).isString(),
    body('nome_contato').optional({ nullable: true }).isString(),
];

export const renomearContatoSchema = [
    body('nome_contato').notEmpty().withMessage('nome_contato é obrigatório').isString(),
];

export const editarMensagemSchema = [
    body('texto').notEmpty().withMessage('texto é obrigatório').isString(),
];
