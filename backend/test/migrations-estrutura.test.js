import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(backendDir, 'migrations');

test('todas as migrations possuem up/down e nomes únicos', async () => {
  const arquivos = fs.readdirSync(migrationsDir).filter((nome) => nome.endsWith('.cjs')).sort();
  assert.ok(arquivos.length > 0);
  assert.equal(new Set(arquivos).size, arquivos.length);
  for (const arquivo of arquivos) {
    const migration = await import(`../migrations/${arquivo}`);
    assert.equal(typeof migration.default?.up, 'function', `${arquivo} sem up`);
    assert.equal(typeof migration.default?.down, 'function', `${arquivo} sem down`);
  }
});
