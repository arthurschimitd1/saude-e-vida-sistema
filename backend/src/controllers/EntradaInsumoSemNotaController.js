import entradaInsumoSemNotaService from '../services/EntradaInsumoSemNotaService.js';

export const registrarEntradaSemNota = async (req, res) => {
  try {
    const entrada = await entradaInsumoSemNotaService.registrar(
      req.params.id,
      req.body,
      req.user
    );
    res.status(201).json(entrada);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const listarEntradasSemNota = async (req, res) => {
  try {
    const historico = await entradaInsumoSemNotaService.listar(req.params.id, req.user);
    res.json(historico);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
