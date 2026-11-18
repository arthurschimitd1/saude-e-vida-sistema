import { body } from 'express-validator';

export const createFuncionarioSchema = [
  body('nomeCompleto')
    .notEmpty().withMessage('Nome completo é obrigatório')
    .isString(),
  body('cargo')
    .notEmpty().withMessage('Cargo é obrigatório')
    .isString(),
  body('tipoContrato')
    .optional()
    .isIn(['CLT', 'PJ', 'ESTAGIO', 'FREELANCER']).withMessage('Tipo de contrato inválido'),
  body('salarioBruto')
    .optional()
    .isFloat({ min: 0 }).withMessage('Salário bruto deve ser um número positivo'),
  body('cargaHoraria')
    .optional()
    .isInt({ min: 0, max: 44 }).withMessage('Carga horária deve estar entre 0 e 44 horas'),
  body('nivelRisco')
    .optional()
    .isIn([1, 2, 3]).withMessage('Nível de risco deve ser 1, 2 ou 3'),
  body('departamento')
    .optional()
    .isString(),
  body('cpf')
    .optional()
    .matches(/^\d{3}\.\d{3}\.\d{3}\-\d{2}$/).withMessage('CPF inválido'),
];
  
export const updateFuncionarioSchema = [
  body('nomeCompleto').optional().isString(),
  body('cargo').optional().isString(),
  body('tipoContrato').optional().isIn(['CLT', 'PJ', 'ESTAGIO', 'FREELANCER']),
  body('salarioBruto').optional().isFloat({ min: 0 }),
  body('cargaHoraria').optional().isInt({ min: 0, max: 44 }),
  body('nivelRisco').optional().isIn([1, 2, 3]),
  body('departamento').optional().isString(),
  body('ativo').optional().isBoolean(),
];