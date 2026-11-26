import multer from 'multer';
import fs from 'fs';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file PDF dan Word (.doc, .docx) yang diperbolehkan'), false);
  }
};

const privateResultStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destination = path.join('private_uploads', 'terjemahan-hasil');
    fs.mkdir(destination, { recursive: true }, (error) => cb(error, destination));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const privateResultUploader = multer({
  storage: privateResultStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadHasilTerjemahan = (req, res, next) => {
  privateResultUploader.single('hasil')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        message: error.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran file hasil maksimal 10 MB'
          : error.message,
      });
    }
    if (error.message === 'Hanya file PDF dan Word (.doc, .docx) yang diperbolehkan') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  });
};

const filterBukti = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (JPG, PNG, WebP) atau PDF bukti pembayaran yang diperbolehkan'), false);
  }
};

const filterMateri = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.zip', '.rar', '.jpg', '.jpeg', '.png', '.mp3', '.mp4'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Format file materi tidak didukung (gunakan PDF, Word, PPT, Audio/Video, Gambar, atau ZIP)'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const uploadBukti = multer({
  storage,
  fileFilter: filterBukti,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const uploadMateri = multer({
  storage,
  fileFilter: filterMateri,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});
