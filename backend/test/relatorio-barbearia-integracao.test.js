import test from "node:test";
import assert from "node:assert/strict";
const habilitado = process.env.RELATORIOS_TEST_DB === "1";
test(
  "relatórios e metas no PostgreSQL descartável",
  { skip: !habilitado },
  async (t) => {
    assert.equal(process.env.DB_HOST, "127.0.0.1");
    assert.equal(process.env.DB_NAME, "relatorios_test");
    assert.ok(!process.env.DATABASE_URL);
    const { default: db } = await import("../src/config/database.js");
    db.config.port = db.options.port = db.connectionManager.config.port = 55439;
    const { relatorioBarbearia } = await import(
      "../src/services/RelatorioBarbeariaService.js"
    );
    const { salvarMetas } = await import(
      "../src/services/RelatorioBarbeariaMetas.js"
    );
    const { default: Empresa } = await import("../src/models/Empresa.js");
    try {
      await db.query("DROP SCHEMA public CASCADE");
      await db.query("CREATE SCHEMA public");
      for (const m of Object.values(db.models)) {
        for (const a of Object.values(m.rawAttributes)) delete a.references;
        m.refreshAttributes();
        await m.sync({ force: true });
      }
      const seed = async (nome, values) => {
        const m = db.models[nome],
          data = {};
        for (const [key, a] of Object.entries(m.rawAttributes)) {
          if (
            a.allowNull === false &&
            !a.autoIncrement &&
            a.defaultValue === undefined &&
            !(key in values)
          ) {
            const type = a.type.key;
            data[key] =
              type === "ENUM"
                ? a.values?.[0] || a.type.values[0]
                : type === "DATE"
                ? new Date("2026-09-01T12:00:00Z")
                : type === "DATEONLY"
                ? "2026-09-01"
                : ["INTEGER", "DECIMAL", "FLOAT", "DOUBLE"].includes(type)
                ? 1
                : type === "BOOLEAN"
                ? true
                : type === "JSONB"
                ? {}
                : "Teste";
          }
        }
        return m.create(
          { ...data, ...values },
          { validate: false, hooks: false }
        );
      };
      await seed("Empresa", {
        id: 1,
        nome: "Unidade A",
        configuracoes: { fiscal: { preservar: true } },
      });
      await seed("Empresa", { id: 2, nome: "Unidade B" });
      await seed("User", {
        id: 10,
        empresa_id: 1,
        nomeCompleto: "Barbeiro A",
        email: "a@teste.local",
        cpf: "11111111111",
      });
      await seed("User", {
        id: 11,
        empresa_id: 1,
        nomeCompleto: "Barbeiro B",
        email: "b@teste.local",
        cpf: "22222222222",
      });
      await seed("User", {
        id: 20,
        empresa_id: 2,
        nomeCompleto: "Outra empresa",
        email: "c@teste.local",
        cpf: "33333333333",
      });
      await seed("Cliente", {
        id: 1,
        empresa_id: 1,
        nomeCompleto: "Cliente A",
      });
      await seed("Cliente", {
        id: 2,
        empresa_id: 2,
        nomeCompleto: "Cliente B",
      });
      await seed("AgendamentoColaborador", {
        id: 100,
        empresa_id: 1,
        usuario_id: 10,
        usuario_nome: "Barbeiro A",
      });
      await seed("AgendamentoColaborador", {
        id: 101,
        empresa_id: 1,
        usuario_id: 11,
        usuario_nome: "Barbeiro B",
      });
      await seed("Venda", {
        id: 1,
        empresa_id: 1,
        cliente_id: 1,
        funcionario_id: 10,
        data: "2026-09-02T12:00:00Z",
        valor_total: 90,
      });
      await seed("Venda", {
        id: 2,
        empresa_id: 1,
        cliente_id: 1,
        funcionario_id: 11,
        data: "2026-09-02T12:00:00Z",
        valor_total: 40,
      });
      await seed("Venda", {
        id: 3,
        empresa_id: 2,
        cliente_id: 2,
        funcionario_id: 20,
        data: "2026-09-02T12:00:00Z",
        valor_total: 999,
      });
      await seed("VendaItem", {
        venda_id: 1,
        tipo: "servico",
        nome_item: "Barba",
        quantidade: 1,
        valor_unitario: 60,
        valor_total: 60,
      });
      await seed("VendaItem", {
        venda_id: 1,
        tipo: "produto",
        nome_item: "Pomada",
        quantidade: 1,
        valor_unitario: 40,
        valor_total: 40,
      });
      await seed("Comissao", {
        empresa_id: 1,
        venda_id: 1,
        funcionario_id: 10,
        valor: 9,
        tipo: "percent",
        origem: "venda_servicos",
      });
      await seed("Comissao", {
        empresa_id: 1,
        venda_id: 2,
        funcionario_id: 11,
        valor: 4,
        tipo: "percent",
        origem: "venda_produtos",
      });
      await seed("Agendamento", {
        id: 1,
        empresa_id: 1,
        cliente_id: 1,
        colaborador_id: 100,
        cliente_nome: "Cliente A",
        servico_nome: "Barba",
        servico_duracao_min: 40,
        status: "finalizado",
        data: "2026-09-02",
        horario: "10:00",
      });
      await seed("ComissaoAssinaturaCompetencia", {
        id: 1,
        empresa_id: 1,
        competencia: "2026-09",
        status: "FECHADA",
      });
      await seed("ComissaoAssinaturaItem", {
        id: 1,
        empresa_id: 1,
        competencia_id: 1,
        atendimento_id: 1,
        recorrencia_id: 1,
        cliente_id: 1,
        cliente_nome: "Cliente A",
        plano_nome: "4 barbas",
        servico_nome: "Barba",
        profissional_id: 100,
        profissional_nome: "Barbeiro A",
        realizado_em: "2026-09-02T13:00:00Z",
        minutos: 40,
        comissao: 25,
      });
      const gestor = { id: 1, tipo: "EMPRESA", empresa_id: 1 };
      const periodo = { inicio: "2026-09-01", fim: "2026-09-30" };
      await t.test(
        "lê nomes reais, soma separadamente e não vaza outra empresa",
        async () => {
          const r = await relatorioBarbearia(periodo, gestor);
          assert.equal(r.resultados.vendas, 130);
          assert.equal(r.comissoes.total, 38);
          assert.equal(r.comissoes.planos, 25);
          assert.equal(r.lancamentos[0].cliente, "Cliente A");
          assert.ok(!JSON.stringify(r).includes("Outra empresa"));
        }
      );
      await t.test(
        "barbeiro só enxerga a si mesmo mesmo forçando outro id",
        async () => {
          const r = await relatorioBarbearia(
            { ...periodo, profissional_id: "11" },
            { id: 10, tipo: "FUNCIONARIO", empresa_id: 1 }
          );
          assert.equal(r.resultados.vendas, 90);
          assert.equal(r.comissoes.total, 34);
          assert.ok(r.lancamentos.every((l) => l.profissional_id === "u:10"));
          assert.deepEqual(r.produtos.estoque, []);
          assert.equal(r.equipe.length, 1);
        }
      );
      await t.test(
        "filtro de cliente alheio retorna vazio e não muda comissão",
        async () => {
          const r = await relatorioBarbearia(
            { ...periodo, cliente_id: "2" },
            gestor
          );
          assert.equal(r.comissoes.total, 0);
          assert.equal(await db.models.Comissao.count(), 2);
        }
      );
      await t.test(
        "metas persistem sem alterar configuração fiscal ou comissões",
        async () => {
          await salvarMetas(
            {
              mes: "2026-09",
              meta: 1000,
              custos_fixos: 500,
              margem_contribuicao: 50,
              profissionais: { 10: { meta: 100, horas_disponiveis: 100 } },
            },
            gestor
          );
          const e = await Empresa.findByPk(1);
          assert.deepEqual(e.configuracoes.fiscal, { preservar: true });
          const r = await relatorioBarbearia(periodo, gestor);
          assert.equal(r.metas.meta, 1000);
          assert.equal(
            r.equipe.find((e) => e.profissional_id === "u:10").meta_atingida,
            90
          );
          assert.equal(r.comissoes.total, 38);
          await assert.rejects(
            () =>
              salvarMetas(
                { mes: "2026-09", meta: 1 },
                { id: 10, tipo: "FUNCIONARIO", empresa_id: 1 }
              ),
            /Sem permissão/
          );
        }
      );
      await t.test(
        "sem empresa não consulta e período inválido não executa",
        async () => {
          await assert.rejects(
            () => relatorioBarbearia(periodo, { tipo: "MASTER" }),
            /Selecione/
          );
          await assert.rejects(
            () => relatorioBarbearia({ ...periodo, fim: "2026-02-30" }, gestor),
            /período/
          );
        }
      );
    } finally {
      await db.close();
    }
  }
);
