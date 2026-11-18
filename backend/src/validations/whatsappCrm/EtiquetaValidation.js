import { body } from 'express-validator';

export const etiquetaCatalogoSchema = [
    body('nome').notEmpty().withMessage('nome é obrigatório').isString(),
    body('cor').optional({ nullable: true }).isString(),
    body('tipo').optional({ nullable: true }).isIn(['etiqueta', 'protocolo']),
];
