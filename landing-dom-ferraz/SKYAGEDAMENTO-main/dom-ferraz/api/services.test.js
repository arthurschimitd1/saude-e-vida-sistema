/* global process, global */
import test from 'node:test'
import assert from 'node:assert/strict'

import { deduplicateServices } from './services.js'

test('remove duplicidades de serviço sem juntar variantes de assinante', () => {
  const services = deduplicateServices([
    { id: '1', name: 'Acabamento/pezinho' },
    { id: '2', name: 'acabamento/pezinho' },
    { id: '3', name: 'Corte' },
    { id: '4', name: 'Corte (assinante)' },
  ])

  assert.deepEqual(services.map((service) => service.id), ['1', '3', '4'])
})

test('catálogo prioriza a consulta pública escopada por unidade', async () => {
  const calls = []
  global.fetch = async (url) => {
    calls.push(String(url))
    assert.match(String(url), /\/public\/agendamentos\/dom-ferraz\/miramar\/servicos$/)
    return {
      ok: true,
      status: 200,
      json: async () => [
        { id: '1', name: 'Barba', duration: 40, price: 45 },
        { id: '2', name: 'barba', duration: 30, price: 50 },
      ],
    }
  }

  const { default: handler } = await import('./services.js')
  let statusCode = 0
  let body = null
  const res = {
    setHeader() {},
    status(value) { statusCode = value; return this },
    json(value) { body = value; return value },
  }

  await handler({ method: 'GET', query: { unitId: 'miramar' } }, res)

  assert.equal(statusCode, 200)
  assert.equal(body.length, 1)
  assert.equal(body[0].id, '1')
  assert.equal(calls.length, 1)
})
