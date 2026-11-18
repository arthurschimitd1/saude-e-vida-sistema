// // src/controllers/dominioNotaController.js
// import { Op } from 'sequelize';
// import NotaFiscalFocus from '../models/NotaFiscalFocus.js';
// import ContadorCliente from '../models/ContadorCliente.js';
// import focusService from '../services/focusService.js';
// import sendQueue from '../jobs/sendXmlToDominio.js';

// /**
//  * Lista notas disponíveis para o contador logado
//  * Apenas notas não enviadas, com XML, das empresas que ele atende
//  */
// export const listarNotas = async (req, res) => {
//   try {
//     const contadorId = req.user.id;

//     // Obter lista de clientes (empresas) que este contador atende
//     const clientesAssociados = await ContadorCliente.findAll({
//       where: { contador_id: contadorId, status: 'ativo' },
//       attributes: ['empresa_cliente_id']
//     });
//     const idsClientes = clientesAssociados.map(c => c.empresa_cliente_id);

//     if (idsClientes.length === 0) {
//       return res.json([]);
//     }

//     const notas = await NotaFiscalFocus.findAll({
//       where: {
//         empresa_id: { [Op.in]: idsClientes },
//         enviado_para_dominio: false,
//         xml_content: { [Op.ne]: null }
//       },
//       order: [['data_emissao', 'DESC']]
//     });
//     res.json(notas);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// /**
//  * Envia uma nota específica para a fila de processamento da Domínio
//  */
// export const enviarNota = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const nota = await NotaFiscalFocus.findByPk(id);
//     if (!nota) return res.status(404).json({ error: 'Nota não encontrada' });
//     if (nota.enviado_para_dominio) return res.status(400).json({ error: 'Nota já enviada' });

//     // A empresa cliente é a própria empresa dona da nota
//     const empresaClienteId = nota.empresa_id;
//     const contadorId = req.user.id;

//     // Verifica se o contador atende essa empresa
//     const associacao = await ContadorCliente.findOne({
//       where: {
//         contador_id: contadorId,
//         empresa_cliente_id: empresaClienteId,
//         status: 'ativo'
//       }
//     });
//     if (!associacao) {
//       return res.status(403).json({ error: 'Você não tem permissão para enviar notas desta empresa' });
//     }

//     // Adiciona à fila Bull para processamento assíncrono
//     await sendQueue.add({ notaId: id, contadorId, empresaClienteId });
//     res.json({ message: 'Nota enviada para a fila de processamento.' });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// /**
//  * Consulta o status de envio de uma nota para a Domínio
//  */
// export const consultarStatusNota = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const nota = await NotaFiscalFocus.findByPk(id);
//     if (!nota) return res.status(404).json({ error: 'Nota não encontrada' });
//     res.json({
//       id: nota.id,
//       enviado_para_dominio: nota.enviado_para_dominio,
//       data_envio_dominio: nota.data_envio_dominio,
//       integration_key_usada: nota.integration_key_usada,
//       chave_acesso: nota.chave_acesso,
//       batch_id: nota.batch_id
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// /**
//  * Força a sincronização manual das notas da Focus NFe (apenas usuários MASTER)
//  */
// export const sincronizarManual = async (req, res) => {
//   try {
//     if (req.user.tipo !== 'MASTER') {
//       return res.status(403).json({ error: 'Apenas usuários MASTER podem executar esta ação.' });
//     }
//     const result = await focusService.buscarParaTodasEmpresas();
//     res.json(result);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };