import ProcuracaoService from '../services/ProcuracaoService.js';
import CloudinaryService from '../utils/CloudinaryService.js';

const getResourceTypeFromUrl = (url) => {
    if (!url) return 'raw';
    if (url.includes('/image/upload/')) return 'image';
    if (url.includes('/video/upload/')) return 'video';
    return 'raw';
};

const getAll = async (req, res) => {
    try {
        const empresa_id = req.user?.empresa_id_override ?? req.user?.empresa_id;
        const filters = {
            status: req.query.status || null,
            tipo: req.query.tipo || null,
            cliente_id: req.query.cliente_id || null
        };
        const data = await ProcuracaoService.getAll(empresa_id, filters);
        res.json({ success: true, data });
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || 'Erro interno' });
    }
};

const getById = async (req, res) => {
    try {
        const empresa_id = req.user?.empresa_id_override ?? req.user?.empresa_id;
        const data = await ProcuracaoService.getById(req.params.id, empresa_id);
        res.json({ success: true, data });
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || 'Erro interno' });
    }
};

const create = async (req, res) => {
    try {
        let anexoData = {};
        if (req.file) {
            const result = await CloudinaryService.uploadFile(
                req.file.buffer,
                req.file.originalname,
                'lucromais/procuracoes'
            );
            anexoData = { anexo_url: result.secure_url, anexo_public_id: result.public_id };
        }
        const data = await ProcuracaoService.create({ ...req.body, ...anexoData }, req.user);
        res.status(201).json({ success: true, data });
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || 'Erro interno' });
    }
};

const update = async (req, res) => {
    try {
        let anexoData = {};
        if (req.file) {
            const empresa_id = req.user?.empresa_id_override ?? req.user?.empresa_id;
            const atual = await ProcuracaoService.getById(req.params.id, empresa_id);
            if (atual.anexo_public_id) {
                const resourceType = getResourceTypeFromUrl(atual.anexo_url);
                await CloudinaryService.deleteFile(atual.anexo_public_id, resourceType);
            }
            const result = await CloudinaryService.uploadFile(
                req.file.buffer,
                req.file.originalname,
                'lucromais/procuracoes'
            );
            anexoData = { anexo_url: result.secure_url, anexo_public_id: result.public_id };
        }
        const data = await ProcuracaoService.update(req.params.id, { ...req.body, ...anexoData }, req.user);
        res.json({ success: true, data });
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || 'Erro interno' });
    }
};

const revogar = async (req, res) => {
    try {
        const data = await ProcuracaoService.revogar(req.params.id, req.body, req.user);
        res.json({ success: true, data });
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || 'Erro interno' });
    }
};

const deleteProcuracao = async (req, res) => {
    try {
        const empresa_id = req.user?.empresa_id_override ?? req.user?.empresa_id;
        const atual = await ProcuracaoService.getById(req.params.id, empresa_id);
        if (atual.anexo_public_id) {
            const resourceType = getResourceTypeFromUrl(atual.anexo_url);
            await CloudinaryService.deleteFile(atual.anexo_public_id, resourceType);
        }
        await ProcuracaoService.delete(req.params.id, req.user);
        res.json({ success: true, message: 'Procuração excluída' });
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message || 'Erro interno' });
    }
};

const downloadAnexo = async (req, res, next) => {
    try {
        const empresa_id = req.user?.empresa_id_override ?? req.user?.empresa_id;
        const procuracao = await ProcuracaoService.getById(req.params.id, empresa_id);
        if (!procuracao.anexo_url) return res.status(404).json({ message: 'Procuração sem anexo' });

        const credentials = Buffer.from(
            `${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`
        ).toString('base64');

        const response = await fetch(procuracao.anexo_url, {
            headers: { 'Authorization': `Basic ${credentials}` }
        });

        const buffer = await response.arrayBuffer();
        const nomeArquivo = `procuracao_${(procuracao.numero_referencia || procuracao.id)}.pdf`;

        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.send(Buffer.from(buffer));
    } catch (e) {
        next(e);
    }
};

export default { getAll, getById, create, update, revogar, deleteProcuracao, downloadAnexo };