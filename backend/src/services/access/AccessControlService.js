import sequelize from '../../config/database.js';
import {
  ACCESS_MODULES,
  ACCESS_PLANS,
  CENTRAL_GESTAO_ROUTE,
  INTERNAL_ACCESS_FLAGS,
  computeAutoAddRoutes,
  computeCompanyRoutes,
  computeUserRoutes,
  inferUserAccessMode,
  normalizeAccessRoutes,
  splitInternalFlags
} from '../../access/accessCatalog.js';

const relationMissing = (error) => error?.original?.code === '42P01' || error?.parent?.code === '42P01';
const latestStaticPlan = (code) => ACCESS_PLANS.find((plan) => plan.code === code);
const incluirVisaoGeral = (permissions = []) => normalizeAccessRoutes([
  ...permissions,
  CENTRAL_GESTAO_ROUTE
]);

class AccessControlService {
  async hasVersionedSchema(transaction) {
    const [result] = await sequelize.query(
      `SELECT
         to_regclass('public.empresa_access_profiles') IS NOT NULL
         AND to_regclass('public.user_access_profiles') IS NOT NULL AS available`,
      { type: sequelize.QueryTypes.SELECT, transaction }
    );
    return result?.available === true;
  }

  async listPlans() {
    try {
      const rows = await sequelize.query(
        `SELECT ap.code, ap.name, ap.description, apv.id AS version_id, apv.version,
                COALESCE(array_agg(am.route ORDER BY am.route)
                  FILTER (WHERE am.route IS NOT NULL), ARRAY[]::varchar[]) AS routes
         FROM access_plans ap
         JOIN LATERAL (
           SELECT * FROM access_plan_versions
           WHERE plan_id = ap.id AND status = 'ACTIVE'
           ORDER BY version DESC LIMIT 1
         ) apv ON TRUE
         LEFT JOIN access_plan_version_modules pvm ON pvm.version_id = apv.id
         LEFT JOIN access_modules am ON am.id = pvm.module_id AND am.active = TRUE
         WHERE ap.active = TRUE
         GROUP BY ap.id, ap.code, ap.name, ap.description, apv.id, apv.version
         ORDER BY ap.id`,
        { type: sequelize.QueryTypes.SELECT }
      );
      return rows;
    } catch (error) {
      if (!relationMissing(error)) throw error;
      return ACCESS_PLANS.map((plan) => ({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        version: plan.version,
        routes: plan.routes,
        source: 'legacy-fallback'
      }));
    }
  }

  async getCompanyAccess(empresaId, { transaction } = {}) {
    try {
      const [profile] = await sequelize.query(
        `SELECT ep.empresa_id, ep.policy, ep.version AS profile_version,
                ap.code AS plan_code, ap.name AS plan_name, apv.id AS plan_version_id,
                apv.version AS plan_version,
                COALESCE(array_agg(DISTINCT pm.route ORDER BY pm.route)
                  FILTER (WHERE pm.route IS NOT NULL), ARRAY[]::varchar[]) AS plan_routes
         FROM empresa_access_profiles ep
         JOIN empresas e ON e.id = ep.empresa_id
         LEFT JOIN access_plan_versions apv ON apv.id = ep.plan_version_id
         LEFT JOIN access_plans ap ON ap.id = apv.plan_id
         LEFT JOIN access_plan_version_modules pvm ON pvm.version_id = apv.id
         LEFT JOIN access_modules pm ON pm.id = pvm.module_id AND pm.active = TRUE
         WHERE ep.empresa_id = :empresaId
         GROUP BY ep.empresa_id, ep.policy, ep.version, ap.code, ap.name, apv.id, apv.version, e.permissoes`,
        { replacements: { empresaId }, type: sequelize.QueryTypes.SELECT, transaction }
      );

      if (!profile) return this.getLegacyCompanyAccess(empresaId, transaction);

      const overrides = await sequelize.query(
        `SELECT am.route, eo.enabled
         FROM empresa_access_overrides eo
         JOIN access_modules am ON am.id = eo.module_id AND am.active = TRUE
         WHERE eo.empresa_id = :empresaId`,
        { replacements: { empresaId }, type: sequelize.QueryTypes.SELECT, transaction }
      );
      const registeredRoutes = new Set(ACCESS_MODULES.map((module) => module.route));
      const [company] = await sequelize.query(
        'SELECT permissoes FROM empresas WHERE id = :empresaId',
        { replacements: { empresaId }, type: sequelize.QueryTypes.SELECT, transaction }
      );
      const legacyUnknownRoutes = normalizeAccessRoutes(company?.permissoes)
        .filter((route) => !registeredRoutes.has(route));
      const permissions = incluirVisaoGeral(profile.policy === 'CUSTOM'
        ? normalizeAccessRoutes(company?.permissoes)
        : normalizeAccessRoutes([
          ...computeCompanyRoutes(profile.plan_routes, overrides),
          ...legacyUnknownRoutes
        ]));
      return { ...profile, permissions, modules: permissions, source: 'versioned' };
    } catch (error) {
      if (!relationMissing(error)) throw error;
      return this.getLegacyCompanyAccess(empresaId, transaction);
    }
  }

