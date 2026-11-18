import { Op, QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import Venda from "../models/Venda.js";
import VendaItem from "../models/VendaItem.js";
import Agendamento from "../models/Agendamento.js";
import AgendamentoColaborador from "../models/AgendamentoColaborador.js";
import Comissao from "../models/Comissao.js";
import ComissaoAssinaturaItem from "../models/ComissaoAssinaturaItem.js";
import ComissaoAssinaturaCompetencia from "../models/ComissaoAssinaturaCompetencia.js";
import HistoricoPagamento from "../models/HistoricoPagamento.js";
import Recorrencia from "../models/Recorrencia.js";
import Product from "../models/Product.js";
import User from "../models/UserModel.js";
import Cliente from "../models/Cliente.js";
import { empresaParaGravar } from "../utils/empresaScope.js";
import { podeVerTodasComissoes } from "../utils/comissaoAccess.js";
import {
  montarRelatorio,
  validarPeriodo,
} from "./RelatorioBarbeariaCalculo.js";

export async function relatorioBarbearia(query, user) {
  const { inicio, fim } = validarPeriodo(query);
  const empresa_id = Number(empresaParaGravar(user));
  if (!empresa_id)
    throw Object.assign(new Error("Selecione uma empresa."), { status: 403 });
  const gestor = podeVerTodasComissoes(user);
  const funcionario_id = gestor
    ? query.profissional_id
      ? Number(query.profissional_id)
      : null
    : Number(user.id);
  if (!gestor && !funcionario_id)
    throw Object.assign(new Error("Usuário inválido."), { status: 403 });
  const cliente_id = query.cliente_id ? Number(query.cliente_id) : null;
  const escopo = { empresa_id, ...(cliente_id ? { cliente_id } : {}) };
  const duracao = Date.parse(fim) - Date.parse(inicio) + 86400000;
  const anterior = new Date(Date.parse(inicio) - duracao)
    .toISOString()
    .slice(0, 10);
  const intervalo = {
    [Op.gte]: new Date(`${inicio}T00:00:00-03:00`),
    [Op.lt]: new Date(Date.parse(`${fim}T00:00:00-03:00`) + 86400000),
  };
  const colaboradores = await AgendamentoColaborador.findAll({
    where: {
      empresa_id,
      ...(funcionario_id ? { usuario_id: funcionario_id } : {}),
    },
    raw: true,
  });
  const idsColaboradores = colaboradores.map((c) => c.id);
  const [
    vendas,
    agenda,
    usuarios,
    competencias,
    assinaturas,
    pagamentos,
    recorrencias,
    produtos,
  ] = await Promise.all([
    Venda.findAll({
      where: {
        ...escopo,
        ...(funcionario_id ? { funcionario_id } : {}),
        data: intervalo,
      },
      raw: true,
    }),
    Agendamento.findAll({
      where: {
        ...escopo,
        ...(funcionario_id
          ? { colaborador_id: { [Op.in]: idsColaboradores } }
          : {}),
        data: { [Op.between]: [inicio, fim] },
      },
      raw: true,
    }),
    User.findAll({
      where: { empresa_id, ...(funcionario_id ? { id: funcionario_id } : {}) },
      attributes: ["id", "nomeCompleto"],
      raw: true,
    }),
    ComissaoAssinaturaCompetencia.findAll({
      where: {
        empresa_id,
        competencia: { [Op.between]: [inicio.slice(0, 7), fim.slice(0, 7)] },
      },
      raw: true,
    }),
    ComissaoAssinaturaItem.findAll({
      where: {
        ...escopo,
        ...(funcionario_id
          ? { profissional_id: { [Op.in]: idsColaboradores } }
          : {}),
        realizado_em: intervalo,
      },
      raw: true,
    }),
    gestor && !funcionario_id
      ? HistoricoPagamento.findAll({
          where: {
            empresa_id,
            status: { [Op.in]: ["PAGO", "PAGO_ATRASADO"] },
            dataPagamento: { [Op.between]: [inicio, fim] },
          },
          attributes: ["recorrencia_id", "dataPagamento", "valor"],
          raw: true,
        })
      : [],
    gestor && !funcionario_id
      ? Recorrencia.findAll({
          where: escopo,
          attributes: ["id", "tipoTransacao", "cliente_id"],
          raw: true,
        })
      : [],
    gestor
      ? Product.findAll({
          where: { empresa_id },
          attributes: ["id", "name", "currentQuantity", "minQuantity"],
          raw: true,
        })
      : [],
  ]);
  const vendaIds = vendas.map((v) => v.id);
  const clienteIds = [
    ...new Set(
      [
        ...vendas.map((v) => v.cliente_id),
        ...agenda.map((a) => a.cliente_id),
      ].filter(Boolean)
    ),
  ];
  const [itens, comissoes, clientes, anteriores, recompras, historico] =
    await Promise.all([
      vendaIds.length
        ? VendaItem.findAll({
            where: { venda_id: { [Op.in]: vendaIds } },
            raw: true,
          })
        : [],
      vendaIds.length
        ? Comissao.findAll({
            where: {
              empresa_id,
              venda_id: { [Op.in]: vendaIds },
              ...(funcionario_id ? { funcionario_id } : {}),
            },
            raw: true,
          })
        : [],
      clienteIds.length
        ? Cliente.findAll({
            where: { empresa_id, id: { [Op.in]: clienteIds } },
            attributes: ["id", ["nomeCompleto", "nome"]],
            raw: true,
          })
        : [],
      sequelize.query(
        `SELECT cliente_id, MIN(data) AS primeira_data, BOOL_OR(data >= :anterior) AS periodo_anterior FROM agendamentos WHERE empresa_id=:empresa AND status='finalizado' AND cliente_id IS NOT NULL AND data < :inicio ${
          funcionario_id ? "AND colaborador_id IN (:cols)" : ""
        } ${cliente_id ? "AND cliente_id=:cliente" : ""} GROUP BY cliente_id`,
        {
          replacements: {
            empresa: empresa_id,
            inicio,
            anterior,
            cols: idsColaboradores.length ? idsColaboradores : [-1],
            cliente: cliente_id,
          },
          type: QueryTypes.SELECT,
        }
      ),
      sequelize.query(
        `SELECT DISTINCT v.cliente_id FROM vendas v JOIN venda_itens i ON i.venda_id=v.id WHERE v.empresa_id=:empresa AND v.data < :inicio AND i.tipo <> 'servico' AND v.cliente_id IS NOT NULL ${
          funcionario_id ? "AND v.funcionario_id=:func" : ""
        } ${cliente_id ? "AND v.cliente_id=:cliente" : ""}`,
        {
          replacements: {
            empresa: empresa_id,
            inicio: `${inicio}T00:00:00-03:00`,
            func: funcionario_id,
            cliente: cliente_id,
          },
          type: QueryTypes.SELECT,
        }
      ),
      sequelize.query(
        `SELECT TO_CHAR(data AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') AS mes, SUM(valor_total)::numeric AS faturamento FROM vendas WHERE empresa_id=:empresa AND data >= :inicio AND data < :fim ${
          funcionario_id ? "AND funcionario_id=:func" : ""
        } ${cliente_id ? "AND cliente_id=:cliente" : ""} GROUP BY 1 ORDER BY 1`,
        {
          replacements: {
            empresa: empresa_id,
            inicio: `${new Date(
              Date.UTC(Number(fim.slice(0, 4)), Number(fim.slice(5, 7)) - 12, 1)
            )
              .toISOString()
              .slice(0, 10)}T00:00:00-03:00`,
            fim: new Date(Date.parse(`${fim}T00:00:00-03:00`) + 86400000),
            func: funcionario_id,
            cliente: cliente_id,
          },
          type: QueryTypes.SELECT,
        }
      ),
    ]);
  // Meses sem vendas precisam aparecer para que o comparativo não pule períodos.
  const mapaHistorico = new Map(historico.map((h) => [h.mes, h]));
  const historicoMensal = Array.from({ length: 12 }, (_, i) => {
    const mes = new Date(
      Date.UTC(Number(fim.slice(0, 4)), Number(fim.slice(5, 7)) - 12 + i, 1)
    )
      .toISOString()
      .slice(0, 7);
    return mapaHistorico.get(mes) || { mes, faturamento: 0 };
  });
  const dados = montarRelatorio({
    inicio,
    fim,
    vendas,
    itens,
    agenda,
    colaboradores,
    usuarios,
    competencias,
    comissoes,
    assinaturas,
    pagamentos,
    recorrencias,
    produtos,
    clientes,
    anteriores,
    recompras,
    historico: historicoMensal,
    gestor,
  });
  const [config] = await sequelize.query(
    "SELECT configuracoes->'painel_barbearia'->:mes AS metas FROM empresas WHERE id=:empresa",
    {
      replacements: { mes: inicio.slice(0, 7), empresa: empresa_id },
      type: QueryTypes.SELECT,
    }
  );
  const metas = config?.metas || {};
  const mesCompleto =
    inicio.endsWith("-01") &&
    fim ===
      new Date(
        Date.UTC(Number(inicio.slice(0, 4)), Number(inicio.slice(5, 7)), 0)
      )
        .toISOString()
        .slice(0, 10);
  for (const e of dados.equipe) {
    const id = e.profissional_id.startsWith("u:")
      ? e.profissional_id.slice(2)
      : null;
    const m = id ? metas.profissionais?.[id] : null;
    e.meta = mesCompleto ? m?.meta ?? null : null;
    e.meta_atingida =
      e.meta > 0 ? Math.round((e.faturamento / e.meta) * 10000) / 100 : null;
    const cols = colaboradores
      .filter((c) =>
        id ? String(c.usuario_id) === id : `c:${c.id}` === e.profissional_id
      )
      .map((c) => c.id);
    const ag = agenda.filter(
      (a) =>
        cols.includes(a.colaborador_id) &&
        !["cancelado", "faltou"].includes(a.status)
    );
    e.minutos_agendados = ag.reduce(
      (s, a) => s + Number(a.servico_duracao_min || 0),
      0
    );
    e.horas_disponiveis = mesCompleto ? m?.horas_disponiveis ?? null : null;
    e.ocupacao =
      e.horas_disponiveis > 0
        ? Math.round(
            (e.minutos_agendados / (e.horas_disponiveis * 60)) * 10000
          ) / 100
        : null;
  }
  return {
    ...dados,
    mes_completo: mesCompleto,
    metas: gestor
      ? metas
      : { profissionais: { [user.id]: metas.profissionais?.[user.id] || {} } },
    profissional_filtrado: Boolean(funcionario_id),
    filtros: {
      profissionais: usuarios.map((u) => ({ id: u.id, nome: u.nomeCompleto })),
      clientes: clientes.map((c) => ({ id: c.id, nome: c.nome })),
    },
  };
}
