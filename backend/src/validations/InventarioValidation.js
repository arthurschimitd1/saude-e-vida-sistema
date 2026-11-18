import { body } from 'express-validator';

export const createInventarioSchema = [
  body('produto_id')
    .notEmpty().withMessage('produto_id é obrigatório')
    .isInt({ min: 1 }).withMessage('produto_id deve ser um inteiro válido'),

  body('quantidade_contada')
    .notEmpty().withMessage('quantidade_contada é obrigatória')
    .isFloat({ min: 0 }).withMessage('quantidade_contada deve ser um número >= 0'),

  body('observacao')
    .optional()
    .isString().withMessage('observacao deve ser uma string')
];

export const aplicarLoteSchema = [
  body('itens')
    .isArray({ min: 1 }).withMessage('itens deve ser um array com pelo menos 1 elemento'),

  body('itens.*.produto_id')
    .notEmpty().withMessage('produto_id é obrigatório em cada item')
    .isInt({ min: 1 }).withMessage('produto_id deve ser um inteiro válido'),

  body('itens.*.quantidade_contada')
    .notEmpty().withMessage('quantidade_contada é obrigatória em cada item')
    .isFloat({ min: 0 }).withMessage('quantidade_contada deve ser um número >= 0')
];
