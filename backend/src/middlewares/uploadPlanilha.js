import multer from 'multer';

const ALLOWED_EXT = ['.xlsx', '.xls', '.csv'];

function fileFilter(req, file, cb) {
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
        return cb(new Error('Formato inválido. Envie um arquivo .xlsx, .xls ou .csv'));
    }
    cb(null, true);
}

export default multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});
