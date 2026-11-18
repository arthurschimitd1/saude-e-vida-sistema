import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sequelize from '../src/config/database.js';

const tables = ['agendamento_servicos', 'venda_itens', 'comissoes'];
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDirectory = path.resolve('backups');
const outputPath = path.join(backupDirectory, `pre-comissoes-servicos-${timestamp}.json`);

try {
  const backup = {
    generatedAt: new Date().toISOString(),
    tables: {},
  };

  for (const table of tables) {
    const [schema] = await sequelize.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = :table
       ORDER BY ordinal_position`,
      { replacements: { table } }
    );
    const [rows] = await sequelize.query(`SELECT * FROM "${table}" ORDER BY id`);
    backup.tables[table] = { schema, rows };
  }

  const [migrationHistory] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
  backup.migrationHistory = migrationHistory;

  await fs.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  const content = `${JSON.stringify(backup, null, 2)}\n`;
  await fs.writeFile(outputPath, content, { mode: 0o600 });

  const parsed = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  const counts = Object.fromEntries(
    tables.map(table => [table, parsed.tables[table].rows.length])
  );
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');

  console.log(JSON.stringify({ outputPath, counts, sha256 }, null, 2));
} finally {
  await sequelize.close();
}
