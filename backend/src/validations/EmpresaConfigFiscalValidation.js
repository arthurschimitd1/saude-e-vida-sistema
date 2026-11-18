import { body, param } from 'express-validator';

export const configFiscalSchema = [
  param('empresa_id').isInt(),
  body('focusnfe_token').notEmpty().withMessage('Token Focus é obrigatório'),
  body('ambiente').isIn(['homologacao', 'producao']),
  body('cnpj_emitente').notEmpty().isLength({ min: 14, max: 14 }).withMessage('CNPJ deve ter 14 dígitos'),
  body('inscricao_estadual_emitente').optional(),
  body('regime_tributario_emitente').optional().isIn([1, 2, 3]),
];