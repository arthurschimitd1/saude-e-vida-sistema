import { resolverPeriodo, resolverPaginacao, somarDias } from './periodo.js';

export class CentralGestaoService {
  constructor(repository, clock = () => new Date()) { this.repository = repository; this.clock = clock; }

  async visaoGeral(context, filters) {
    const now = this.clock();
    const periodo = resolverPeriodo(filters, now);
    const dados = await this.repository.visaoGeral(context, periodo);
    // Somente após uma consulta bem-sucedida: um dia sem venda é zero real.
    const dias = new Map(dados.vendas.serie.map(row => [String(row.dia).slice(0, 10), row]));
    dados.vendas.serie = Array.from({ length: periodo.dias }, (_, index) => {
      const dia = somarDias(periodo.inicio, index);
      return dias.get(dia) ?? { dia, valor: '0', quantidade: 0 };
    });
    // Inconsistência de valor invalida totais, em vez de publicar subtotal como total.
    if (Number(dados.recebiveis.invalidos)>0) {
      for (const key of ['total','vencidos','venceHoje','aVencer','inadimplencia']) dados.recebiveis[key] = null;
      dados.recebiveis.aging = [];
    } else {
      const faixas = new Map(dados.recebiveis.aging.map(row => [row.faixa, row]));
      dados.recebiveis.aging = ['Vencidos','0–30 dias','31–60 dias','61–90 dias','+90 dias'].map(faixa =>
        faixas.get(faixa) ?? { faixa, valor: '0', quantidade: 0, percentual: Number(dados.recebiveis.total)>0 ? '0' : null });
    }
    if (Number(dados.saidas.invalidos)>0) {
      dados.saidas.total = null;
      dados.saidas.composicao = []; dados.saidas.maiores = []; dados.saidas.centros = []; dados.saidas.estados = [];
    }
    if (Number(dados.produtos.valoresIndisponiveis)>0) dados.produtos.porValor = [];
    const alertas = [];
    if (!Number(dados.recebiveis.invalidos) && dados.recebiveis.quantidadeVencidos>0) alertas.push({ tipo: 'atencao', titulo: 'Títulos vencidos', texto: `${dados.recebiveis.quantidadeVencidos} título(s) em aberto no recorte de vencimentos.` });
    if (dados.recebiveis.proximos>0) alertas.push({ tipo: 'info', titulo: 'Vencimentos próximos', texto: `${dados.recebiveis.proximos} título(s) vencem de hoje até os próximos 7 dias, dentro do recorte selecionado.` });
    if (dados.estoque.baixos>0) alertas.push({ tipo: 'atencao', titulo: 'Estoque baixo', texto: `${dados.estoque.baixos} SKU(s) abaixo do mínimo cadastrado na posição atual.` });
    if (dados.vendas.variacao !== null && Number(dados.vendas.variacao)<0) alertas.push({ tipo: 'atencao', titulo: 'Queda de vendas', texto: 'Vendas registradas abaixo do período anterior equivalente.' });
    return { empresaId: context.empresaId, atualizadoEm: now.toISOString(), periodo, ...dados, alertas };
  }

  async detalhes(context, filters) {
    const periodo = resolverPeriodo(filters, this.clock());
    return { empresaId: context.empresaId, ...await this.repository.detalhes(context, periodo, resolverPaginacao(filters)) };
  }
}

