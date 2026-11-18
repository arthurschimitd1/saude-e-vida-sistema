export function usuarioPodeAcessarNota(nota, user) {
  if (!nota || !user) return false;

  const isMaster = user.tipo === 'MASTER' || user.email === 'admin@master.com';
  if (isMaster) {
    const empresaSelecionada = Number(user.empresa_id_override);
    return !Number.isInteger(empresaSelecionada) || empresaSelecionada <= 0
      || Number(nota.empresa_id) === empresaSelecionada;
  }

  return Number(user.empresa_id) === Number(nota.empresa_id);
}
