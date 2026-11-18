import test from "node:test";
import assert from "node:assert/strict";
import {
  montarRelatorio,
  validarPeriodo,
} from "../src/services/RelatorioBarbeariaCalculo.js";
const base = { inicio: "2026-09-01", fim: "2026-09-30", gestor: true };
test("período rejeita datas inexistentes, invertidas e filtros inválidos", () => {
  for (const q of [
    { inicio: "2026-02-30", fim: "2026-03-01" },
    { inicio: "2026-09-02", fim: "2026-09-01" },
    { inicio: "2024-01-01", fim: "2026-01-01" },
    { ...base, cliente_id: "1 OR 1=1" },
  ])
    assert.throws(() => validarPeriodo(q));
  assert.deepEqual(validarPeriodo(base), {
    inicio: base.inicio,
    fim: base.fim,
  });
});
test("une usuário e colaborador sem misturar pago, provisório e a receber", () => {
  const r = montarRelatorio({
    ...base,
    usuarios: [{ id: 7, nomeCompleto: "Ana" }],
    colaboradores: [{ id: 90, usuario_id: 7, usuario_nome: "Ana" }],
    vendas: [
      { id: 1, funcionario_id: 7, valor_total: 100, data: "2026-09-02" },
    ],
    comissoes: [
      {
        id: 1,
        venda_id: 1,
        funcionario_id: 7,
        valor: 10,
        origem: "venda_servicos",
        status: "pendente",
      },
      {
        id: 2,
        venda_id: 1,
        funcionario_id: 7,
        valor: 5,
        origem: "venda_produtos",
        status: "pago",
      },
    ],
    competencias: [{ id: 1, status: "EM_ANDAMENTO", competencia: "2026-09" }],
    assinaturas: [
      {
        id: 1,
        competencia_id: 1,
        profissional_id: 90,
        realizado_em: "2026-09-03",
        comissao: 20,
        minutos: 30,
        peso: 1,
      },
    ],
  });
  assert.equal(r.equipe.length, 1);
  assert.equal(r.comissoes.total, 35);
  assert.equal(r.comissoes.receber, 10);
  assert.equal(r.comissoes.pago, 5);
  assert.equal(r.comissoes.provisorio, 20);
  assert.equal(r.equipe[0].comissoes.total, 35);
});
test("mensalidade recebida é somada uma vez e comissão não vira faturamento", () => {
  const r = montarRelatorio({
    ...base,
    vendas: [{ id: 1, valor_total: 90, taxa_entrega: 0, data: "2026-09-01" }],
    itens: [
      { id: 1, venda_id: 1, tipo: "servico", valor_total: 60 },
      { id: 2, venda_id: 1, tipo: "produto", valor_total: 40, quantidade: 1 },
    ],
    recorrencias: [
      { id: 1, tipoTransacao: "ENTRADA" },
      { id: 2, tipoTransacao: "SAIDA" },
    ],
    pagamentos: [
      { recorrencia_id: 1, valor: 100, dataPagamento: "2026-09-03" },
      { recorrencia_id: 2, valor: 999, dataPagamento: "2026-09-03" },
    ],
    assinaturas: [
      {
        id: 1,
        comissao: 50,
        valor_assinatura: 100,
        realizado_em: "2026-09-03",
      },
    ],
  });
  assert.equal(r.resultados.faturamento, 190);
  assert.equal(r.resultados.servicos, 54);
  assert.equal(r.resultados.produtos, 36);
});
test("retenção compara período anterior e retorno exige dias diferentes", () => {
  const r = montarRelatorio({
    ...base,
    anteriores: [
      { cliente_id: 1, periodo_anterior: true },
      { cliente_id: 2, periodo_anterior: true },
      { cliente_id: 3, periodo_anterior: false },
    ],
    agenda: [
      { cliente_id: 1, data: "2026-09-01", status: "finalizado" },
      { cliente_id: 4, data: "2026-09-01", status: "finalizado" },
      { cliente_id: 4, data: "2026-09-01", status: "finalizado" },
      { cliente_id: 5, data: "2026-09-01", status: "cancelado" },
    ],
  });
  assert.equal(r.clientes.atendidos, 2);
  assert.equal(r.clientes.novos, 1);
  assert.equal(r.clientes.retencao, 50);
  assert.equal(r.clientes.retorno, 0);
  assert.equal(r.clientes.retencao_novos, 0);
});
test("sem denominador não inventa taxas e legado não é atribuído a serviço", () => {
  const r = montarRelatorio({
    ...base,
    comissoes: [
      {
        id: 1,
        valor: 4,
        origem: "venda",
        status: "pendente",
        createdAt: "2026-09-01",
      },
    ],
  });
  assert.equal(r.clientes.retencao, null);
  assert.equal(r.produtos.conversao, null);
  assert.equal(r.comissoes.legado, 4);
  assert.equal(r.comissoes.avulsos, 0);
});
