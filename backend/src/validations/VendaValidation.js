import { body } from 'express-validator';

export const createVendaSchema = [
    body('forma_pagamento')
        .notEmpty().withMessage('forma_pagamento é obrigatório')
        .isString(),

    body('valor_total')
        .notEmpty().withMessage('valor_total é obrigatório')
        .isDecimal().withMessage('valor_total deve ser número'),

    body('itens')
        .isArray({ min: 1 }).withMessage('Pelo menos 1 item é obrigatório'),

    body('itens.*').custom((item) => {
        const tipo = item?.tipo ?? 'produto';
        if (tipo === 'servico') {
            const origemCaixa = String(item.origem_servico ?? item.origemServico ?? '').toLowerCase() === 'caixa';
            const agendaCompleta = Number(item.agendamento_id ?? item.agendamentoId) > 0
                && Boolean(item.agendamento_servico_id ?? item.servico_id ?? item.servicoId);
            const catalogoAgendaValido = Boolean(
                item.agendamento_servico_catalogo_id ?? item.agendamentoServicoCatalogoId
            );
            const catalogoValido = Number(item.catalogo_servico_id ?? item.catalogoServicoId) > 0;
            if (!origemCaixa && !agendaCompleta && !catalogoAgendaValido && !catalogoValido) {
                throw new Error('Serviço deve possuir uma origem válida');
            }
            if (!Number.isFinite(Number(item.valor_unitario)) || Number(item.valor_unitario) < 0) {
                throw new Error('Valor do serviço inválido');
            }
            return true;
        }
        if (tipo === 'roupa' && Number(item.variacao_id) > 0) return true;
        if (tipo === 'materia_prima' && Number(item.raw_material_id) > 0) return true;
        if (Number(item.produto_id) > 0) return true;
        throw new Error('Identificador do item é obrigatório');
    }),

    body('itens.*.quantidade')
        .notEmpty().withMessage('quantidade obrigatória em cada item')
        .isFloat({ min: 0.001 }).withMessage('quantidade deve ser maior que zero')
];
