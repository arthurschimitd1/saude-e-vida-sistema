import { body } from 'express-validator';

export const observacaoSchema = [
    body('observacao').notEmpty().withMessage('Observação é obrigatória').isString(),
];

export const etiquetaSchema = [
    body('etiqueta_id').notEmpty().withMessage('etiqueta_id é obrigatório').isInt(),
    body('sugerida_por_ia').optional({ nullable: true }).isBoolean(),
];

export const estagioSchema = [
    body('estagio').notEmpty().withMessage('estagio é obrigatório').isString(),
];

export const motivoClinicoSchema = [
    body('motivo_clinico').optional({ nullable: true }).isString(),
];

export const profissionalSchema = [
    body('profissional').optional({ nullable: true }).isString(),
];
