import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Sequelize } from 'sequelize';
import sequelize from '../src/config/database.js';
import { setMigrationState } from '../src/config/migrationState.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function runMigrationsOnStart() {
  const queryInterface = sequelize.getQueryInterface();
  await sequelize.query('CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" VARCHAR(255) NOT NULL PRIMARY KEY)');
  const [appliedRows] = await sequelize.query('SELECT "name" FROM "SequelizeMeta" ORDER BY "name"');
  const applied = new Set(appliedRows.map((row) => row.name));
  const files = (await fs.readdir(path.join(ROOT, 'migrations')))
    .filter((file) => file.endsWith('.cjs'))
    .sort();
  const pending = files.filter((file) => !applied.has(file));
  const executed = [];
  for (const file of pending) {
    const loaded = await import(pathToFileURL(path.join(ROOT, 'migrations', file)).href);
    const migration = loaded.default || loaded;
    if (typeof migration.up !== 'function') throw new Error(`Migration ${file} não possui up()`);
    await migration.up(queryInterface, Sequelize);
    await sequelize.query('INSERT INTO "SequelizeMeta" ("name") VALUES (:name) ON CONFLICT ("name") DO NOTHING', { replacements: { name: file } });
    executed.push(file);
  }
  const result = { status: 'OK', total: files.length, executadasAntes: applied.size, aplicadas: executed };
  setMigrationState(result);
  return result;
}
