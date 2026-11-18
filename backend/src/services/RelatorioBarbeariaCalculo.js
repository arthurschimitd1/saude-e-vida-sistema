const dia = (value) =>
  value instanceof Date
    ? value.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    : String(value || "").slice(0, 10);
export const dinheiro = (n) =>
  Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
export function validarPeriodo(query) {
  const { inicio, fim } = query;
  const valido = (s) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s || "") &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (
    !valido(inicio) ||
    !valido(fim) ||
    fim < inicio ||
    (Date.parse(fim) - Date.parse(inicio)) / 86400000 > 365
  )
    throw Object.assign(
      new Error("Escolha um período válido de até 366 dias."),
      { status: 400 }
    );
  for (const key of ["cliente_id", "profissional_id"])
    if (query[key] && !/^\d+$/.test(String(query[key])))
      throw Object.assign(new Error("Filtro inválido."), { status: 400 });
  return { inicio, fim };
}
export function montarRelatorio({
  inicio,
  fim,
  vendas = [],
  itens = [],
  agenda = [],
  colaboradores = [],
  usuarios = [],
  comissoes = [],
  assinaturas = [],
  competencias = [],
  pagamentos = [],
  recorrencias = [],
  produtos = [],
  clientes = [],
  anteriores = [],
  recompras = [],
  historico = [],
  gestor = false,
}) {
  const vendaMap = new Map(vendas.map((v) => [v.id, v]));
  const usuarioMap = new Map(usuarios.map((u) => [u.id, u]));
  const colaboradorMap = new Map(colaboradores.map((c) => [c.id, c]));
  const compMap = new Map(competencias.map((c) => [c.id, c]));
  const clienteMap = new Map(clientes.map((c) => [c.id, c.nome]));
  const recorrenciaMap = new Map(recorrencias.map((r) => [r.id, r]));
  const noPeriodo = (d) => dia(d) >= inicio && dia(d) <= fim;
  const identificacao = (usuarioId, colaboradorId) => {
    const col = colaboradorMap.get(colaboradorId);
    const id = usuarioId || col?.usuario_id;
    return {
      profissional_id: id ? `u:${id}` : `c:${colaboradorId || 0}`,
      profissional:
        usuarioMap.get(id)?.nomeCompleto ||
        col?.usuario_nome ||
        "Sem profissional vinculado",
    };
  };
  const lancamentos = comissoes.map((c) => {
    const v = vendaMap.get(c.venda_id);
    return {
      id: `avulso:${c.id}`,
      ...identificacao(c.funcionario_id),
      data: dia(v?.data || c.createdAt),
      cliente_id: v?.cliente_id,
      cliente: clienteMap.get(v?.cliente_id) || "Não identificado",
      plano: "",
      competencia: "",
      origem: ["venda_servicos", "servico_agendamento"].includes(c.origem)
        ? "Serviços avulsos"
        : c.origem === "venda_produtos"
        ? "Produtos"
        : "Venda geral (legado)",
      descricao: c.descricao || `Venda #${c.venda_id}`,
      valor: dinheiro(c.valor),
      status: c.status === "pago" ? "Pago" : "A receber",
      regra:
        c.origem_calculo === "servico"
          ? "Percentual específico por serviço"
          : c.tipo === "percent"
          ? c.valor_origem == null
            ? "Percentual não informado no histórico"
            : `${c.valor_origem}% sobre a base registrada`
          : "Valor fixo registrado",
    };
  });
  for (const a of assinaturas) {
    const comp = compMap.get(a.competencia_id);
    lancamentos.push({
      id: `plano:${a.id}`,
      ...identificacao(null, a.profissional_id),
      data: dia(a.realizado_em),
      cliente_id: a.cliente_id,
      cliente: a.cliente_nome,
      plano: a.plano_nome,
      competencia: comp?.competencia || "",
      origem: "Planos",
      descricao: a.servico_nome,
      valor: dinheiro(a.comissao),
      status:
        comp?.status === "PAGA"
          ? "Pago"
          : comp?.status === "FECHADA"
          ? "A receber"
          : "Provisório",
      regra: `Pote mensal · ${a.minutos} min · peso ${Number(a.peso)} · ${
        a.faixa || "faixa não calculada"
      }`,
    });
  }
  const resumoComissoes = (rows) => ({
    planos: dinheiro(
      rows.filter((r) => r.origem === "Planos").reduce((s, r) => s + r.valor, 0)
    ),
    avulsos: dinheiro(
      rows
        .filter((r) => r.origem === "Serviços avulsos")
        .reduce((s, r) => s + r.valor, 0)
    ),
    produtos: dinheiro(
      rows
        .filter((r) => r.origem === "Produtos")
        .reduce((s, r) => s + r.valor, 0)
    ),
    legado: dinheiro(
      rows
        .filter((r) => r.origem === "Venda geral (legado)")
        .reduce((s, r) => s + r.valor, 0)
    ),
    total: dinheiro(rows.reduce((s, r) => s + r.valor, 0)),
    receber: dinheiro(
      rows
        .filter((r) => r.status === "A receber")
        .reduce((s, r) => s + r.valor, 0)
    ),
    pago: dinheiro(
      rows.filter((r) => r.status === "Pago").reduce((s, r) => s + r.valor, 0)
    ),
    provisorio: dinheiro(
      rows
        .filter((r) => r.status === "Provisório")
        .reduce((s, r) => s + r.valor, 0)
    ),
  });
  const atuais = vendas.filter((v) => noPeriodo(v.data));
  const atuaisMap = new Map(atuais.map((v) => [v.id, v]));
  const concluidos = agenda.filter(
    (a) => a.status === "finalizado" && noPeriodo(a.data)
  );
  const atendidos = new Set(
    concluidos.map((a) => a.cliente_id).filter(Boolean)
  );
  const antigos = new Set(anteriores.map((a) => a.cliente_id));
  const periodoAnterior = new Set(
    anteriores.filter((a) => a.periodo_anterior).map((a) => a.cliente_id)
  );
  const frequencia = new Map();
  for (const a of concluidos)
    if (a.cliente_id) {
      const datas = frequencia.get(a.cliente_id) || new Set();
      datas.add(dia(a.data));
      frequencia.set(a.cliente_id, datas);
    }
  const novos = [...atendidos].filter((id) => !antigos.has(id));
  const retorno = [...atendidos].filter(
    (id) => (frequencia.get(id)?.size || 0) > 1
  ).length;
  const novosRetorno = novos.filter(
    (id) => (frequencia.get(id)?.size || 0) > 1
  ).length;
  const pct = (n, d) => (d ? dinheiro((n / d) * 100) : null);
  const equipe = new Map();
  const profissional = (info) => {
    if (!equipe.has(info.profissional_id))
      equipe.set(info.profissional_id, {
        ...info,
        faturamento: 0,
        servicos: 0,
        minutos: 0,
        produtos_quantidade: 0,
        produtos_valor: 0,
        vendas: 0,
        clientes: new Set(),
      });
    return equipe.get(info.profissional_id);
  };
  for (const c of colaboradores)
    profissional(identificacao(c.usuario_id, c.id));
  for (const v of atuais) {
    const e = profissional(identificacao(v.funcionario_id));
    e.faturamento += Number(v.valor_total);
    e.vendas++;
  }
  for (const a of concluidos) {
    const e = profissional(identificacao(null, a.colaborador_id));
    e.servicos +=
      Array.isArray(a.servicos) && a.servicos.length ? a.servicos.length : 1;
    e.minutos += Number(a.servico_duracao_min || 0);
    if (a.cliente_id) e.clientes.add(a.cliente_id);
  }
  const vendidos = new Map();
  let receitaProdutos = 0,
    receitaServicos = 0;
  const compradores = new Set();
  const totaisItens = new Map();
  for (const i of itens)
    totaisItens.set(
      i.venda_id,
      (totaisItens.get(i.venda_id) || 0) + Number(i.valor_total)
    );
  for (const i of itens) {
    const v = atuaisMap.get(i.venda_id);
    if (!v) continue;
    const soma = totaisItens.get(v.id) || 0;
    // O total líquido da venda já contém descontos; distribui proporcionalmente sem somar novamente a comanda.
    const liquido = soma
      ? (Number(i.valor_total) / soma) *
        (Number(v.valor_total) - Number(v.taxa_entrega || 0))
      : 0;
    if (i.tipo === "servico") {
      receitaServicos += liquido;
      continue;
    }
    receitaProdutos += liquido;
    const e = profissional(identificacao(v.funcionario_id));
    e.produtos_quantidade += Number(i.quantidade);
    e.produtos_valor += liquido;
    if (v.cliente_id) compradores.add(v.cliente_id);
    const key = `${i.produto_id || i.nome_item || i.id}`;
    const p = vendidos.get(key) || {
      profissional_id: e.profissional_id,
      profissional: e.profissional,
      produto:
        i.nome_item ||
        produtos.find((p) => p.id === i.produto_id)?.name ||
        "Produto",
      quantidade: 0,
      faturamento: 0,
    };
    if (p.profissional_id !== e.profissional_id)
      p.profissional = "Vários barbeiros";
    p.quantidade += Number(i.quantidade);
    p.faturamento += liquido;
    vendidos.set(key, p);
  }
  const receitaPlanos = pagamentos
    .filter(
      (p) =>
        noPeriodo(p.dataPagamento) &&
        recorrenciaMap.get(p.recorrencia_id)?.tipoTransacao === "ENTRADA"
    )
    .reduce((s, p) => s + Number(p.valor), 0);
  const receitaVendas = atuais.reduce((s, v) => s + Number(v.valor_total), 0);
  const recompraIds = new Set(recompras.map((r) => r.cliente_id));
  const equipes = [...equipe.values()]
    .map((e) => ({
      ...e,
      clientes: e.clientes.size,
      faturamento: dinheiro(e.faturamento),
      produtos_valor: dinheiro(e.produtos_valor),
      ticket_medio: e.vendas ? dinheiro(e.faturamento / e.vendas) : null,
      comissoes: resumoComissoes(
        lancamentos.filter((l) => l.profissional_id === e.profissional_id)
      ),
    }))
    .sort((a, b) => b.faturamento - a.faturamento);
  return {
    inicio,
    fim,
    gestor,
    lancamentos: lancamentos.sort((a, b) => b.data.localeCompare(a.data)),
    comissoes: resumoComissoes(lancamentos),
    equipe: equipes,
    resultados: {
      faturamento: dinheiro(receitaVendas + receitaPlanos),
      vendas: dinheiro(receitaVendas),
      assinaturas: dinheiro(receitaPlanos),
      servicos: dinheiro(receitaServicos),
      produtos: dinheiro(receitaProdutos),
      ticket_medio: atuais.length
        ? dinheiro(receitaVendas / atuais.length)
        : null,
      atendimentos: concluidos.length,
      minutos: concluidos.reduce(
        (s, a) => s + Number(a.servico_duracao_min || 0),
        0
      ),
    },
    clientes: {
      atendidos: atendidos.size,
      novos: novos.length,
      recorrentes: atendidos.size - novos.length,
      retorno: pct(retorno, atendidos.size),
      retencao_novos: pct(novosRetorno, novos.length),
      retencao: pct(
        [...atendidos].filter((id) => periodoAnterior.has(id)).length,
        periodoAnterior.size
      ),
      sem_identificacao: concluidos.filter((a) => !a.cliente_id).length,
    },
    produtos: {
      faturamento: dinheiro(receitaProdutos),
      conversao: pct(
        [...compradores].filter((id) => atendidos.has(id)).length,
        atendidos.size
      ),
      recompra: pct(
        [...compradores].filter((id) => recompraIds.has(id)).length,
        compradores.size
      ),
      vendidos: [...vendidos.values()]
        .map((p) => ({ ...p, faturamento: dinheiro(p.faturamento) }))
        .sort((a, b) => b.quantidade - a.quantidade),
      estoque: gestor
        ? produtos.map((p) => ({
            id: p.id,
            produto: p.name,
            quantidade: Number(p.currentQuantity),
            minimo: Number(p.minQuantity),
          }))
        : [],
    },
    historico,
  };
}
