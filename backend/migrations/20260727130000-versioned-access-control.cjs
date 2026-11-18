'use strict';

const INTERNAL_FLAGS = [
  'ponto:todos',
  'planejamento:todos',
  'agendamento:todos',
  'senha:ver',
  'caixa:pular_senha'
];

const MODULES = [
  ['home', '/', 'Inicio', 'Home'],
  ['dashboard', '/dashboard', 'Dashboard', 'Home'],
  ['estoque', '/uikit/formlayout', 'Estoque', 'Operacional'],
  ['materia_prima', '/uikit/overlay', 'Materia-prima', 'Operacional'],
  ['producao', '/uikit/producao', 'Producao', 'Operacional'],
  ['pedidos', '/uikit/pedidos', 'Pedidos', 'Operacional'],
  ['fornecedores', '/uikit/fornecedores', 'Fornecedores', 'Operacional'],
  ['agendamentos', '/uikit/agendamentos', 'Agendamentos', 'Operacional'],
  ['clientes', '/uikit/button', 'Clientes', 'Comercial'],
  ['orcamentos', '/uikit/tree', 'Orcamentos', 'Comercial'],
  ['caixa', '/uikit/input', 'Caixa', 'Comercial'],
  ['servicos_nfse', '/uikit/servicos', 'Servicos / NFS-e', 'Comercial'],
  ['nfe', '/uikit/servicos-nfe', 'NF-e', 'Comercial'],
  ['nfce', '/uikit/servicos-nfce', 'NFC-e', 'Comercial'],
  ['historico_notas', '/uikit/historico-notas', 'Historico de notas', 'Comercial'],
  ['manifestos', '/uikit/manifestos', 'Manifestos', 'Comercial'],
  ['whatsapp_crm', '/uikit/automacao-whatsapp', 'WhatsApp CRM', 'Comercial'],
  ['recorrencia', '/uikit/list', 'Recorrencia', 'Financeiro'],
  ['custos_funcionarios', '/uikit/table', 'Custos por funcionarios', 'Financeiro'],
  ['comissoes', '/uikit/comissoes', 'Comissoes', 'Financeiro'],
  ['notas_fiscais', '/uikit/notas-fiscais', 'Notas fiscais', 'Financeiro'],
  ['financeiro_dashboard', '/financeiro/dashboard', 'Dashboard financeiro', 'Financeiro'],
  ['financeiro_entradas', '/financeiro/entradas', 'Entradas', 'Financeiro'],
  ['financeiro_saidas', '/financeiro/saidas', 'Saidas', 'Financeiro'],
  ['financeiro_relatorios', '/financeiro/relatorios', 'Relatorios financeiros', 'Financeiro'],
  ['crm_rfm', '/uikit/crm', 'CRM / RFM', 'Financeiro'],
  ['financeiro_escolar', '/uikit/escola-financeiro', 'Financeiro escolar', 'Financeiro'],
  ['usuarios', '/uikit/invalidstate', 'Usuarios', 'Administracao'],
  ['gestao_acessos', '/uikit/panel', 'Gestao de acessos', 'Administracao'],
  ['minha_empresa', '/uikit/media', 'Minha empresa', 'Administracao'],
  ['configuracao_fiscal', '/uikit/integracao-focus', 'Configuracao fiscal', 'Administracao'],
  ['controle_ponto', '/uikit/ponto', 'Controle de ponto', 'Departamento Pessoal'],
  ['contratos', '/uikit/contratos', 'Contratos', 'Juridico'],
  ['procuracoes', '/uikit/procuracoes', 'Procuracoes', 'Juridico'],
  ['marketing', '/uikit/menu', 'Marketing', 'Estrategia'],
  ['planejamento', '/uikit/message', 'Planejamento', 'Estrategia'],
  ['crm_prospeccao', '/uikit/prospeccao', 'Empresas e leads', 'CRM Comercial'],
  ['crm_dashboard', '/uikit/prospeccao/dashboard', 'Visao geral', 'CRM Comercial'],
  ['crm_pipeline', '/uikit/prospeccao/pipeline', 'Pipeline', 'CRM Comercial'],
  ['crm_campanhas', '/uikit/prospeccao/campanhas', 'Campanhas', 'CRM Comercial'],
  ['crm_historico', '/uikit/prospeccao/historico', 'Historico comercial', 'CRM Comercial'],
  ['crm_scripts', '/uikit/prospeccao/scripts', 'Scripts IA', 'CRM Comercial'],
  ['crm_relatorios', '/uikit/prospeccao/relatorios', 'Relatorios CRM', 'CRM Comercial'],
  ['crm_configuracoes', '/uikit/prospeccao/configuracoes', 'Configuracoes CRM', 'CRM Comercial'],
  ['contabil_dashboard', '/uikit/contabil-fiscal/dashboard', 'Dashboard contabil', 'Contabil e Fiscal'],
  ['contabil_central', '/uikit/contabil-fiscal/central-fiscal', 'Central fiscal', 'Contabil e Fiscal'],
  ['contabil_historico', '/uikit/contabil-fiscal/historico-notas', 'Historico contabil', 'Contabil e Fiscal'],
  ['inteligencia_negocio', '/uikit/inteligencia', 'Inteligencia do negocio', 'Contabil e Fiscal'],
  ['inteligencia_fiscal', '/uikit/contabil-fiscal/inteligencia-fiscal', 'Inteligencia fiscal', 'Contabil e Fiscal'],
  ['integracao_contabil', '/uikit/contabil-fiscal/integracao-contabil', 'Integracao contabil', 'Contabil e Fiscal'],
  ['gestao_tributaria', '/uikit/contabil-fiscal/gestao-tributaria', 'Gestao tributaria', 'Contabil e Fiscal'],
  ['conciliacao_financeira', '/uikit/contabil-fiscal/conciliacao', 'Conciliacao financeira', 'Contabil e Fiscal'],
  ['dre_relatorios', '/uikit/contabil-fiscal/dre-relatorios', 'DRE e relatorios', 'Contabil e Fiscal'],
  ['centro_custos', '/uikit/contabil-fiscal/centro-custos', 'Centro de custos', 'Contabil e Fiscal'],
  ['automacao_fiscal', '/uikit/contabil-fiscal/automacao', 'Automacao fiscal', 'Contabil e Fiscal'],
  ['portal_contador', '/uikit/contabil-fiscal/portal-contador', 'Portal do contador', 'Contabil e Fiscal'],
  ['auditoria', '/uikit/contabil-fiscal/auditoria', 'Auditoria', 'Contabil e Fiscal']
];

