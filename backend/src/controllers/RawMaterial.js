import RawMaterialService from '../services/RawMaterial.js';

export const createRawMaterial = async (req, res) => {
  try {
    const rawMaterial = await RawMaterialService.create(req.body, req.user);
    res.status(201).json(rawMaterial);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getRawMaterials = async (req, res) => {
  try {
    const filters = {
      name: req.query.name
    };
    const rawMaterials = await RawMaterialService.getAll(filters, req.user);
    res.json(rawMaterials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getRawMaterialById = async (req, res) => {
  try {
    const rawMaterial = await RawMaterialService.getById(req.params.id, req.user);
    res.json(rawMaterial);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const updateRawMaterial = async (req, res) => {
  try {
    const rawMaterial = await RawMaterialService.update(req.params.id, req.body, req.user);
    res.json(rawMaterial);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteRawMaterial = async (req, res) => {
  try {
    await RawMaterialService.delete(req.params.id, req.user);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};