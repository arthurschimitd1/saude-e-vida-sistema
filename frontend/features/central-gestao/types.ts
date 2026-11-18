export type Decimal = string | null;
export type Linha = { id?: string | number; posicao?: number; chave?: string; nome: string; valor?: Decimal; quantidade?: string | number | null; percentual?: Decimal; unidade?: string; familia?: string; status?: string; classificacao?: string };
export type Filtros = { periodo: string; inicio?: string; fim?: string; carteira: 'periodo' | 'completa' };
export type Contexto = { habilitado: boolean; autorizado: boolean; empresaId: number };
export type Visao = {
  empresaId: number; atualizadoEm: string;
  periodo: { inicio: string; fim: string; anteriorInicio: string; anteriorFim: string; hoje: string; dias: number; carteira: string };
  vendas: { total: Decimal; anterior: Decimal; quantidade: number; quantidadeAnterior: number; ticket: Decimal; variacao: Decimal; invalidos: number; serie: { dia: string; valor: Decimal; quantidade: number }[] };
  recebiveis: { total: Decimal; quantidade: number; vencidos: Decimal; quantidadeVencidos: number; venceHoje: Decimal; aVencer: Decimal; inadimplencia: Decimal; invalidos: number; proximos: number; aging: { faixa: string; valor: Decimal; quantidade: number; percentual: Decimal }[] };
  saidas: { total: Decimal; quantidade: number; invalidos: number; naoClassificados: number; categoriasOmitidas: number; centrosOmitidos: number; composicao: Linha[]; centros: Linha[]; maiores: Linha[]; estados: Linha[] };
  clientes: { comCompras: number; novos: number; semCliente: number; vinculoInvalido: number; valorSemCliente: Decimal; novasRecorrencias: number; ranking: Linha[] };
  produtos: { porValor: Linha[]; porQuantidade: Linha[]; menosVendidos: Linha[]; valoresIndisponiveis: number; itensSemCatalogo: number };
  estoque: { skus: number; infinitos: number; baixos: number; zerados: number; invalidos: number; grupos: { familia: string; unidade: string; skus: number; quantidade: Decimal; infinitos: number; baixos: number; zerados: number }[] };
  alertas: { tipo: string; titulo: string; texto: string }[];
};
export type TipoDetalhe = 'vendas' | 'recebiveis' | 'saidas' | 'estoque';
export type Detalhes = { empresaId: number; total: number; pagina: number; tamanho: number; itens: { id: string; data: string | null; descricao: string; valor: Decimal; classificacao: string; status: string }[] };

