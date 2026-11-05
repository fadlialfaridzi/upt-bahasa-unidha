# Sistem Informasi Layanan UPT Bahasa
## Universitas Dharma Andalas

Website layanan UPT Bahasa yang mencakup:
- **Pendaftaran Tes TOEFL** — Lihat jadwal dan daftar tes online
- **Pelatihan TOEFL** — Daftar program pelatihan intensif
- **Jasa Penerjemahan Dokumen** — Ajukan penerjemahan dokumen resmi

### Kelompok 7
| No | Nama | NIM | Peran |
|----|------|-----|-------|
| 1 | Fadli Alfaridzi | 2311523003 | Project Manager |
| 2 | Siti Aliani Husnah.F | 2311522006 | Developer |
| 3 | Zakiya Aulia | 2311522029 | Developer |
| 4 | Muhammad Rafi Asytar | 2311522030 | Developer |
| 5 | Aisyah Insani Aulia | 2311523024 | Developer |

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Containerization | Docker + Docker Compose |
| CI/CD | GitHub Actions |

---

## Struktur Proyek

```
upt-bahasa-unidha/
├── frontend/          # React app (Vite)
│   ├── src/
│   │   ├── pages/     # Halaman: toefl, pelatihan, terjemahan, auth
│   │   ├── components/
│   │   ├── context/   # AuthContext
│   │   ├── services/  # Axios API client
│   │   └── hooks/
│   └── package.json
├── backend/           # Node.js + Express API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   └── index.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── package.json
└── README.md
```

---

## Cara Menjalankan Secara Lokal

### Prasyarat
- Node.js >= 18
- PostgreSQL (atau gunakan Docker)

### 1. Clone repository
```bash
git clone <url-repo>
cd upt-bahasa-unidha
```

### 2. Setup Backend
```bash
cd backend

# Install dependencies
npm install

# Salin file environment
cp .env.example .env
# Edit .env: isi DATABASE_URL, JWT_SECRET, dll

# Generate Prisma client & jalankan migrasi
npm run db:generate
npm run db:migrate

# Isi data awal (admin + contoh jadwal)
npm run db:seed

# Jalankan development server
npm run dev
```

Backend berjalan di: http://localhost:5000

### 3. Setup Frontend
```bash
cd frontend

# Install dependencies
npm install

# Salin file environment
cp .env.example .env

# Jalankan development server
npm run dev
```

Frontend berjalan di: http://localhost:5173

---

## API Endpoints

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/register` | Registrasi user baru |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/profile` | Profil user (auth) |

### Tes TOEFL
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/toefl/jadwal` | Daftar jadwal |
| GET | `/api/toefl/jadwal/:id` | Detail jadwal |
| POST | `/api/toefl/daftar` | Daftar tes (auth) |
| GET | `/api/toefl/my-pendaftaran` | Pendaftaran saya (auth) |

### Pelatihan
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/pelatihan` | Daftar pelatihan |
| POST | `/api/pelatihan/daftar` | Daftar pelatihan (auth) |
| GET | `/api/pelatihan/my-pelatihan` | Pelatihan saya (auth) |

### Terjemahan
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/terjemahan/ajukan` | Ajukan terjemahan (auth) |
| GET | `/api/terjemahan/my-terjemahan` | Pengajuan saya (auth) |

---

## Akun Default (setelah seed)
- **Email:** admin@uptbahasa.ac.id
- **Password:** admin123
