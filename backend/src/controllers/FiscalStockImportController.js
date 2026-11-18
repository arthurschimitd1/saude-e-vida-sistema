import fiscalStockImportService from '../services/FiscalStockImportService.js';

const xmlDoUpload = req => {
  if (!req.file?.buffer) throw new Error('Selecione um arquivo XML');
  return req.file.buffer.toString('utf8');
};

export const previewUploadedInvoice = async (req, res) => {
  try {
    const preview = await fiscalStockImportService.preview(xmlDoUpload(req), req.user);
    return res.json(preview);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }
};

export const applyUploadedInvoice = async (req, res) => {
  try {
    let decisions;
    try {
      decisions = JSON.parse(req.body.decisions || '[]');
    } catch {
      return res.status(400).json({ error: 'As correspondências informadas são inválidas' });
    }
    const result = await fiscalStockImportService.apply(
      xmlDoUpload(req),
      decisions,
      req.user,
      'xml_upload'
    );
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }
};
