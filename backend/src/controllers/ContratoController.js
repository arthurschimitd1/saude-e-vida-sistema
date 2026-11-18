import contratoService from '../services/ContratoService.js';
import ApiResponse from '../utils/apiResponse.js';
import CloudinaryService from '../utils/CloudinaryService.js';
import cloudinary from '../config/cloudinary.js'

// Detecta resource_type a partir da URL do Cloudinary
const getResourceTypeFromUrl = (url) => {
    if (!url) return 'raw';
    if (url.includes('/image/upload/')) return 'image';
    if (url.includes('/video/upload/')) return 'video';
    return 'raw';
};

class ContratoController {

    async create(req, res, next) {
        try {
            let anexoData = {};
            if (req.file) {
                // Validação adicional
                if (req.file.mimetype !== 'application/pdf') {
                    throw { status: 400, message: 'Apenas arquivos PDF são permitidos' };
                }
                
                // Verifica tamanho (máximo 10MB por exemplo)
                if (req.file.size > 10 * 1024 * 1024) {
                    throw { status: 400, message: 'Arquivo muito grande. Máximo 10MB' };
                }

                const result = await CloudinaryService.uploadFile(
                    req.file.buffer,
                    req.file.originalname,
                    'lucromais/contratos'
                );
                anexoData = { pdf_url: result.secure_url, anexo_public_id: result.public_id };
            }
            const contrato = await contratoService.createContrato({ ...req.body, ...anexoData }, req.user);
            new ApiResponse(res).success(201, contrato, 'Contrato criado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async getAll(req, res, next) {
        try {
            const contratos = await contratoService.getAllContratos(req.query, req.user);
            new ApiResponse(res).success(200, contratos);
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const contrato = await contratoService.getContratoById(req.params.id, req.user);
            new ApiResponse(res).success(200, contrato);
        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {
        try {
            let anexoData = {};
            if (req.file) {
                // Deleta o anexo anterior do Cloudinary antes de subir o novo
                const contratoAtual = await contratoService.getContratoById(req.params.id, req.user);
                if (contratoAtual.anexo_public_id) {
                    const resourceType = getResourceTypeFromUrl(contratoAtual.pdf_url);
                    await CloudinaryService.deleteFile(contratoAtual.anexo_public_id, resourceType);
                }
                const result = await CloudinaryService.uploadFile(
                    req.file.buffer,
                    req.file.originalname,
                    'lucromais/contratos'
                );
                anexoData = { pdf_url: result.secure_url, anexo_public_id: result.public_id };
            }
            const contrato = await contratoService.updateContrato(req.params.id, { ...req.body, ...anexoData }, req.user);
            new ApiResponse(res).success(200, contrato, 'Contrato atualizado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {
        try {
            const contrato = await contratoService.getContratoById(req.params.id, req.user);
            if (contrato.anexo_public_id) {
                const resourceType = getResourceTypeFromUrl(contrato.pdf_url);
                await CloudinaryService.deleteFile(contrato.anexo_public_id, resourceType);
            }
            await contrato.destroy();
            new ApiResponse(res).success(200, null, 'Contrato deletado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async getHistorico(req, res, next) {
        try {
            const historico = await contratoService.getHistorico(req.params.id, req.user);
            new ApiResponse(res).success(200, historico);
        } catch (error) {
            next(error);
        }
    }

    async downloadAnexo(req, res) {
        try {
            const { id } = req.params;
            const contrato = await contratoService.getContratoById(id, req.user);
            
            if (!contrato.anexo_public_id) {
                return res.status(404).json({ message: 'Anexo não encontrado' });
            }
            
            // Gera a URL de download do Cloudinary
            const url = CloudinaryService.getDownloadUrl(
                contrato.anexo_public_id, 
                contrato.titulo
            );
            
            // 🔥 Baixa o PDF do Cloudinary e envia direto pro frontend
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Falha ao baixar arquivo do Cloudinary');
            }
            
            const buffer = await response.arrayBuffer();
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${contrato.titulo}.pdf"`);
            res.send(Buffer.from(buffer));
            
        } catch (error) {
            console.error('Erro no download:', error);
            return res.status(500).json({ message: error.message });
        }
    }
}

export default new ContratoController();
