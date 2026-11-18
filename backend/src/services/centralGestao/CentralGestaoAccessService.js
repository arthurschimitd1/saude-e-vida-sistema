import { erroCentral } from './periodo.js';
import { CENTRAL_GESTAO_ROUTE, CENTRAL_GESTAO_VISUALIZAR_FLAG } from '../../access/accessCatalog.js';

export const CENTRAL_ROUTE = CENTRAL_GESTAO_ROUTE;
export const CENTRAL_FLAG = CENTRAL_GESTAO_VISUALIZAR_FLAG;

// Não usa cargo, e-mail legado nem permissões de outro módulo como autorização.
export function validarAcessoCentral(user, company, effective, enabled) {
  if (!user) throw erroCentral('Autenticação necessária.', 401);
  if (!enabled) throw erroCentral('Central de Gestão ainda não habilitada.', 404);
  const master = user.tipo === 'MASTER';
  const empresaId = Number(master ? user.empresa_id_override : user.empresa_id);
  if (!Number.isSafeInteger(empresaId) || empresaId <= 0) throw erroCentral('Selecione uma empresa para acessar a Central de Gestão.', master ? 400 : 403);
  if (!company || Number(company.empresa_id) !== empresaId) throw erroCentral('Empresa indisponível.', 403);
  if (!master && (!company.permissions?.includes(CENTRAL_ROUTE)
    || !effective?.permissions?.includes(CENTRAL_ROUTE)
    || !effective?.permissions?.includes(CENTRAL_FLAG))) throw erroCentral('Sem permissão para acessar a Central de Gestão.', 403);
  return Object.freeze({ empresaId, userId: user.id, master });
}

export async function obterContextoCentral(req, { access, query, enabled }) {
  const user = req.user;
  if (!enabled) return validarAcessoCentral(user, null, null, false);
  if (req.query?.empresa_id !== undefined || req.query?.empresaId !== undefined) throw erroCentral('Empresa arbitrária não é permitida.', 403);
  if (user?.tipo !== 'MASTER' && req.get('X-Empresa-Override')) throw erroCentral('Seleção de outra empresa não autorizada.', 403);
  const empresaId = Number(user?.tipo === 'MASTER' ? user.empresa_id_override : user?.empresa_id);
  if (!Number.isSafeInteger(empresaId) || empresaId <= 0) return validarAcessoCentral(user, null, null, true);
  // Revalida sem o fallback permissivo do middleware de autenticação.
  const company = await access.getCompanyAccess(empresaId);
  const effective = user.tipo === 'MASTER' ? null : await access.getUserEffectiveAccess(user.id);
  const context = validarAcessoCentral(user, company, effective, true);
  const [empresa] = await query('SELECT id FROM empresas WHERE id = :empresaId AND arquivada_em IS NULL', { empresaId });
  if (!empresa) throw erroCentral('Empresa indisponível.', 403);
  return context;
}