  async getLegacyCompanyAccess(empresaId, transaction) {
    const [company] = await sequelize.query(
      'SELECT id, pacote, permissoes FROM empresas WHERE id = :empresaId',
      { replacements: { empresaId }, type: sequelize.QueryTypes.SELECT, transaction }
    );
    if (!company) return null;
    return {
      empresa_id: company.id,
      plan_code: company.pacote,
      policy: company.pacote === 'personalizado' ? 'CUSTOM' : 'LEGACY',
      permissions: incluirVisaoGeral(company.permissoes),
      modules: incluirVisaoGeral(company.permissoes),
      source: 'legacy'
    };
  }

  async getRolePermissions(empresaId, cargo, transaction) {
    if (!empresaId || !cargo) return [];
    try {
      const [company] = await sequelize.query(
        'SELECT cargos FROM empresas WHERE id = :empresaId',
        { replacements: { empresaId }, type: sequelize.QueryTypes.SELECT, transaction }
      );
      const roles = Array.isArray(company?.cargos) ? company.cargos : [];
      const role = roles.find((item) => item?.nome === cargo);
      return normalizeAccessRoutes(role?.permissoes ?? []);
    } catch (error) {
      if (!relationMissing(error)) throw error;
      return [];
    }
  }

  async getUserEffectiveAccess(userOrId, { transaction } = {}) {
    const user = typeof userOrId === 'object'
      ? userOrId
      : (await sequelize.query(
        'SELECT id, empresa_id, tipo, cargo, permissoes FROM users WHERE id = :id',
        { replacements: { id: userOrId }, type: sequelize.QueryTypes.SELECT, transaction }
      ))[0];
    if (!user) return null;
    if (user.tipo === 'MASTER' || !user.empresa_id) {
      return { userId: user.id, mode: 'MASTER', permissions: user.permissoes ?? [], source: 'legacy' };
    }

    const company = await this.getCompanyAccess(user.empresa_id, { transaction });
    let mode;
    try {
      const [profile] = await sequelize.query(
        'SELECT mode FROM user_access_profiles WHERE user_id = :userId',
        { replacements: { userId: user.id }, type: sequelize.QueryTypes.SELECT, transaction }
      );
      mode = profile?.mode;
    } catch (error) {
      if (!relationMissing(error)) throw error;
    }
    mode ??= inferUserAccessMode({
      companyPermissions: company?.permissions,
      userPermissions: user.permissoes,
      tipo: user.tipo,
      cargo: user.cargo
    });
    // O cargo é a base do acesso do usuário. As permissões individuais são
    // somadas a ele para que alterações feitas no cargo apareçam imediatamente
    // no perfil, inclusive para usuários antigos que ficaram com um snapshot
    // individual desatualizado.
    const rolePermissions = await this.getRolePermissions(user.empresa_id, user.cargo, transaction);
    const effectiveUserPermissions = normalizeAccessRoutes([
      ...rolePermissions,
      ...(user.permissoes ?? [])
    ]);
    return {
      userId: user.id,
      empresaId: user.empresa_id,
      mode,
      permissions: computeUserRoutes({
        companyRoutes: company?.permissions,
        userPermissions: effectiveUserPermissions,
        mode
      }),
      company,
      source: company?.source === 'versioned' ? 'versioned' : 'legacy'
    };
  }

