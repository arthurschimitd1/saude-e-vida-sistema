const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateAtMidnight = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function resolveDesperdicioPeriodo({ periodo = 'dia', dataInicio, dataFim, now = new Date() } = {}) {
  const hoje = dateAtMidnight(now);
  const tipo = String(periodo || 'dia').toLowerCase();

  if (tipo === 'personalizado' || tipo === 'custom') {
    if (!DATE_ONLY.test(String(dataInicio || '')) || !DATE_ONLY.test(String(dataFim || ''))) {
      const error = new Error('Informe data inicial e data final no formato AAAA-MM-DD');
      error.status = 400;
      throw error;
    }
    if (String(dataInicio) > String(dataFim)) {
      const error = new Error('A data inicial não pode ser maior que a data final');
      error.status = 400;
      throw error;
    }
    return { periodo: 'personalizado', dataInicio: String(dataInicio), dataFim: String(dataFim) };
  }

  if (tipo === 'semana' || tipo === 'week') {
    const diaDaSemana = hoje.getDay() || 7;
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - diaDaSemana + 1);
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    return { periodo: 'semana', dataInicio: formatDateOnly(inicio), dataFim: formatDateOnly(fim) };
  }

  if (tipo === 'mes' || tipo === 'month') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return { periodo: 'mes', dataInicio: formatDateOnly(inicio), dataFim: formatDateOnly(fim) };
  }

  if (tipo !== 'dia' && tipo !== 'day') {
    const error = new Error('Período inválido. Use dia, semana, mes ou personalizado');
    error.status = 400;
    throw error;
  }

  return { periodo: 'dia', dataInicio: formatDateOnly(hoje), dataFim: formatDateOnly(hoje) };
}
