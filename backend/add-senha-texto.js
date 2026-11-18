import db from './src/config/database.js';

try {
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS senha_texto TEXT');
  console.log('✅ Coluna senha_texto adicionada com sucesso!');
} catch (e) {
  console.error('❌ Erro:', e.message);
} finally {
  process.exit(0);
}