  async initializeCompanyProfile({
    empresaId,
    planCode,
    permissions = [],
    actorUserId = null,
    useLatest = true,
    transaction
  }) {
    if (!(await this.hasVersionedSchema(transaction))) return false;
    try {
      const plan = planCode && planCode !== 'personalizado'
        ? await this.findPlanVersion(planCode, useLatest ? null : 1, transaction)
        : null;
      await sequelize.query(
        `INSERT INTO empresa_access_profiles
           (empresa_id, plan_version_id, policy, legacy_permissions_snapshot)
         VALUES ($empresaId, $planVersionId, $policy, $permissions)
         ON CONFLICT (empresa_id) DO NOTHING`,
        {
          bind: {
            empresaId,
            planVersionId: plan?.id ?? null,
            policy: plan ? 'AUTO_ADD' : 'CUSTOM',
            permissions: normalizeAccessRoutes(permissions)
          },
          transaction
        }
      );
      await this.replaceOverrides(empresaId, plan?.routes ?? [], incluirVisaoGeral(permissions), transaction);
      await this.audit({
        empresaId,
        actorUserId,
        action: 'COMPANY_PROFILE_INITIALIZED',
        afterState: { planCode: planCode ?? 'personalizado', permissions }
      }, transaction);
      return true;
    } catch (error) {
      if (relationMissing(error)) return false;
      throw error;
    }
  }

