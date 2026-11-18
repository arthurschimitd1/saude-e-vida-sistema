// // src/services/dominio/rateLimitService.js
// import redis from '../../config/redis.js';
// import DominioRequestLog from '../../models/DominioRequestLog.js';
// import { Op } from 'sequelize';

// class RateLimitService {
//   // Obtém o contador atual (Redis ou banco)
//   async getCurrentCount() {
//     const today = new Date().toISOString().slice(0, 10);
//     const redisKey = `dominio:requests:${today}`;
//     let count = await redis.get(redisKey);
//     if (count !== null) return parseInt(count);

//     // Fallback para banco de dados (caso Redis seja reiniciado)
//     const record = await DominioRequestLog.findOne({ where: { data: today } });
//     count = record ? record.total_requests : 0;
//     await redis.set(redisKey, count, 'EX', 86400);
//     return count;
//   }

//   // Verifica se podemos fazer N requisições
//   async checkAvailability(required = 1) {
//     const current = await this.getCurrentCount();
//     const max = process.env.DOMINIO_MAX_REQUESTS_PER_DAY || 40;
//     if (current + required > max) {
//       throw new Error(`Limite diário de ${max} requisições excedido. Tente amanhã.`);
//     }
//     return true;
//   }

//   // Incrementa o contador (após chamada bem-sucedida)
//   async increment(amount = 1) {
//     const today = new Date().toISOString().slice(0, 10);
//     const redisKey = `dominio:requests:${today}`;
//     const newCount = await redis.incrby(redisKey, amount);
//     if (newCount === amount) {
//       await redis.expire(redisKey, 86400);
//     }
//     // Atualiza banco assincronamente (sem阻塞)
//     DominioRequestLog.upsert({
//       data: today,
//       total_requests: newCount
//     }).catch(console.error);
//     return newCount;
//   }
// }

// export default new RateLimitService();