const byGroup = (...groups) => MODULES
  .filter((module) => groups.includes(module[3]))
  .map((module) => module[1]);

const base = [
  ...byGroup('Home', 'Operacional'),
  ...byGroup('Comercial').filter((route) => !['/uikit/automacao-whatsapp', '/uikit/manifestos'].includes(route)),
  '/uikit/list',
  '/uikit/table',
  '/uikit/comissoes',
  '/uikit/notas-fiscais',
  '/financeiro/entradas',
  '/financeiro/saidas',
  ...byGroup('Administracao')
];
const package2 = [
  ...base,
  '/uikit/automacao-whatsapp',
  ...byGroup('Financeiro', 'Departamento Pessoal', 'Juridico', 'Estrategia', 'CRM Comercial')
];
const PLANS = [
  ['pacote1', 'Pacote 1', base, 'Operacional, comercial, financeiro essencial e administracao'],
  ['pacote2', 'Pacote 2', package2, 'Pacote 1 com financeiro completo, WhatsApp, DP, juridico, estrategia e CRM'],
  ['pacote_contador', 'Pacote Contador', [...package2, ...byGroup('Contabil e Fiscal')], 'Acesso completo aos modulos']
];

const unique = (values) => [...new Set(values)];

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('access_modules', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(80), allowNull: false, unique: true },
        route: { type: Sequelize.STRING(255), allowNull: false, unique: true },
        label: { type: Sequelize.STRING(160), allowNull: false },
        group_name: { type: Sequelize.STRING(120), allowNull: false },
        active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction });

      await queryInterface.createTable('access_plans', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(60), allowNull: false, unique: true },
        name: { type: Sequelize.STRING(120), allowNull: false },
        description: { type: Sequelize.TEXT },
        active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction });

      await queryInterface.createTable('access_plan_versions', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        plan_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'access_plans', key: 'id' },
          onDelete: 'CASCADE'
        },
        version: { type: Sequelize.INTEGER, allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction });
      await queryInterface.addConstraint('access_plan_versions', {
        fields: ['plan_id', 'version'],
        type: 'unique',
        name: 'access_plan_versions_plan_version_uk',
        transaction
      });

      await queryInterface.createTable('access_plan_version_modules', {
        version_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          references: { model: 'access_plan_versions', key: 'id' },
          onDelete: 'CASCADE'
        },
        module_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          references: { model: 'access_modules', key: 'id' },
          onDelete: 'CASCADE'
        }
      }, { transaction });

      await queryInterface.createTable('empresa_access_profiles', {
        empresa_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          references: { model: 'empresas', key: 'id' },
          onDelete: 'CASCADE'
        },
        plan_version_id: {
          type: Sequelize.INTEGER,
          references: { model: 'access_plan_versions', key: 'id' },
          onDelete: 'SET NULL'
        },
        policy: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'CUSTOM' },
        version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        legacy_permissions_snapshot: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: false, defaultValue: [] },
        migrated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction });

      await queryInterface.createTable('empresa_access_overrides', {
        empresa_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          references: { model: 'empresas', key: 'id' },
          onDelete: 'CASCADE'
        },
        module_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          references: { model: 'access_modules', key: 'id' },
          onDelete: 'CASCADE'
        },
        enabled: { type: Sequelize.BOOLEAN, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction });

      await queryInterface.createTable('user_access_profiles', {
        user_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE'
        },
        mode: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'EXPLICIT' },
        legacy_permissions_snapshot: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: false, defaultValue: [] },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction });

      await queryInterface.createTable('access_audit_events', {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        empresa_id: { type: Sequelize.INTEGER, references: { model: 'empresas', key: 'id' }, onDelete: 'SET NULL' },
        user_id: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
        actor_user_id: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
        action: { type: Sequelize.STRING(100), allowNull: false },
        before_state: { type: Sequelize.JSONB },
        after_state: { type: Sequelize.JSONB },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction });

      for (const [code, route, label, groupName] of MODULES) {
        await queryInterface.sequelize.query(
          `INSERT INTO access_modules (code, route, label, group_name)
           VALUES (:code, :route, :label, :groupName)`,
          { replacements: { code, route, label, groupName }, transaction }
        );
      }

      for (const [code, name, legacyRoutes, description] of PLANS) {
        const [[plan]] = await queryInterface.sequelize.query(
          `INSERT INTO access_plans (code, name, description)
           VALUES (:code, :name, :description) RETURNING id`,
          { replacements: { code, name, description }, transaction }
        );
        for (const version of [1, 2, 3]) {
          const [[planVersion]] = await queryInterface.sequelize.query(
            `INSERT INTO access_plan_versions (plan_id, version) VALUES (:planId, :version) RETURNING id`,
            { replacements: { planId: plan.id, version }, transaction }
          );
          const routesBeforeSuppliers = legacyRoutes.filter((route) => route !== '/uikit/fornecedores');
          const routes = version === 1
            ? routesBeforeSuppliers
            : version === 2
              ? unique([...routesBeforeSuppliers, '/uikit/manifestos'])
              : unique([...legacyRoutes, '/uikit/manifestos']);
          await queryInterface.sequelize.query(
            `INSERT INTO access_plan_version_modules (version_id, module_id)
             SELECT :versionId, id FROM access_modules WHERE route IN (:routes)`,
            { replacements: { versionId: planVersion.id, routes }, transaction }
          );
        }
      }

      await queryInterface.sequelize.query(
        `INSERT INTO empresa_access_profiles
           (empresa_id, plan_version_id, policy, legacy_permissions_snapshot)
         SELECT e.id,
                CASE WHEN e.pacote IN ('pacote1', 'pacote2', 'pacote_contador')
                  THEN (SELECT apv.id
                        FROM access_plan_versions apv
                        JOIN access_plans ap ON ap.id = apv.plan_id
                        WHERE ap.code = e.pacote AND apv.version = 1)
                  ELSE NULL
                END,
                CASE WHEN e.pacote IN ('pacote1', 'pacote2', 'pacote_contador')
                  THEN 'AUTO_ADD' ELSE 'CUSTOM' END,
                COALESCE(e.permissoes, ARRAY[]::varchar[])
         FROM empresas e`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `INSERT INTO empresa_access_overrides (empresa_id, module_id, enabled)
         SELECT ep.empresa_id, am.id,
                CASE
                  WHEN ep.plan_version_id IS NULL THEN TRUE
                  WHEN current_routes.route IS NOT NULL THEN TRUE
                  ELSE FALSE
                END
         FROM empresa_access_profiles ep
         JOIN access_modules am ON (
           am.route = ANY(ep.legacy_permissions_snapshot)
           OR (
             ep.plan_version_id IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM access_plan_version_modules pvm
               WHERE pvm.version_id = ep.plan_version_id AND pvm.module_id = am.id
             )
           )
         )
         LEFT JOIN LATERAL (
           SELECT am.route WHERE am.route = ANY(ep.legacy_permissions_snapshot)
         ) current_routes ON TRUE
         WHERE ep.plan_version_id IS NULL
            OR (am.route = ANY(ep.legacy_permissions_snapshot)) <>
               EXISTS (
                 SELECT 1 FROM access_plan_version_modules pvm
                 WHERE pvm.version_id = ep.plan_version_id AND pvm.module_id = am.id
               )`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `INSERT INTO user_access_profiles (user_id, mode, legacy_permissions_snapshot)
         SELECT u.id,
                CASE
                  WHEN (u.tipo = 'EMPRESA' OR u.cargo IN ('Dono', 'Administrador', 'Gerente'))
                   AND (
                     SELECT COALESCE(array_agg(DISTINCT value ORDER BY value), ARRAY[]::varchar[])
                     FROM unnest(COALESCE(u.permissoes, ARRAY[]::varchar[])) value
                     WHERE value <> ALL(ARRAY[
                       'ponto:todos',
                       'planejamento:todos',
                       'agendamento:todos',
                       'senha:ver',
                       'caixa:pular_senha'
                     ]::varchar[])
                   ) = (
                     SELECT COALESCE(array_agg(DISTINCT value ORDER BY value), ARRAY[]::varchar[])
                     FROM unnest(COALESCE(e.permissoes, ARRAY[]::varchar[])) value
                   )
                  THEN 'INHERIT_COMPANY'
                  ELSE 'EXPLICIT'
                END,
                COALESCE(u.permissoes, ARRAY[]::varchar[])
         FROM users u
         LEFT JOIN empresas e ON e.id = u.empresa_id`,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const table of [
        'access_audit_events',
        'user_access_profiles',
        'empresa_access_overrides',
        'empresa_access_profiles',
        'access_plan_version_modules',
        'access_plan_versions',
        'access_plans',
        'access_modules'
      ]) {
        await queryInterface.dropTable(table, { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
