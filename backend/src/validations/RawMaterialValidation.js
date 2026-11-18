import { body } from 'express-validator';

export const createRawMaterialSchema = [
  body('name')
    .notEmpty().withMessage('Nome é obrigatório')
    .isString().withMessage('Nome deve ser uma string'),

  body('unit')
    .notEmpty().withMessage('Unidade de medida é obrigatória')
    .isString().withMessage('Unidade deve ser uma string'),

  body('currentQuantity')
    .optional()
    .isDecimal().withMessage('Estoque deve ser um número'),

  body('price')
    .notEmpty().withMessage('Custo por unidade é obrigatório')
    .isDecimal().withMessage('Custo por unidade deve ser um número')
];

export const updateRawMaterialSchema = [
  ...createRawMaterialSchema.map(validation => validation.optional())
];
