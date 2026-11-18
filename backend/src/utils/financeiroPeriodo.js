import { startOfBusinessDate } from './businessTime.js';

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

const proximoDiaUtc = (data) => {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10);
};

export function normalizarPeriodo(dataInicio, dataFim) {
  const inicio = DATA_ISO_RE.test(String(dataInicio || '')) ? String(dataInicio) : null;
  const fim = DATA_ISO_RE.test(String(dataFim || '')) ? String(dataFim) : null;
  return {
    dataInicio: inicio,
    dataFimExclusivo: fim ? proximoDiaUtc(fim) : null,
  };
}

export function filtroDataInclusivo(dataInicio, dataFim, Op) {
  const periodo = normalizarPeriodo(dataInicio, dataFim);
  const filtro = {};
  if (periodo.dataInicio) filtro[Op.gte] = startOfBusinessDate(periodo.dataInicio);
  if (periodo.dataFimExclusivo) filtro[Op.lt] = startOfBusinessDate(periodo.dataFimExclusivo);
  return Object.keys(filtro).length || Object.getOwnPropertySymbols(filtro).length ? filtro : null;
}

export function limitesPeriodoInclusivo(dataInicio, dataFim) {
  const periodo = normalizarPeriodo(dataInicio, dataFim);
  return {
    inicio: periodo.dataInicio ? startOfBusinessDate(periodo.dataInicio) : null,
    fimExclusivo: periodo.dataFimExclusivo
      ? startOfBusinessDate(periodo.dataFimExclusivo)
      : null
  };
}
