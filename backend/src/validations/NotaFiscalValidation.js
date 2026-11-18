import { body, param } from 'express-validator';

export const emitirNotaSchema = [
  body('venda_id')
    .notEmpty().withMessage('venda_id é obrigatório')
    .isInt().withMessage('venda_id deve ser um número inteiro'),
];

export const cancelarNotaSchema = [
  param('id').isInt().withMessage('ID inválido'),
  body('justificativa')
    .notEmpty().withMessage('justificativa é obrigatória')
    .isLength({ min: 15, max: 255 }).withMessage('justificativa deve ter entre 15 e 255 caracteres'),
];

export const emailNotaSchema = [
  param('id').isInt(),
  body('emails')
    .isArray({ min: 1, max: 10 }).withMessage('emails deve ser um array com 1 a 10 endereços')
    .custom((emails) => emails.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    .withMessage('Um ou mais e-mails são inválidos'),
];