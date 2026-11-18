import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';

class CloudinaryService {
    getResourceType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        // Adicione 'pdf' aqui para ser tratado como image (resolve o problema de acesso)
        const imageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        const videoFormats = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'];
        if (imageFormats.includes(ext)) return 'image';
        if (videoFormats.includes(ext)) return 'video';
        return 'raw';
    }

    sanitizeFilename(filename) {
        const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
        return nameWithoutExt
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '') || 'file';
    }

    async uploadFile(buffer, filename, folder = 'lucromais') {
        const resourceType = this.getResourceType(filename);
        const ext = filename.split('.').pop().toLowerCase();
        const baseName = this.sanitizeFilename(filename);

        // Simplifica - remove a lógica especial para raw
        const publicIdName = `${baseName}_${Date.now()}`;


        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    public_id: publicIdName,
                    resource_type: resourceType
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            streamifier.createReadStream(buffer).pipe(uploadStream);
        });
    }

    async deleteFile(publicId, resourceType = 'image') {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true
        });
        if (result.result !== 'ok') {
            console.warn(`[Cloudinary] Falha ao deletar "${publicId}" (tipo: ${resourceType}):`, result.result);
        }
        return result;
    }

    // Método melhorado de download
    getDownloadUrl(publicId, filename, resourceType = null) {
        // Se não informou o tipo, tenta descobrir pelo nome do arquivo
        if (!resourceType && filename) {
            resourceType = this.getResourceType(filename);
        }
        // Se ainda assim não tem, usa 'image' como padrão
        if (!resourceType) {
            resourceType = 'image';
        }
        
        // console.log('📥 Gerando download:', { publicId, filename, resourceType });
        
        return cloudinary.url(publicId, {
            resource_type: resourceType,
            flags: 'attachment',
            attachment: filename
        });
    }

    // Mantém compatibilidade
    getAnexoUrl(publicId, filename) {
        const resourceType = this.getResourceType(filename || '');
        return this.getDownloadUrl(publicId, filename, resourceType);
    }
}

export default new CloudinaryService();
