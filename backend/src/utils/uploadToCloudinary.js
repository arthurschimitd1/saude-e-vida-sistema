import CloudinaryService from './CloudinaryService.js';

export async function uploadToCloudinary(file, folder) {
    if (!file) return null;
    const result = await CloudinaryService.uploadFile(file.buffer, file.originalname, folder);
    return result.secure_url;
}