import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";
import { empresaParaGravar } from "../utils/empresaScope.js";
import { exigirGestaoComissoes } from "../utils/comissaoAccess.js";
export function validarMetas(data) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(data.mes || ""))
    throw Object.assign(new Error("Mês inválido."), { status: 400 });
  const numero = (n, max = 1e9) => {
    if (n == null || n === "") return null;
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0 || v > max)
      throw Object.assign(
        new Error("Informe valores positivos válidos para as metas."),
        { status: 400 }
      );
    return Math.round(v * 100) / 100;
  };
  const profissionais = {};
  for (const [id, m] of Object.entries(data.profissionais || {})) {
    if (!/^\d+$/.test(id))
      throw Object.assign(new Error("Profissional inválido."), { status: 400 });
    profissionais[id] = {
      meta: numero(m.meta),
      horas_disponiveis: numero(m.horas_disponiveis, 744),
    };
  }
  if (Object.keys(profissionais).length > 1000)
    throw Object.assign(new Error("Limite de profissionais excedido."), {
      status: 400,
    });
  return {
    meta: numero(data.meta),
    custos_fixos: numero(data.custos_fixos),
    margem_contribuicao: numero(data.margem_contribuicao, 100),
    profissionais,
  };
}
export async function salvarMetas(data, user) {
  exigirGestaoComissoes(user);
  const empresa = Number(empresaParaGravar(user));
  if (!empresa)
    throw Object.assign(new Error("Selecione uma empresa."), { status: 403 });
  const metas = validarMetas(data);
  return sequelize.transaction(async (transaction) => {
    const [registro] = await sequelize.query(
      "SELECT configuracoes->'painel_barbearia' AS painel FROM empresas WHERE id=:empresa FOR UPDATE",
      { replacements: { empresa }, type: QueryTypes.SELECT, transaction }
    );
    if (!registro)
      throw Object.assign(new Error("Empresa não encontrada."), {
        status: 404,
      });
    const painel = {
      ...(registro.painel || {}),
      [data.mes]: {
        ...metas,
        atualizado_por: user.id,
        atualizado_em: new Date().toISOString(),
      },
    };
    await sequelize.query(
      "UPDATE empresas SET configuracoes=jsonb_set(COALESCE(configuracoes,'{}'::jsonb),'{painel_barbearia}',CAST(:painel AS jsonb)) WHERE id=:empresa",
      { replacements: { empresa, painel: JSON.stringify(painel) }, transaction }
    );
    return metas;
  });
}
