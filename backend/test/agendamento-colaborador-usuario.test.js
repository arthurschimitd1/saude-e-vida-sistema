import assert from 'node:assert/strict';
import test from 'node:test';

import agendamentoService from '../src/services/AgendamentoService.js';
import AgendamentoColaborador from '../src/models/AgendamentoColaborador.js';
import User from '../src/models/UserModel.js';

test('vincula profissional somente a usuário real da mesma empresa', async () => {
    const originais = {
        colaborador: AgendamentoColaborador.findOne,
        usuario: User.findOne,
    };
    let updateRecebido;
    const colaborador = {
        id: 46,
        empresa_id: 59,
        usuario_id: null,
        usuario_nome: 'Gabriel Soares',
        async update(data) {
            updateRecebido = data;
            Object.assign(this, data);
        },
        toJSON() { return { ...this }; },
    };
    AgendamentoColaborador.findOne = async ({ where }) => (
        where.id === 46 ? colaborador : null
    );
    User.findOne = async ({ where }) => {
        assert.equal(where.id, 301);
        assert.equal(where.empresa_id, 59);
        return { id: 301 };
    };

    try {
        const resultado = await agendamentoService.atualizarColaborador(
            46,
            { usuarioId: 301 },
            { tipo: 'MASTER', empresa_id_override: 59 },
        );
        assert.deepEqual(updateRecebido, { usuario_id: 301 });
        assert.equal(resultado.usuarioId, 301);
    } finally {
        AgendamentoColaborador.findOne = originais.colaborador;
        User.findOne = originais.usuario;
    }
});

test('rejeita vínculo com usuário ausente ou de outra empresa', async () => {
    const originais = {
        colaborador: AgendamentoColaborador.findOne,
        usuario: User.findOne,
    };
    AgendamentoColaborador.findOne = async ({ where }) => (
        where.id === 48
            ? { id: 48, empresa_id: 59, async update() {}, toJSON() { return { ...this }; } }
            : null
    );
    User.findOne = async () => null;

    try {
        await assert.rejects(
            agendamentoService.atualizarColaborador(
                48,
                { usuario_id: 999 },
                { tipo: 'MASTER', empresa_id_override: 59 },
            ),
            /Usuário não encontrado nesta empresa/,
        );
    } finally {
        AgendamentoColaborador.findOne = originais.colaborador;
        User.findOne = originais.usuario;
    }
});
