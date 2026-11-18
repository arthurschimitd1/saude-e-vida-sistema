export const podeVerTodasComissoes = (user) => {
  if (!user) return false;
  if (user.tipo === 'MASTER' || user.tipo === 'EMPRESA') return true;
  return Array.isArray(user.permissoes) && user.permissoes.includes('comissoes:todos');
};

export const aplicarEscopoComissoes = (where, user) => {
  if (!podeVerTodasComissoes(user)) {
    where.funcionario_id = Number(user?.id) > 0 ? Number(user.id) : -1;
  }
  return where;
};

export const exigirGestaoComissoes = (user) => {
  if (!podeVerTodasComissoes(user)) {
    const error = new Error('Sem permissão para gerenciar comissões');
    error.status = 403;
    throw error;
  }
};
