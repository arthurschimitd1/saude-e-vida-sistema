// // src/services/dominio/notaService.js
// import axios from 'axios';
// import FormData from 'form-data';
// import tokenService from './tokenService.js';
// import rateLimitService from './rateLimitService.js';
// import dominioConfig from '../../config/dominio.js';
// import ContadorCliente from '../../models/ContadorCliente.js';
// import NotaFiscalFocus from '../../models/NotaFiscalFocus.js';  // <-- novo modelo

// class NotaService {
//   /**
//    * Envia uma nota fiscal (XML) para a API Domínio.
//    * @param {number} notaId - ID da nota na tabela NotaFiscalFocus
//    */
//   async enviarNotaSync(notaId) {
//     // Busca a nota na tabela Focus (agora a origem única)
//     const nota = await NotaFiscalFocus.findByPk(notaId);
//     if (!nota) throw new Error('Nota não encontrada');
//     if (nota.enviado_para_dominio) return { message: 'Nota já enviada para Domínio.' };

//     // Verifica se a nota possui os campos de relacionamento (contador_id e empresa_cliente_id)
//     if (!nota.contador_id || !nota.empresa_cliente_id) {
//       throw new Error('Nota não está associada a um contador/cliente. Impossível enviar.');
//     }

//     // Busca a integrationKey através da associação contador ↔ cliente
//     const associacao = await ContadorCliente.findOne({
//       where: {
//         contador_id: nota.contador_id,
//         empresa_cliente_id: nota.empresa_cliente_id,
//         status: 'ativo'
//       }
//     });
//     if (!associacao || !associacao.integration_key) {
//       throw new Error('Integration key não encontrada para este cliente. Ative a integração primeiro.');
//     }

//     const integrationKey = associacao.integration_key;
//     const accessToken = await tokenService.getAccessToken();
//     await rateLimitService.checkAvailability(1);

//     // Prepara o formulário multipart para envio do XML
//     const form = new FormData();
//     form.append('file[]', nota.xml_content, {
//       filename: `${nota.chave_acesso}.xml`,
//       contentType: 'application/xml'
//     });
//     form.append('query', JSON.stringify({ boxeFile: false })); // false = sem BOX-e

//     const url = `${dominioConfig.apiBaseUrl}${dominioConfig.endpoints.sendInvoice}`;
//     const response = await axios.post(url, form, {
//       headers: {
//         ...form.getHeaders(),
//         'Authorization': `Bearer ${accessToken}`,
//         'x-integration-key': integrationKey
//       }
//     });

//     await rateLimitService.increment(1);

//     // Atualiza os campos da nota na tabela Focus
//     nota.enviado_para_dominio = true;
//     nota.data_envio_dominio = new Date();
//     nota.integration_key_usada = integrationKey;
//     nota.batch_id = response.data.id;          // se a API retornar um ID do lote
//     await nota.save();

//     return response.data;
//   }

//   /**
//    * Consulta o status de um lote (batch) já enviado.
//    * @param {string} batchId - ID do lote retornado pela API Domínio
//    * @param {string} integrationKey - Integration Key do cliente
//    */
//   async consultarStatus(batchId, integrationKey) {
//     const accessToken = await tokenService.getAccessToken();
//     await rateLimitService.checkAvailability(1);

//     const url = `${dominioConfig.apiBaseUrl}${dominioConfig.endpoints.batchStatus}${batchId}`;
//     const response = await axios.get(url, {
//       headers: {
//         'Authorization': `Bearer ${accessToken}`,
//         'x-integration-key': integrationKey
//       }
//     });

//     await rateLimitService.increment(1);
//     return response.data;
//   }

//   /**
//    * Agenda o envio de uma nota para a fila Bull (processamento assíncrono).
//    * @param {number} notaId - ID da nota na tabela NotaFiscalFocus
//    */
//   async agendarEnvio(notaId) {
//     // Verifica se a nota existe e ainda não foi enviada
//     const nota = await NotaFiscalFocus.findByPk(notaId);
//     if (!nota) throw new Error('Nota não encontrada');
//     if (nota.enviado_para_dominio) throw new Error('Nota já enviada');

//     const Queue = require('bull');
//     const sendQueue = new Queue('sendXmlToDominio', process.env.REDIS_URL);
//     await sendQueue.add({ notaId });
//     return { message: 'Nota agendada para envio.' };
//   }
// }

// export default new NotaService();