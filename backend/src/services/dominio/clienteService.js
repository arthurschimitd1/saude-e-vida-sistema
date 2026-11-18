// // src/services/dominio/clienteService.js
// import axios from 'axios';
// import tokenService from './tokenService.js';
// import rateLimitService from './rateLimitService.js';
// import dominioConfig from '../../config/dominio.js';
// import ContadorCliente from '../../models/ContadorCliente.js';

// class ClienteService {
//   // Valida se a chave do contador pertence ao CNPJ e retorna dados do escritório
//   async validarChaveContador(chaveContador) {
//     const accessToken = await tokenService.getAccessToken();
//     await rateLimitService.checkAvailability(1); // reserva 1 requisição para o GET

//     const url = `${dominioConfig.apiBaseUrl}${dominioConfig.endpoints.activationInfo}`;
//     const response = await axios.get(url, {
//       headers: {
//         'Authorization': `Bearer ${accessToken}`,
//         'x-integration-key': chaveContador
//       }
//     });
//     await rateLimitService.increment(1);
//     return response.data; // contém nome_escritorio, nome_cliente, cnpj
//   }

//   // Gera integrationKey a partir da chave do contador
//   async gerarIntegrationKey(chaveContador) {
//     const accessToken = await tokenService.getAccessToken();
//     await rateLimitService.checkAvailability(1);

//     const url = `${dominioConfig.apiBaseUrl}${dominioConfig.endpoints.activationEnable}`;
//     const response = await axios.post(url, {}, {
//       headers: {
//         'Authorization': `Bearer ${accessToken}`,
//         'x-integration-key': chaveContador
//       }
//     });
//     await rateLimitService.increment(1);
//     return response.data.integrationKey; // integrationKey gerada
//   }

//   // Ativa um cliente (valida + gera) e salva no banco
//   async ativarCliente(contadorId, empresaClienteId, chaveContador) {
//     // Primeiro valida
//     const validacao = await this.validarChaveContador(chaveContador);
//     // Gera integration key
//     const integrationKey = await this.gerarIntegrationKey(chaveContador);
    
//     // Salva ou atualiza no banco
//     const [registro, created] = await ContadorCliente.findOrCreate({
//       where: {
//         contador_id: contadorId,
//         empresa_cliente_id: empresaClienteId
//       },
//       defaults: {
//         chave_contador: chaveContador,
//         integration_key: integrationKey,
//         status: 'ativo'
//       }
//     });
//     if (!created) {
//       registro.chave_contador = chaveContador;
//       registro.integration_key = integrationKey;
//       registro.status = 'ativo';
//       await registro.save();
//     }
//     return { registro, dadosValidacao: validacao };
//   }
// }

// export default new ClienteService();