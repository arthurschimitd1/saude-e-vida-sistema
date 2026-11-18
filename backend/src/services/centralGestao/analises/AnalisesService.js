import { CentralGestaoRepository } from "../CentralGestaoRepository.js";
import { filtrosAnalise } from "./filters.js";
import {
  COMERCIAL,
  ESTOQUE,
  OPTIONS,
  PRODUTO_SERIE,
  detalheSQL,
} from "./queries.js";
import { erroCentral } from "../periodo.js";
import { estoqueBase } from "../queries.js";

export class AnalisesService {
  constructor(database, clock = () => new Date()) {
    this.repository = new CentralGestaoRepository(database);
    this.clock = clock;
  }
  async consultar(context, view, operation, query) {
    const started = Date.now(),
      now = this.clock(),
      filters = filtrosAnalise(query, now);
    if (view === "estoque" && filters.cliente)
      throw erroCentral("Cliente não é filtro de estoque.");
    if (operation === "clientes" && view !== "comercial")
      throw erroCentral("Consulta inválida.");
    if (operation === "serie-produto" && !filters.produto)
      throw erroCentral("Selecione um produto.");
    const sql =
      operation === "resumo"
        ? view === "comercial"
          ? COMERCIAL
          : ESTOQUE
        : operation === "opcoes"
        ? OPTIONS
        : operation === "serie-produto"
        ? PRODUTO_SERIE
        : ["clientes", "produtos"].includes(operation)
        ? detalheSQL(operation)
        : null;
    if (!sql) throw erroCentral("Consulta inválida.");
    return this.repository.ler(context, filters, async (execute) => {
      // Identificadores arbitrários, inexistentes ou de outra empresa não viram filtros silenciosos.
      const valid =
        await execute(`SELECT json_build_object('cliente',:cliente =0 OR EXISTS(SELECT 1 FROM clientes WHERE id=:cliente AND empresa_id=:empresaId),
        'produto',:produto ='' OR EXISTS(SELECT 1 FROM (${estoqueBase})s WHERE s.chave=:produto)) dados`);
      if (!valid.cliente || !valid.produto)
        throw erroCentral("Filtro não disponível para esta empresa.", 403);
      const data = await execute(sql);
      return {
        ...data,
        empresaId: context.empresaId,
        periodo: filters,
        pagina: filters.pagina,
        tamanho: filters.tamanho,
        atualizadoEm: now.toISOString(),
        duracaoMs: Date.now() - started,
      };
    });
  }
}

