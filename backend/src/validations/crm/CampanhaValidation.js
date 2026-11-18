import { body } from 'express-validator';

export const createCampanhaSchema = [
    body('name')
        .notEmpty().withMessage('Nome da campanha é obrigatório')
        .isString(),
    body('segment')
        .optional({ nullable: true }).isString(),
    body('description')
        .optional({ nullable: true }).isString(),
    body('states')
        .optional({ nullable: true }).isArray(),
    body('cities')
        .optional({ nullable: true }).isArray(),
    body('neighborhoods')
        .optional({ nullable: true }).isArray(),
    body('radius')
        .optional({ nullable: true }).isInt({ min: 1 }).withMessage('Raio deve ser no mínimo 1 km'),
];

export const updateCampanhaSchema = [
    body('name').optional().isString(),
    body('segment').optional({ nullable: true }).isString(),
    body('description').optional({ nullable: true }).isString(),
    body('states').optional({ nullable: true }).isArray(),
    body('cities').optional({ nullable: true }).isArray(),
    body('neighborhoods').optional({ nullable: true }).isArray(),
    body('radius').optional({ nullable: true }).isInt({ min: 1 }),
];
