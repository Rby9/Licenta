const { HttpError } = require('./errors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
function createUploads() {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename:    (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `hotel_${req.params.id || 'nou'}_${Date.now()}${ext}`);
        },
    });
    const upload = multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
            allowed.includes(path.extname(file.originalname).toLowerCase())
                ? cb(null, true) : cb(new HttpError(400, 'Doar JPG, PNG sau WEBP.'));
        },
    });
    const uploadGalerie = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, uploadsDir),
            filename: (req, file, cb) => {
                const ext = path.extname(file.originalname).toLowerCase();
                cb(null, `galerie_${req.params.id}_${Date.now()}_${Math.random().toString(36).slice(2,6)}${ext}`);
            },
        }),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
            allowed.includes(path.extname(file.originalname).toLowerCase())
                ? cb(null, true) : cb(new HttpError(400, 'Doar JPG, PNG sau WEBP.'));
        },
    });


    return { uploadsDir, upload, uploadGalerie };
}
module.exports = { createUploads };
