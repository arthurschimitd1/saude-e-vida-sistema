import focusInvoiceService from '../../services/focus/FocusInvoiceService.js';
import fiscalStockImportService from '../../services/FiscalStockImportService.js';

const obterXmlNFe = async (empresaId, chave) => {
  const resultado = await focusInvoiceService.baixarXMLNFe(empresaId, chave);
  if (!resultado.success) {
    const error = new Error(resultado.error?.message || 'XML da NF-e não disponível');
    error.status = resultado.status || 502;
    throw error;
  }
  return Buffer.from(resultado.data.xml, 'base64').toString('utf8');
};

const usuarioDaEmpresaResolvida = req => (
  req.user?.tipo === 'MASTER'
    ? { ...req.user, empresa_id_override: Number(req.fiscalEmpresaId) }
    : req.user
);

class FocusStockImportController {
  async preview(req, res) {
    // Uma nova tentativa precisa consultar a Focus novamente. Sem isso o
    // navegador pode reaproveitar uma resposta 304 anterior e aparentar que
    // a nota continua indisponível mesmo após o XML ser liberado.
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    });

    try {
      const xml = await obterXmlNFe(req.params.empresaId, req.params.chave);
      const preview = await fiscalStockImportService.preview(xml, usuarioDaEmpresaResolvida(req));
      return res.json(preview);
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message });
    }
  }

  async apply(req, res) {
    try {
      const xml = await obterXmlNFe(req.params.empresaId, req.params.chave);
      const result = await fiscalStockImportService.apply(
        xml,
        req.body.decisions,
        usuarioDaEmpresaResolvida(req),
        'focus_received_nfe'
      );
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message });
    }
  }
}

export default new FocusStockImportController();
