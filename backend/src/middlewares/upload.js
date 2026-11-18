import multer from 'multer';
import path from 'path';

const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/xml',
    'text/xml',
    'text/csv',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'
];

const allowedExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.xml', '.csv', '.txt', '.zip',
    '.jpg', '.jpeg', '.png', '.webp', '.gif'
];

const fileFilter = (req, file, cb) => {
    const extOk = allowedExtensions.includes(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedTypes.includes(file.mimetype);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido'));
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter
});

export const uploadSingle = upload.single('arquivo');
export const uploadMultiple = upload.fields([
    { name: 'arquivo', maxCount: 1 },
    ...Array.from({ length: 20 }, (_, i) => ({ name: `fotos_variacao_${i}`, maxCount: 10 }))
]);

// Upload específico para avatar de usuário (campo 'avatar', máximo 5MB)
const uploadAvatarMulter = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB para avatar
    fileFilter: (req, file, cb) => {
        const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        
        if (allowedImageExtensions.includes(ext) && allowedImageTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas (JPG, PNG, WebP, GIF)'));
        }
    }
});

export const uploadAvatar = uploadAvatarMulter.single('avatar');

const uploadMensagemMidiaMulter = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMidiaTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
            'application/pdf',
            'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm',
        ];
        if (allowedMidiaTypes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Tipo de mídia não permitido (use imagem, PDF ou áudio)'));
    }
});

export const uploadMensagemMidia = uploadMensagemMidiaMulter.single('midia');
