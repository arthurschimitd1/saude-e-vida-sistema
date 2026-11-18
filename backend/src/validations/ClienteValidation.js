import { body } from 'express-validator';

export const createClienteSchema = [
  body('nomeCompleto')
    .notEmpty().withMessage('Nome completo é obrigatório')
    .isString().withMessage('Nome completo deve ser uma string'),

  body('cpf')
    .optional({ nullable: true })
    .matches(/^\d{3}\.\d{3}\.\d{3}\-\d{2}$/).withMessage('CPF deve estar no formato 000.000.000-00'),

  body('cnpj')
    .optional({ nullable: true })
    .matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$/).withMessage('CNPJ deve estar no formato 00.000.000/0000-00'),

  body('telefone')
    .notEmpty().withMessage('Telefone é obrigatório')
    .isString().withMessage('Telefone deve ser uma string'),

  body('email')
    .optional({ nullable: true })
    .isEmail().withMessage('Email inválido'),

  body('cep')
    .optional({ nullable: true })
    .matches(/^\d{5}-\d{3}$/).withMessage('CEP deve estar no formato 00000-000'),

  body('rua').optional({ nullable: true }).isString(),
  body('bairro').optional({ nullable: true }).isString(),
  body('cidade').optional({ nullable: true }).isString(),
  body('estado')
    .optional({ nullable: true })
    .isString()
    .isLength({ min: 2, max: 2 }).withMessage('Estado deve ter 2 caracteres'),
  body('pais').optional({ nullable: true }),
  body('numero').optional({ nullable: true }).isString(),
  body('pontoReferencia').optional({ nullable: true }).isString(),
  body('complemento').optional({ nullable: true }).isString(),
  body('inscricao_estadual')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 20 }).withMessage('Inscrição Estadual deve ter no máximo 20 caracteres'),
  body('data_nascimento')
    .optional({ nullable: true })
    .isDate().withMessage('Data de nascimento inválida')
];

export const updateClienteSchema = [
  body('nomeCompleto').optional({ nullable: true }).isString(),
  body('cpf').optional({ nullable: true }).matches(/^\d{3}\.\d{3}\.\d{3}\-\d{2}$/),
  body('cnpj').optional({ nullable: true }).matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$/),
  body('telefone').optional({ nullable: true }).isString(),
  body('email').optional({ nullable: true }).isEmail(),
  body('cep').optional({ nullable: true }).matches(/^\d{5}-\d{3}$/),
  body('rua').optional({ nullable: true }).isString(),
  body('bairro').optional({ nullable: true }).isString(),
  body('cidade').optional({ nullable: true }).isString(),
  body('estado').optional({ nullable: true }).isString().isLength({ min: 2, max: 2 }),
  body('pais').optional({ nullable: true }),
  body('numero').optional({ nullable: true }).isString(),
  body('pontoReferencia').optional({ nullable: true }).isString(),
  body('complemento').optional({ nullable: true }).isString(),
  body('inscricao_estadual').optional({ nullable: true }).isString().isLength({ max: 20 }),
  body('data_nascimento').optional({ nullable: true }).isDate().withMessage('Data de nascimento inválida')
];