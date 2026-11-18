import NotaFiscalEmitida from '../models/NotaFiscalEmitida.js';
import FocusNFeService from '../services/focus/FocusNFeService.js';
import { verifyPublicNfeToken } from '../utils/publicNfeLink.js';

function statusPermiteConsulta(status) {
  return ['autorizado', 'cancelado'].includes(String(status || '').toLowerCase());
}

export const visualizarDANFEPublico = async (req, res) => {
  try {
    const { notaId } = verifyPublicNfeToken(req.params.token);
    const nota = await NotaFiscalEmitida.findOne({
      where: { id: notaId, tipo: 'NFE' }
    });

    if (!nota || !statusPermiteConsulta(nota.status)) {
      return res.status(404).json({ error: 'NF-e autorizada não encontrada.' });
    }

    if (!nota.pdf_url) {
      return res.status(404).json({ error: 'DANFE ainda não está disponível.' });
    }

    const pdf = await FocusNFeService.baixarArquivo(
      nota.empresa_id,
      nota.pdf_url,
      'arraybuffer'
    );

    const numero = String(nota.numero || nota.id).replace(/[^a-zA-Z0-9_-]/g, '');
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `inline; filename="nfe-${numero}.pdf"`)
      .setHeader('Cache-Control', 'private, no-store')
      .send(Buffer.from(pdf));
  } catch (error) {
    const tokenError = ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error?.name);
    if (tokenError) {
      return res.status(404).json({ error: 'Link da NF-e inválido ou expirado.' });
    }

    console.error('Erro ao abrir DANFE público da NF-e:', error);
    return res.status(404).json({ error: 'Não foi possível abrir o DANFE da NF-e.' });
  }
};
