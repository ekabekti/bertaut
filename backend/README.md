# Backend BERTAUT

API + penyaji berkas `frontend/`. Nol dependensi — hanya Node.js ≥ 18.

## Menjalankan

```sh
node backend/server.js
# atau
npm start --prefix backend
```

Buka `http://localhost:3000` — etalase langsung tampil publik
(tanpa login). Pengelola menekan **Masuk**, sisanya terkunci token.

Variabel lingkungan (lihat `.env.example`):

| Nama | Bawaan | Guna |
| --- | --- | --- |
| `PORT` | `3000` | Port dengar |
| `BERTAUT_ADMIN_USER` | `admin` | Nama pengelola awal |
| `BERTAUT_ADMIN_PASS` | `bertaut123` | Sandi awal (ganti di produksi!) |
| `BERTAUT_DATA_DIR` | `backend/data` | Lokasi berkas data |
| `TOKEN_TTL_HOURS` | `12` | Umur token masuk |

## API

Publik: `GET /api/health`, `GET /api/apps`,
`POST /api/apps/:id/visit`.
Pengelola (header `Authorization: Bearer <token>`):
`POST /api/login`, `GET /api/me`, `POST /api/apps`,
`PUT /api/apps/:id`, `DELETE /api/apps/:id`,
`POST /api/apps/replace`, `POST /api/apps/reset`,
`POST /api/creds`, `GET /api/export`.

Data tersimpan di `backend/data/bertaut.json`
(sandi dalam bentuk hash scrypt, bukan teks polos).
