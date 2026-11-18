import test from 'node:test';
import assert from 'node:assert/strict';
import {
    deveNotificarAgendamentoWhatsapp,
    ehDomFerrazSape,
    montarMensagemAgendamentoWhatsapp,
} from '../src/utils/agendamentoWhatsapp.js';

const agendamento = {
    cliente_nome: 'Iago Santos',
    data: '2026-09-10',
    horario: '10:20',
    servico_nome: 'Corte + Barba',
};

test('identifica somente o tenant Dom Ferraz de Sapé', () => {
    assert.equal(ehDomFerrazSape('Dom Ferraz - Sapé'), true);
    assert.equal(ehDomFerrazSape('DOM FERRAZ SAPE'), true);
    assert.equal(ehDomFerrazSape('Dom Ferraz - Manaíra'), false);
    assert.equal(ehDomFerrazSape('Outra empresa de Sapé'), false);
});

test('Sapé sempre notifica mesmo quando a origem desativa o envio', () => {
    assert.equal(deveNotificarAgendamentoWhatsapp('Dom Ferraz - Sapé', false), true);
    assert.equal(deveNotificarAgendamentoWhatsapp('Outra empresa', false), false);
    assert.equal(deveNotificarAgendamentoWhatsapp('Outra empresa', undefined), true);
});

test('mensagem de Sapé informa que o agendamento está confirmado', () => {
    const texto = montarMensagemAgendamentoWhatsapp(agendamento, {
        confirmado: true,
        dataFormatada: 'quinta-feira, 10 de setembro de 2026',
    });

    assert.match(texto, /Olá, Iago!/);
    assert.match(texto, /Seu agendamento está confirmado/);
    assert.match(texto, /Data: quinta-feira, 10 de setembro de 2026/);
    assert.match(texto, /Horário: 10:20/);
    assert.match(texto, /Serviço: Corte \+ Barba/);
    assert.doesNotMatch(texto, /Responda \*SIM\*/);
});

test('mensagem legada das outras empresas permanece inalterada', () => {
    const texto = montarMensagemAgendamentoWhatsapp(agendamento, {
        dataFormatada: 'quinta-feira, 10 de setembro de 2026',
    });

    assert.match(texto, /Você confirma seu agendamento/);
    assert.match(texto, /Responda \*SIM\*/);
});
