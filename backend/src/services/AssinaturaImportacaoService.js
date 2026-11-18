import { Op, QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Cliente from '../models/Cliente.js';
import Recorrencia from '../models/Recorrencia.js';
import { resolveDomFerrazScope } from './PublicAgendamentoScopeService.js';
import domFerrazAssinaturas from '../data/domFerrazAssinaturas.js';

const TARGET_SLUG = 'manaira';
const SOURCE = 'AppBarber';
let schemaPromise = null;
let bootstrapPromise = null;

const text = (value) => String(value ?? '').trim();
const normalizeText = (value) => text(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');
const digits = (value) => text(value).replace(/\D/g, '');

function parseMoney(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(2));
  const raw = text(value).replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}

function normalizePlans(rows) {
  if (!Array.isArray(rows) || rows.length > 500) throw new Error('A lista de planos é inválida ou excede o limite permitido.');
  return rows.map((row, index) => {
    const nome = text(row?.nome ?? row?.descricao ?? row?.description);
    if (!nome) throw new Error(`Plano ${index + 1}: descrição obrigatória.`);
    return {
      nome,
      nomeNormalizado: normalizeText(nome),
      diaVencimento: text(row?.diaVencimento ?? row?.dia_vencimento) || null,
      periodicidade: text(row?.periodicidade) || null,
      valor: parseMoney(row?.valor),
      tipo: text(row?.tipo) || null,
      origemLinha: Number(row?.origemLinha ?? row?.sourceRow ?? index + 1),
    };
  });
}

function normalizeSubscribers(rows) {
  if (!Array.isArray(rows) || rows.length > 500) throw new Error('A lista de assinantes é inválida ou excede o limite permitido.');
  return rows.map((row, index) => {
    const nome = text(row?.nome ?? row?.name);
    const planoOriginal = text(row?.plano ?? row?.plan);
    if (!nome || !planoOriginal) throw new Error(`Assinante ${index + 1}: nome e plano são obrigatórios.`);
    const contratacao = parseDate(row?.contratacao ?? row?.dataContratacao);
    const proximoVencimento = parseDate(row?.proximoVencimento ?? row?.nextDueDate);
    if (row?.contratacao && !contratacao) throw new Error(`Assinante ${index + 1}: data de contratação inválida.`);
    if (row?.proximoVencimento && !proximoVencimento) throw new Error(`Assinante ${index + 1}: próximo vencimento inválido.`);
    return {
      nome,
      planoOriginal,
      planoNormalizado: normalizeText(planoOriginal),
      contratacao,
      proximoVencimento,
      status: text(row?.status) || null,
      celular: text(row?.celular ?? row?.telefone) || null,
      celularNormalizado: digits(row?.celular ?? row?.telefone) || null,
      email: text(row?.email) || null,
      planoOrigemLinha: row?.planoOrigemLinha ? Number(row.planoOrigemLinha) : null,
      origemLinha: Number(row?.origemLinha ?? row?.sourceRow ?? index + 1),
    };
  });
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS assinatura_planos_importados (
          id SERIAL PRIMARY KEY, empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          nome VARCHAR(200) NOT NULL, nome_normalizado VARCHAR(200) NOT NULL, dia_vencimento VARCHAR(80),
          periodicidade VARCHAR(40), valor DECIMAL(12,2) NOT NULL DEFAULT 0, tipo VARCHAR(80),
          origem VARCHAR(80) NOT NULL DEFAULT 'AppBarber', origem_linha INTEGER, metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (empresa_id, origem, origem_linha)
        )`);
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS assinatura_assinantes_importados (
          id SERIAL PRIMARY KEY, empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL, plano_id INTEGER REFERENCES assinatura_planos_importados(id) ON DELETE SET NULL,
          nome VARCHAR(200) NOT NULL, plano_original VARCHAR(200) NOT NULL, plano_normalizado VARCHAR(200) NOT NULL,
          contratacao DATE, proximo_vencimento DATE, status VARCHAR(50), celular VARCHAR(40), celular_normalizado VARCHAR(20), email VARCHAR(200),
          origem VARCHAR(80) NOT NULL DEFAULT 'AppBarber', origem_linha INTEGER, situacao_importacao VARCHAR(40) NOT NULL DEFAULT 'PENDENTE_MAPEAMENTO',
          metadados JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (empresa_id, origem, origem_linha)
        )`);
      // Compatibilidade com instalações que receberam uma versão inicial
      // dessas tabelas. CREATE TABLE IF NOT EXISTS não completa colunas de uma
      // tabela que já existia, por isso o rollout precisa ser aditivo.
      const compatColumns = [
        ['assinatura_planos_importados', 'empresa_id', 'INTEGER'],
        ['assinatura_planos_importados', 'nome', 'VARCHAR(200)'],
        ['assinatura_planos_importados', 'nome_normalizado', 'VARCHAR(200)'],
        ['assinatura_planos_importados', 'dia_vencimento', 'VARCHAR(80)'],
        ['assinatura_planos_importados', 'periodicidade', 'VARCHAR(40)'],
        ['assinatura_planos_importados', 'valor', 'DECIMAL(12,2) DEFAULT 0'],
        ['assinatura_planos_importados', 'tipo', 'VARCHAR(80)'],
        ['assinatura_planos_importados', 'origem', "VARCHAR(80) DEFAULT 'AppBarber'"],
        ['assinatura_planos_importados', 'origem_linha', 'INTEGER'],
        ['assinatura_planos_importados', 'metadados', "JSONB DEFAULT '{}'::jsonb"],
        ['assinatura_planos_importados', 'created_at', 'TIMESTAMP DEFAULT NOW()'],
        ['assinatura_planos_importados', 'updated_at', 'TIMESTAMP DEFAULT NOW()'],
        ['assinatura_assinantes_importados', 'empresa_id', 'INTEGER'],
        ['assinatura_assinantes_importados', 'cliente_id', 'INTEGER'],
        ['assinatura_assinantes_importados', 'plano_id', 'INTEGER'],
        ['assinatura_assinantes_importados', 'nome', 'VARCHAR(200)'],
        ['assinatura_assinantes_importados', 'plano_original', 'VARCHAR(200)'],
        ['assinatura_assinantes_importados', 'plano_normalizado', 'VARCHAR(200)'],
        ['assinatura_assinantes_importados', 'contratacao', 'DATE'],
        ['assinatura_assinantes_importados', 'proximo_vencimento', 'DATE'],
        ['assinatura_assinantes_importados', 'status', 'VARCHAR(50)'],
        ['assinatura_assinantes_importados', 'celular', 'VARCHAR(40)'],
        ['assinatura_assinantes_importados', 'celular_normalizado', 'VARCHAR(20)'],
        ['assinatura_assinantes_importados', 'email', 'VARCHAR(200)'],
        ['assinatura_assinantes_importados', 'origem', "VARCHAR(80) DEFAULT 'AppBarber'"],
        ['assinatura_assinantes_importados', 'origem_linha', 'INTEGER'],
        ['assinatura_assinantes_importados', 'situacao_importacao', "VARCHAR(40) DEFAULT 'PENDENTE_MAPEAMENTO'"],
        ['assinatura_assinantes_importados', 'metadados', "JSONB DEFAULT '{}'::jsonb"],
        ['assinatura_assinantes_importados', 'created_at', 'TIMESTAMP DEFAULT NOW()'],
        ['assinatura_assinantes_importados', 'updated_at', 'TIMESTAMP DEFAULT NOW()'],
      ];
      for (const [table, column, definition] of compatColumns) {
        await sequelize.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
      }
      await sequelize.query("UPDATE assinatura_planos_importados SET nome_normalizado = LOWER(TRIM(nome)) WHERE nome_normalizado IS NULL AND nome IS NOT NULL");
      await sequelize.query("UPDATE assinatura_assinantes_importados SET plano_normalizado = LOWER(TRIM(plano_original)) WHERE plano_normalizado IS NULL AND plano_original IS NOT NULL");
      await sequelize.query('CREATE INDEX IF NOT EXISTS assinatura_planos_importados_empresa_idx ON assinatura_planos_importados (empresa_id, nome_normalizado)');
      await sequelize.query('CREATE INDEX IF NOT EXISTS assinatura_assinantes_importados_empresa_idx ON assinatura_assinantes_importados (empresa_id, status, proximo_vencimento)');
      return true;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function targetCompany(user) {
  const target = await resolveDomFerrazScope(TARGET_SLUG);
  const effectiveCompany = user?.tipo === 'MASTER' ? user.empresa_id_override : user?.empresa_id;
  if (user?.tipo !== 'MASTER' && Number(effectiveCompany) !== target.empresaId) {
    throw new Error('Selecione ou acesse a empresa Dom Ferraz - Manaíra para importar estes dados.');
  }
  if (user?.tipo === 'MASTER' && effectiveCompany && Number(effectiveCompany) !== target.empresaId) {
    throw new Error('A empresa selecionada não é a Dom Ferraz - Manaíra.');
  }
  return target;
}

function buildMapping(plans, subscribers) {
  const byKey = new Map();
  plans.forEach((plan) => {
    const list = byKey.get(plan.nomeNormalizado) || [];
    list.push(plan);
    byKey.set(plan.nomeNormalizado, list);
  });
  return subscribers.map((subscriber) => {
    const candidates = byKey.get(subscriber.planoNormalizado) || [];
    const selected = subscriber.planoOrigemLinha
      ? candidates.find((plan) => plan.origemLinha === subscriber.planoOrigemLinha)
      : null;
    const mapped = selected || (candidates.length === 1 ? candidates[0] : null);
    return {
      ...subscriber,
      planoCandidatos: candidates.map((plan) => ({ origemLinha: plan.origemLinha, nome: plan.nome, valor: plan.valor, tipo: plan.tipo })),
      planoMapeado: mapped,
      situacaoImportacao: mapped ? 'PRONTO' : candidates.length ? 'PENDENTE_MAPEAMENTO' : 'PLANO_NAO_ENCONTRADO',
    };
  });
}

export async function previewImportacao(payload, user) {
  await ensureSchema();
  const target = await targetCompany(user);
  const planos = normalizePlans(payload?.planos);
  const assinantes = buildMapping(planos, normalizeSubscribers(payload?.assinantes));
  return {
    empresa: { id: target.empresaId, nome: target.empresaNome, slug: TARGET_SLUG },
    planos,
    assinantes,
    resumo: {
      totalPlanos: planos.length,
      totalAssinantes: assinantes.length,
      prontos: assinantes.filter((item) => item.situacaoImportacao === 'PRONTO').length,
      pendentesMapeamento: assinantes.filter((item) => item.situacaoImportacao === 'PENDENTE_MAPEAMENTO').length,
      semPlano: assinantes.filter((item) => item.situacaoImportacao === 'PLANO_NAO_ENCONTRADO').length,
    },
  };
}

export async function listarImportacao(user) {
  await ensureSchema();
  const target = await targetCompany(user);
  const [planos, assinantes] = await Promise.all([
    sequelize.query('SELECT * FROM assinatura_planos_importados WHERE empresa_id = :empresaId ORDER BY nome_normalizado, id', { replacements: { empresaId: target.empresaId }, type: QueryTypes.SELECT }),
    sequelize.query(`SELECT a.*, p.nome AS plano_nome, c.id AS cliente_id_vinculado
      FROM assinatura_assinantes_importados a
      LEFT JOIN assinatura_planos_importados p ON p.id = a.plano_id
      LEFT JOIN clientes c ON c.id = a.cliente_id
      WHERE a.empresa_id = :empresaId ORDER BY a.nome_normalizado, a.id`, { replacements: { empresaId: target.empresaId }, type: QueryTypes.SELECT }),
  ]);
  return { empresa: { id: target.empresaId, nome: target.empresaNome }, planos, assinantes };
}

export async function importar(payload, user) {
  await ensureSchema();
  const target = await targetCompany(user);
  const preview = await previewImportacao(payload, user);
  if (preview.resumo.pendentesMapeamento > 0 || preview.resumo.semPlano > 0) {
    throw new Error('Resolva o vínculo dos planos na prévia antes de importar para Recorrências.');
  }
  const transaction = await sequelize.transaction();
  try {
    // Impede duas instâncias de produção iniciarem a mesma carga ao mesmo tempo.
    if (payload?.__bootstrap === true) {
      await sequelize.query('SELECT pg_advisory_xact_lock(824202408)', { transaction });
    }
    const planIds = new Map();
    for (const plan of preview.planos) {
      const [row] = await sequelize.query(`
        INSERT INTO assinatura_planos_importados (empresa_id, nome, nome_normalizado, dia_vencimento, periodicidade, valor, tipo, origem, origem_linha, metadados, updated_at)
        VALUES (:empresaId, :nome, :nomeNormalizado, :diaVencimento, :periodicidade, :valor, :tipo, :origem, :origemLinha, CAST(:metadados AS JSONB), NOW())
        ON CONFLICT (empresa_id, origem, origem_linha) DO UPDATE SET nome = EXCLUDED.nome, nome_normalizado = EXCLUDED.nome_normalizado,
          dia_vencimento = EXCLUDED.dia_vencimento, periodicidade = EXCLUDED.periodicidade, valor = EXCLUDED.valor, tipo = EXCLUDED.tipo,
          metadados = EXCLUDED.metadados, updated_at = NOW()
        RETURNING id`, { replacements: { empresaId: target.empresaId, ...plan, origem: SOURCE, metadados: JSON.stringify({ fonte: 'Planos de assinatura.pdf' }) }, transaction, type: QueryTypes.SELECT });
      planIds.set(plan.origemLinha, row.id);
    }

    const existingClients = await Cliente.findAll({ where: { empresa_id: target.empresaId }, attributes: ['id', 'nomeCompleto', 'telefone', 'email'], transaction });
    const clientByPhone = new Map(existingClients.map((client) => [digits(client.telefone), client]));
    for (const subscriber of preview.assinantes) {
      let cliente = subscriber.celularNormalizado ? clientByPhone.get(subscriber.celularNormalizado) : null;
      if (!cliente) {
        cliente = await Cliente.create({ nomeCompleto: subscriber.nome, telefone: subscriber.celular || 'Não informado', email: subscriber.email || null, empresa_id: target.empresaId }, { transaction });
        if (subscriber.celularNormalizado) clientByPhone.set(subscriber.celularNormalizado, cliente);
      } else {
        const updates = {};
        if (!cliente.email && subscriber.email) updates.email = subscriber.email;
        if (Object.keys(updates).length) await cliente.update(updates, { transaction });
      }
      const planId = subscriber.planoMapeado ? planIds.get(subscriber.planoMapeado.origemLinha) : null;
      const situacao = subscriber.situacaoImportacao;
      await sequelize.query(`
        INSERT INTO assinatura_assinantes_importados (empresa_id, cliente_id, plano_id, nome, plano_original, plano_normalizado, contratacao, proximo_vencimento, status, celular, celular_normalizado, email, origem, origem_linha, situacao_importacao, metadados, updated_at)
        VALUES (:empresaId, :clienteId, :planoId, :nome, :planoOriginal, :planoNormalizado, :contratacao, :proximoVencimento, :status, :celular, :celularNormalizado, :email, :origem, :origemLinha, :situacao, CAST(:metadados AS JSONB), NOW())
        ON CONFLICT (empresa_id, origem, origem_linha) DO UPDATE SET cliente_id = EXCLUDED.cliente_id, plano_id = EXCLUDED.plano_id,
          nome = EXCLUDED.nome, plano_original = EXCLUDED.plano_original, plano_normalizado = EXCLUDED.plano_normalizado,
          contratacao = EXCLUDED.contratacao, proximo_vencimento = EXCLUDED.proximo_vencimento, status = EXCLUDED.status,
          celular = EXCLUDED.celular, celular_normalizado = EXCLUDED.celular_normalizado, email = EXCLUDED.email,
          situacao_importacao = EXCLUDED.situacao_importacao, metadados = EXCLUDED.metadados, updated_at = NOW()`, {
        replacements: { empresaId: target.empresaId, clienteId: cliente.id, planoId: planId, ...subscriber, origem: SOURCE, situacao, metadados: JSON.stringify({ fonte: 'AppBarber - Assinantes.pdf', planoCandidatos: subscriber.planoCandidatos }) }, transaction,
      });

      // Integra no módulo existente de Recorrências. O marcador torna a
      // operação idempotente: uma nova importação atualiza, não duplica.
      const origemRecorrencia = `Importado do AppBarber | linha ${subscriber.origemLinha}`;
      const plano = subscriber.planoMapeado;
      const recorrenciaData = {
        cliente_id: cliente.id,
        nomeCliente: subscriber.nome,
        produto: plano?.nome || subscriber.planoOriginal,
        tipoTransacao: 'ENTRADA',
        tempoRecorrencia: 'MENSAL',
        subtipoRecorrencia: null,
        valorMes: Number(plano?.valor || 0),
        // O AppBarber não informa a forma de pagamento; não inventamos
        // cobrança e registramos essa ausência nas observações.
        formaPagamento: 'NAO_INFORMADO',
        bancoRecebimento: null,
        bancoNome: null,
        bancoAgencia: null,
        bancoConta: null,
        bancoPix: null,
        dataInicio: subscriber.contratacao || new Date().toISOString().slice(0, 10),
        dataFim: null,
        ativo: true,
        ultimoPagamento: null,
        proximoVencimento: subscriber.proximoVencimento,
        observacoes: `${origemRecorrencia} | Status AppBarber: ${subscriber.status || 'não informado'} | Forma de pagamento: não informada`,
        servicosInclusos: null,
        empresa_id: target.empresaId,
      };
      const recorrenciaExistente = await Recorrencia.findOne({
        where: { empresa_id: target.empresaId, cliente_id: cliente.id, observacoes: { [Op.like]: `${origemRecorrencia} %` } },
        transaction,
      });
      if (recorrenciaExistente) await recorrenciaExistente.update(recorrenciaData, { transaction });
      else await Recorrencia.create(recorrenciaData, { transaction });
    }
    await transaction.commit();
    return { ...preview.resumo, clientesVinculados: preview.assinantes.length, recorrenciasCriadasOuAtualizadas: preview.assinantes.length, importadoSemLancamentoFinanceiro: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

const BOOTSTRAP_PLAN_LINES = Object.freeze({
  'DOM CLUB CUT': 4,
  'DOM CLUB PREMIUM': 10,
  'Dom club premium': 12,
});

function buildBootstrapPayload() {
  return {
    __bootstrap: true,
    planos: domFerrazAssinaturas.planos,
    assinantes: domFerrazAssinaturas.assinantes.map((assinante) => ({
      ...assinante,
      planoOrigemLinha: BOOTSTRAP_PLAN_LINES[assinante.plano] || undefined,
    })),
  };
}

/**
 * Carga única dos dados fornecidos nos PDFs do AppBarber.
 * Executa apenas no backend de produção e é segura para reexecução:
 * a chave de origem/linha atualiza os mesmos registros em vez de duplicá-los.
 */
export async function bootstrapDomFerrazAssinaturas() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureSchema();
      const target = await resolveDomFerrazScope(TARGET_SLUG);
      const [row] = await sequelize.query(`
        SELECT COUNT(*)::int AS total
        FROM recorrencias
        WHERE empresa_id = :empresaId
          AND observacoes LIKE 'Importado do AppBarber | linha %'`, {
        replacements: { empresaId: target.empresaId },
        type: QueryTypes.SELECT,
      });
      if (Number(row?.total || 0) >= domFerrazAssinaturas.assinantes.length) {
        return { ignorado: true, motivo: 'carga já concluída', recorrenciasCriadasOuAtualizadas: Number(row.total) };
      }
      return importar(buildBootstrapPayload(), {
        tipo: 'MASTER',
        empresa_id_override: target.empresaId,
      });
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  return bootstrapPromise;
}

export default { ensureSchema, previewImportacao, listarImportacao, importar, bootstrapDomFerrazAssinaturas, normalizePlans, normalizeSubscribers, normalizeText, buildMapping };
