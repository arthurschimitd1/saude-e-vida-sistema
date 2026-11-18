// // src/services/dominio/tokenService.js
// import axios from 'axios';
// import redis from '../../config/redis.js';
// import dominioConfig from '../../config/dominio.js';
// import rateLimitService from './rateLimitService.js';

// class TokenService {
//   async getAccessToken() {
//     // Tenta obter do cache Redis
//     const cached = await redis.get('dominio:access_token');
//     if (cached) return cached;

//     // Verifica se temos 1 requisição disponível para gerar token
//     await rateLimitService.checkAvailability(1);

//     // Gera novo token
//     const params = new URLSearchParams();
//     params.append('grant_type', 'client_credentials');
//     params.append('client_id', dominioConfig.clientId);
//     params.append('client_secret', dominioConfig.clientSecret);
//     params.append('audience', dominioConfig.audience);

//     const response = await axios.post(dominioConfig.authUrl, params, {
//       headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
//     });

//     const accessToken = response.data.access_token;
//     const expiresIn = response.data.expires_in || 86400; // 24h

//     // Armazena em Redis com TTL (expira um pouco antes para segurança)
//     await redis.setex('dominio:access_token', expiresIn - 300, accessToken);
//     await rateLimitService.increment(1);

//     return accessToken;
//   }

//   // Método para invalidar token (se necessário)
//   async invalidate() {
//     await redis.del('dominio:access_token');
//   }
// }

// export default new TokenService();