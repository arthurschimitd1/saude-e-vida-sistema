import { businessDate, startOfBusinessDate } from '../../utils/businessTime.js';

export const erroCentral = (message, status = 400) => Object.assign(new Error(message), { status });
export const somarDias = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const validarData = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw erroCentral('Informe datas no formato AAAA-MM-DD.');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw erroCentral('Data inválida.');
  return value;
};

export function resolverPeriodo(query = {}, now = new Date()) {
  if (query.empresa_id !== undefined || query.empresaId !== undefined) throw erroCentral('A empresa deve ser selecionada no contexto autenticado.', 403);
  const hoje = businessDate(now);
  const preset = query.periodo ?? 'mes';
  let inicio = hoje, fim = hoje;
  if (preset === 'ontem') inicio = fim = somarDias(hoje, -1);
  else if (preset === 'semana') inicio = somarDias(hoje, -((new Date(`${hoje}T12:00Z`).getUTCDay() + 6) % 7));
  else if (preset === 'mes') inicio = `${hoje.slice(0, 7)}-01`;
  else if (preset === 'mes-anterior') {
    fim = somarDias(`${hoje.slice(0, 7)}-01`, -1);
    inicio = `${fim.slice(0, 7)}-01`;
  } else if (preset === '30-dias') inicio = somarDias(hoje, -29);
  else if (preset === 'ano') inicio = `${hoje.slice(0, 4)}-01-01`;
  else if (preset === 'personalizado') { inicio = validarData(query.inicio); fim = validarData(query.fim); }
  else if (preset !== 'hoje') throw erroCentral('Período inválido.');
  const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) + 1;
  if (dias < 1 || dias > 366) throw erroCentral('Selecione um intervalo de 1 a 366 dias.');
  if (fim > hoje) throw erroCentral('O período de atividade não pode terminar no futuro. Use carteira completa para vencimentos futuros.');
  const anteriorFim = somarDias(inicio, -1);
  const anteriorInicio = somarDias(inicio, -dias);
  const carteira = query.carteira ?? 'periodo';
  if (!['periodo', 'completa'].includes(carteira)) throw erroCentral('Escopo de recebíveis inválido.');
  return {
    preset, inicio, fim, dias, hoje, anteriorInicio, anteriorFim, carteira,
    inicioInstant: startOfBusinessDate(inicio).toISOString(),
    fimInstant: startOfBusinessDate(somarDias(fim, 1)).toISOString(),
    anteriorInstant: startOfBusinessDate(anteriorInicio).toISOString(),
  };
}

export function resolverPaginacao(query) {
  const pagina = Number(query.pagina ?? 1), tamanho = Number(query.tamanho ?? 20);
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 10000 || ![10, 20, 50].includes(tamanho)) throw erroCentral('Paginação inválida.');
  if (!['vendas', 'recebiveis', 'saidas', 'estoque'].includes(query.tipo)) throw erroCentral('Tipo de detalhe inválido.');
  return { tipo: query.tipo, pagina, tamanho, offset: (pagina - 1) * tamanho };
}

