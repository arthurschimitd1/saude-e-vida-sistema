import app from './app.js';
import { bootstrapDomFerrazAssinaturas } from './services/AssinaturaImportacaoService.js';
import { runMigrationsOnStart } from '../scripts/run-migrations-on-start.mjs';
import { setMigrationState } from './config/migrationState.js';

const PORT = process.env.PORT || 3001;
const isProductionDeployment = process.env.VERCEL_ENV === 'production'
  || (process.env.VERCEL === '1' && process.env.NODE_ENV === 'production');

if (isProductionDeployment) {
  try {
    const migrations = await runMigrationsOnStart();
    console.log('[Migrations] estado:', migrations);
  } catch (error) {
    setMigrationState({ status: 'ERRO', erro: error.message, aplicadas: [] });
    console.error('[Migrations] falha crítica; versão não será iniciada:', error.message);
    process.exit(1);
  }
  try {
    const result = await bootstrapDomFerrazAssinaturas();
    console.log('[AppBarber] carga Dom Ferraz:', result);
  } catch (error) {
    console.error('[AppBarber] carga Dom Ferraz não concluída:', error.message);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

export default app;
