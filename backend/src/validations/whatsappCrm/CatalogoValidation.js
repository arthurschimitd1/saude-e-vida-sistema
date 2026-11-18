import { param, body } from 'express-validator';

export const tipoCatalogoParamSchema = [
    param('tipo').isIn(['estagio', 'motivo_clinico', 'profissional']).withMessage('tipo de catálogo inválido'),
];

export const catalogoItemSchema = [
    ...tipoCatalogoParamSchema,
    body('nome').notEmpty().withMessage('nome é obrigatório').isString(),
    body('cor').optional({ nullable: true }).isString(),
];
