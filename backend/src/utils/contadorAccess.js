import sequelize from '../config/database.js';

export const PORTAL_CONTADOR_ROUTE = '/uikit/contabil-fiscal/portal-contador';

export function empresaTemPacoteContador(permissoes = []) {
  return Array.isArray(permissoes) && permissoes.includes(PORTAL_CONTADOR_ROUTE);
}

export async function getPermissoesEmpresa(empresaId) {
  if (!empresaId) return [];

  const [empresa] = await sequelize.query(
    'SELECT permissoes FROM empresas WHERE id = :empresaId LIMIT 1',
    {
      replacements: { empresaId },
      type: sequelize.QueryTypes.SELECT
    }
  );

  return Array.isArray(empresa?.permissoes) ? empresa.permissoes : [];
}

export async function usuarioPertenceEmpresaContador(user) {
  const permissoes = await getPermissoesEmpresa(user?.empresa_id);
  return empresaTemPacoteContador(permissoes);
}

export async function usuarioPodeAcessarAreaContador(user, { allowMaster = true } = {}) {
  if (allowMaster && user?.tipo === 'MASTER') return true;
  return usuarioPertenceEmpresaContador(user);
}
