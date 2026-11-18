import cron from 'node-cron';
import focusService from '../services/focusService.js';

// Executa a cada 2 horas (respeitando o limite de 20 consultas/hora da Focus)
cron.schedule('0 */2 * * *', async () => {
  console.log('[Focus Sync] Iniciando busca automática de notas recebidas...');
  try {
    const results = await focusService.buscarParaTodasEmpresas();
    console.log('[Focus Sync] Resultados:', results);
  } catch (error) {
    console.error('[Focus Sync] Erro:', error);
  }
});

export default cron;