// // src/controllers/dominioClienteController.js
// import clienteService from '../services/dominio/clienteService.js';
// import ContadorCliente from '../models/ContadorCliente.js';

// export const listarClientesDoContador = async (req, res) => {
//   try {
//     const contadorId = req.user.id; // após auth middleware
//     const clientes = await ContadorCliente.findAll({
//       where: { contador_id: contadorId },
//       include: [{ association: 'empresa_cliente', attributes: ['id', 'nome_fantasia', 'cnpj'] }]
//     });
//     res.json(clientes);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// export const ativarCliente = async (req, res) => {
//   try {
//     const { empresa_cliente_id, chave_contador } = req.body;
//     const contadorId = req.user.id;
//     const result = await clienteService.ativarCliente(contadorId, empresa_cliente_id, chave_contador);
//     res.json(result);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// export const atualizarChaveContador = async (req, res) => {
//   // permite editar a chave_contador manualmente
//   const { id } = req.params;
//   const { chave_contador } = req.body;
//   const contadorId = req.user.id;
//   const registro = await ContadorCliente.findOne({ where: { id, contador_id: contadorId } });
//   if (!registro) return res.status(404).json({ error: 'Cliente não encontrado' });
//   registro.chave_contador = chave_contador;
//   registro.status = 'pendente'; // precisa reativar
//   await registro.save();
//   res.json(registro);
// };