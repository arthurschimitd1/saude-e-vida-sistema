// // src/jobs/sendXmlToDominio.js
// import Bull from 'bull';
// import redisConfig from '../config/redis.js';
// import notaService from '../services/dominio/notaService.js';

// const sendQueue = new Bull('sendXmlToDominio', {
//   redis: redisConfig.options
// });

// sendQueue.process(async (job) => {
//   const { notaId } = job.data;
//   try {
//     await notaService.enviarNotaSync(notaId);
//   } catch (error) {
//     console.error(`Erro ao enviar nota ${notaId}:`, error);
//     // Você pode marcar a nota como 'falha' e gravar mensagem de erro
//     const Nota = (await import('../models/NotaFiscalDominio.js')).default;
//     await Nota.update(
//       { status_envio: 'falha', mensagem_erro: error.message },
//       { where: { id: notaId } }
//     );
//     throw error; // Bull irá tentar novamente
//   }
// });

// export default sendQueue;