  async initializeUserProfile(userId, mode, permissions = [], transaction) {
    if (!(await this.hasVersionedSchema(transaction))) return false;
    try {
      await sequelize.query(
        `INSERT INTO user_access_profiles
           (user_id, mode, legacy_permissions_snapshot, created_at, updated_at)
         VALUES ($userId, $mode, $permissions, NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        {
          bind: { userId, mode, permissions: normalizeAccessRoutes(permissions) },
          transaction
        }
      );
      return true;
    } catch (error) {
      if (relationMissing(error)) return false;
      throw error;
    }
  }

  async markUserExplicit(userId, permissions, transaction) {
    if (!(await this.hasVersionedSchema(transaction))) return false;
    try {
      await sequelize.query(
        `INSERT INTO user_access_profiles
           (user_id, mode, legacy_permissions_snapshot, created_at, updated_at)
         VALUES ($userId, 'EXPLICIT', $permissions, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET mode = 'EXPLICIT', updated_at = NOW()`,
        { bind: { userId, permissions: normalizeAccessRoutes(permissions) }, transaction }
      );
      return true;
    } catch (error) {
      if (relationMissing(error)) return false;
      throw error;
    }
  }

  async updateCompanyPlan({
    empresaId,
    planCode,
    customRoutes = [],
    policy = 'AUTO_ADD',
    actorUserId = null,
    expectedVersion
  }) {
    const transaction = await sequelize.transaction();
    try {
      const [locked] = await sequelize.query(
        `SELECT e.id, e.permissoes, e.pacote, ep.version
         FROM empresas e
         LEFT JOIN empresa_access_profiles ep ON ep.empresa_id = e.id
         WHERE e.id = :empresaId FOR UPDATE OF e`,
        { replacements: { empresaId }, type: sequelize.QueryTypes.SELECT, transaction }
      );
      if (!locked) throw Object.assign(new Error('Empresa nao encontrada'), { status: 404 });
      if (expectedVersion != null && locked.version != null && Number(expectedVersion) !== Number(locked.version)) {
        throw Object.assign(new Error('Os acessos foram alterados por outra pessoa. Recarregue e tente novamente.'), { status: 409 });
      }

      const plan = planCode && planCode !== 'personalizado'
        ? await this.findPlanVersion(planCode, null, transaction)
        : null;
      if (planCode !== 'personalizado' && !plan) {
        throw Object.assign(new Error('Pacote de acesso nao encontrado'), { status: 400 });
      }
      const permissions = incluirVisaoGeral(plan ? plan.routes : customRoutes)
        .filter((route) => ACCESS_MODULES.some((module) => module.route === route));
      if (!permissions.length) {
        throw Object.assign(new Error('Selecione ao menos um modulo'), { status: 400 });
      }

      await sequelize.query(
        `INSERT INTO empresa_access_profiles
           (empresa_id, plan_version_id, policy, version, legacy_permissions_snapshot)
         VALUES ($empresaId, $planVersionId, $policy, 1, $snapshot)
         ON CONFLICT (empresa_id) DO UPDATE SET
           plan_version_id = EXCLUDED.plan_version_id,
           policy = EXCLUDED.policy,
           version = empresa_access_profiles.version + 1,
           updated_at = NOW()`,
        {
          bind: {
            empresaId,
            planVersionId: plan?.id ?? null,
            policy: plan ? policy : 'CUSTOM',
            snapshot: normalizeAccessRoutes(locked.permissoes)
          },
          transaction
        }
      );
      await this.replaceOverrides(empresaId, plan?.routes ?? [], permissions, transaction);
      await sequelize.query(
        'UPDATE empresas SET permissoes = $permissions, pacote = $package WHERE id = $empresaId',
        {
          bind: {
            permissions,
            package: plan ? planCode : 'personalizado',
            empresaId
          },
          transaction
        }
      );
      await this.refreshInheritedCompanyUsers(empresaId, permissions, transaction);
      await this.audit({
        empresaId,
        actorUserId,
        action: 'COMPANY_PLAN_CHANGED',
        beforeState: { package: locked.pacote, permissions: locked.permissoes },
        afterState: { package: plan ? planCode : 'personalizado', policy, permissions }
      }, transaction);
      await transaction.commit();
      return this.getCompanyAccess(empresaId);
    } catch (error) {
      await transaction.rollback();
      if (relationMissing(error)) {
        const permissions = incluirVisaoGeral(
          planCode === 'personalizado' ? customRoutes : latestStaticPlan(planCode)?.routes
        );
        await sequelize.query(
          'UPDATE empresas SET permissoes = $permissions, pacote = $package WHERE id = $empresaId',
          { bind: { permissions, package: planCode, empresaId } }
        );
        return this.getLegacyCompanyAccess(empresaId);
      }
      throw error;
    }
  }

  async synchronizePlans({ dryRun = true, actorUserId = null } = {}) {
    try {
      const profiles = await sequelize.query(
        `SELECT ep.empresa_id, ep.plan_version_id, ap.code AS plan_code
         FROM empresa_access_profiles ep
         JOIN access_plan_versions apv ON apv.id = ep.plan_version_id
         JOIN access_plans ap ON ap.id = apv.plan_id
         WHERE ep.policy = 'AUTO_ADD'`,
        { type: sequelize.QueryTypes.SELECT }
      );
      const changes = [];
      for (const profile of profiles) {
        const current = await this.getCompanyAccess(profile.empresa_id);
        const latest = await this.findPlanVersion(profile.plan_code);
        const next = computeAutoAddRoutes(current.permissions, latest.routes);
        const added = next.filter((route) => !current.permissions.includes(route));
        if (added.length) changes.push({ empresaId: profile.empresa_id, planCode: profile.plan_code, added });
      }
      if (dryRun) return { dryRun: true, count: changes.length, changes };

      for (const change of changes) {
        const transaction = await sequelize.transaction();
        try {
          const current = await this.getCompanyAccess(change.empresaId, { transaction });
          const latest = await this.findPlanVersion(change.planCode, null, transaction);
          const next = computeAutoAddRoutes(current.permissions, latest.routes);
          await sequelize.query(
            `UPDATE empresa_access_profiles
             SET plan_version_id = :versionId, version = version + 1, updated_at = NOW()
             WHERE empresa_id = :empresaId`,
            { replacements: { versionId: latest.id, empresaId: change.empresaId }, transaction }
          );
          await this.replaceOverrides(change.empresaId, latest.routes, next, transaction);
          await sequelize.query(
            'UPDATE empresas SET permissoes = $permissions WHERE id = $empresaId',
            { bind: { permissions: next, empresaId: change.empresaId }, transaction }
          );
          await this.refreshInheritedCompanyUsers(change.empresaId, next, transaction);
          await this.audit({
            empresaId: change.empresaId,
            actorUserId,
            action: 'PLAN_AUTO_ADD_SYNC',
            beforeState: { permissions: current.permissions },
            afterState: { permissions: next, added: change.added }
          }, transaction);
          await transaction.commit();
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }
      return { dryRun: false, count: changes.length, changes };
    } catch (error) {
      if (relationMissing(error)) return { dryRun, count: 0, changes: [], source: 'legacy-fallback' };
      throw error;
    }
  }

  async applyRoleChanges(empresaId, cargos = [], actorUserId = null) {
    const transaction = await sequelize.transaction();
    try {
      const company = await this.getCompanyAccess(empresaId, { transaction });
      const users = await sequelize.query(
        `SELECT u.id, u.cargo, u.permissoes, up.mode
         FROM users u
         LEFT JOIN user_access_profiles up ON up.user_id = u.id
         WHERE u.empresa_id = :empresaId
           AND (u.tipo IS NULL OR u.tipo <> 'MASTER')`,
        { replacements: { empresaId }, type: sequelize.QueryTypes.SELECT, transaction }
      );
      for (const user of users) {
        const role = cargos.find((item) => item.nome === user.cargo);
        if (!role) continue;
        const { flags, routes: individualRoutes } = splitInternalFlags(user.permissoes);
        const permissions = computeUserRoutes({
          companyRoutes: company.permissions,
          userPermissions: [
            ...(role.permissoes ?? []),
            ...(user.mode === 'EXPLICIT' ? individualRoutes : []),
            ...flags
          ],
          mode: 'INHERIT_ROLE'
        });
        await sequelize.query(
          'UPDATE users SET permissoes = $permissions, updated_at = NOW() WHERE id = $userId',
          { bind: { permissions, userId: user.id }, transaction }
        );
      }
      await this.audit({
        empresaId,
        actorUserId,
        action: 'ROLE_ACCESS_CHANGED',
        afterState: { roles: cargos.map((role) => role.nome), inheritedUsersUpdated: users.length }
      }, transaction);
      await transaction.commit();
      return { updatedUsers: users.length };
    } catch (error) {
      await transaction.rollback();
      if (relationMissing(error)) return { updatedUsers: 0, source: 'legacy-fallback' };
      throw error;
    }
  }

  async findPlanVersion(planCode, version = null, transaction) {
    const rows = await sequelize.query(
      `SELECT apv.id, apv.version,
              COALESCE(array_agg(am.route ORDER BY am.route)
                FILTER (WHERE am.route IS NOT NULL), ARRAY[]::varchar[]) AS routes
       FROM access_plans ap
       JOIN access_plan_versions apv ON apv.plan_id = ap.id AND apv.status = 'ACTIVE'
       LEFT JOIN access_plan_version_modules pvm ON pvm.version_id = apv.id
       LEFT JOIN access_modules am ON am.id = pvm.module_id AND am.active = TRUE
       WHERE ap.code = :planCode
         AND (CAST(:version AS integer) IS NULL OR apv.version = :version)
       GROUP BY apv.id, apv.version
       ORDER BY apv.version DESC LIMIT 1`,
      { replacements: { planCode, version }, type: sequelize.QueryTypes.SELECT, transaction }
    );
    return rows[0] ?? null;
  }

  async replaceOverrides(empresaId, planRoutes, desiredRoutes, transaction) {
    const plan = new Set(normalizeAccessRoutes(planRoutes));
    const desired = new Set(normalizeAccessRoutes(desiredRoutes));
    await sequelize.query(
      'DELETE FROM empresa_access_overrides WHERE empresa_id = :empresaId',
      { replacements: { empresaId }, transaction }
    );
    const differences = ACCESS_MODULES
      .filter((module) => plan.has(module.route) !== desired.has(module.route))
      .map((module) => ({ route: module.route, enabled: desired.has(module.route) }));
    for (const difference of differences) {
      await sequelize.query(
        `INSERT INTO empresa_access_overrides (empresa_id, module_id, enabled)
         SELECT :empresaId, id, :enabled FROM access_modules WHERE route = :route`,
        { replacements: { empresaId, ...difference }, transaction }
      );
    }
  }

  async refreshInheritedCompanyUsers(empresaId, companyPermissions, transaction) {
    const users = await sequelize.query(
      `SELECT u.id, u.permissoes
       FROM users u
       JOIN user_access_profiles up ON up.user_id = u.id AND up.mode = 'INHERIT_COMPANY'
       WHERE u.empresa_id = :empresaId`,
      { replacements: { empresaId }, type: sequelize.QueryTypes.SELECT, transaction }
    );
    for (const user of users) {
      const flags = normalizeAccessRoutes(user.permissoes)
        .filter((permission) => INTERNAL_ACCESS_FLAGS.includes(permission));
      await sequelize.query(
        'UPDATE users SET permissoes = $permissions, updated_at = NOW() WHERE id = $userId',
        {
          bind: {
            permissions: normalizeAccessRoutes([...companyPermissions, ...flags]),
            userId: user.id
          },
          transaction
        }
      );
    }
  }

  async audit({
    empresaId,
    userId = null,
    actorUserId = null,
    action,
    beforeState = null,
    afterState = null
  }, transaction) {
    await sequelize.query(
      `INSERT INTO access_audit_events
         (empresa_id, user_id, actor_user_id, action, before_state, after_state)
       VALUES (:empresaId, :userId, :actorUserId, :action, :beforeState::jsonb, :afterState::jsonb)`,
      {
        replacements: {
          empresaId,
          userId,
          actorUserId,
          action,
          beforeState: beforeState == null ? null : JSON.stringify(beforeState),
          afterState: afterState == null ? null : JSON.stringify(afterState)
        },
        transaction
      }
    );
  }
}

export default new AccessControlService();
