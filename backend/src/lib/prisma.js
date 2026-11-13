import { PrismaClient } from '@prisma/client';

// Satu instance PrismaClient untuk seluruh aplikasi (hindari membuat koneksi baru di tiap controller).
const prisma = new PrismaClient();

export default prisma;
