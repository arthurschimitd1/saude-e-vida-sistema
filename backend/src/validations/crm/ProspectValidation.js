import { body } from 'express-validator';

export const createProspectSchema = [
    body('company_name')
        .notEmpty().withMessage('Nome da empresa é obrigatório')
        .isString(),
    body('campaign_id')
        .optional({ nullable: true }).isInt(),
    body('responsible_name')
        .optional({ nullable: true }).isString(),
    body('phone')
        .optional({ nullable: true }).isString(),
    body('email')
        .optional({ nullable: true }).isEmail().withMessage('E-mail inválido'),
    body('instagram')
        .optional({ nullable: true }).isString(),
    body('website')
        .optional({ nullable: true }).isURL().withMessage('Website inválido'),
    body('google_rating')
        .optional({ nullable: true }).isFloat({ min: 0, max: 5 }),
    body('google_reviews')
        .optional({ nullable: true }).isInt({ min: 0 }),
    body('status')
        .optional({ nullable: true }).isString(),
    body('observations')
        .optional({ nullable: true }).isString(),
];

export const updateProspectSchema = [
    body('company_name').optional().isString(),
    body('responsible_name').optional({ nullable: true }).isString(),
    body('phone').optional({ nullable: true }).isString(),
    body('email').optional({ nullable: true }).isEmail(),
    body('instagram').optional({ nullable: true }).isString(),
    body('website').optional({ nullable: true }),
    body('google_rating').optional({ nullable: true }).isFloat({ min: 0, max: 5 }),
    body('google_reviews').optional({ nullable: true }).isInt({ min: 0 }),
    body('status').optional({ nullable: true }).isString(),
    body('observations').optional({ nullable: true }).isString(),
];
