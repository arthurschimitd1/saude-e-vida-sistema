// src/controllers/EmpresaConfigFiscalController.js
import EmpresaConfigFiscalService from '../services/EmpresaConfigFiscalService.js';

export const getConfig = async (req, res) => {
  try {
    const { empresa_id } = req.params;
    const config = await EmpresaConfigFiscalService.getByEmpresa(empresa_id, req.user);
    res.json(config || {});
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
};

export const saveConfig = async (req, res) => {
  try {
    const { empresa_id } = req.params;
    const config = await EmpresaConfigFiscalService.createOrUpdate(empresa_id, req.body, req.user);
    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};