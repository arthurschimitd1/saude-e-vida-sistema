import { body } from 'express-validator';

export const createOrcamentoSchema = [
    body('nome_cliente')
        .notEmpty().withMessage('nome_cliente é obrigatório')
        .isString(),

    body('itens')
        .isArray({ min: 1 }).withMessage('Pelo menos 1 item é obrigatório'),

    body('itens.*.nome')
        .notEmpty().withMessage('nome do item é obrigatório')
        .isString(),

    body('itens.*.quantidade')
        .notEmpty().withMessage('quantidade obrigatória em cada item')
        .isFloat({ min: 0.001 }).withMessage('quantidade deve ser maior que zero'),

    body('itens.*.preco')
        .notEmpty().withMessage('preço obrigatório em cada item')
        .isDecimal()
];

export const updateOrcamentoSchema = [
    body('nome_cliente').optional().isString(),
    body('itens').optional().isArray(),
];
