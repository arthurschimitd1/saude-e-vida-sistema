import { resolverPeriodo, somarDias, erroCentral } from "../periodo.js";
import { businessDate } from "../../../utils/businessTime.js";

export const ABC = Object.freeze({ a: 80, b: 95 });
export function filtrosAnalise(q = {}, now = new Date()) {
  const raw = { ...q };
  if (["60-dias", "90-dias"].includes(q.periodo)) {
    raw.periodo = "personalizado";
    raw.fim = businessDate(now);
    raw.inicio = somarDias(raw.fim, -(Number(q.periodo.split("-")[0]) - 1));
  }
  const p = resolverPeriodo(raw, now);
  const integer = (v, fallback, allowed) => {
    if (v === undefined || v === "") return fallback;
    if (!["string", "number"].includes(typeof v))
      throw erroCentral("Filtro numérico inválido.");
    const n = Number(v);
    if (!Number.isSafeInteger(n) || n < 1 || (allowed && !allowed.includes(n)))
      throw erroCentral("Filtro numérico inválido.");
    return n;
  };
  const string = (v, max = 100) => {
    if (v === undefined) return "";
    if (typeof v !== "string" || v.length > max)
      throw erroCentral("Filtro inválido.");
    return v.trim();
  };
  const produto = string(q.produto);
  if (produto && !/^(produto|materia|roupa):[1-9]\d*$/.test(produto))
    throw erroCentral("Produto inválido.");
  const familia = string(q.familia),
    status = string(q.status),
    grupo = string(q.grupo),
    ordem = string(q.ordem) || "valor";
  if (
    familia &&
    !["Produtos", "Matérias-primas", "Variações de roupas"].includes(familia)
  )
    throw erroCentral("Família inválida.");
  if (
    status &&
    !["normal", "baixo", "zero", "infinito", "indisponivel"].includes(status)
  )
    throw erroCentral("Status inválido.");
  if (
    grupo &&
    ![
      "sem-venda",
      "baixa",
      "atencao",
      "vendidos",
      "antes",
      "sem-compra",
    ].includes(grupo)
  )
    throw erroCentral("Grupo inválido.");
  if (!["valor", "quantidade", "menor"].includes(ordem))
    throw erroCentral("Ordenação inválida.");
  const granularidade = string(q.granularidade) || "dia";
  if (!["dia", "semana", "mes"].includes(granularidade))
    throw erroCentral("Granularidade inválida.");
  const pagina = integer(q.pagina, 1),
    tamanho = integer(q.tamanho, 10, [10, 20, 50]);
  if (pagina > 10000) throw erroCentral("Página inválida.");
  return {
    ...p,
    cliente: integer(q.cliente, 0),
    produto,
    familia,
    status,
    grupo,
    ordem,
    granularidade,
    unidade: string(q.unidade),
    busca: string(q.busca),
    diasSem: integer(q.diasSem, 30, [30, 60, 90, 120]),
    pagina,
    tamanho,
    offset: (pagina - 1) * tamanho,
    abcA: ABC.a,
    abcB: ABC.b,
  };
}

