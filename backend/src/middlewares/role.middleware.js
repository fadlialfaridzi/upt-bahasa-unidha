// Batasi akses berdasarkan role aktif di token (setelah `authenticate`).
// Contoh: router.use(authenticate, authorizeRole('pengajar'))
export const authorizeRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Akses ditolak untuk peran Anda' });
  }
  next();
};
