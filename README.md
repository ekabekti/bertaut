# ◈ BERTAUT — Beranda Aplikasi & Tautan Terpadu

```
menu/
├── frontend/      # Etalase (publik) — index.html, styles.css, app.js
│   └── README.md
├── backend/       # API + data terpusat — server.js (nol dependensi)
│   ├── README.md
│   └── data/      # dibuat otomatis saat server pertama dijalankan
└── index.html     # pengalih ke frontend/ (untuk klik-dua-kali)
```

## Dua cara memakai

**A. Pribadi, tanpa install** — klik dua kali `index.html`.
Moda lokal: dinding login + data di `localStorage` peramban.

**B. Publik berjaringan** — jalankan backend, etalase terbuka untuk semua:

```sh
node backend/server.js
# buka http://localhost:3000
```

Pengunjung melihat & membuka aplikasi tanpa login.
Pengelola menekan **Masuk** (`admin` / `bertaut123` — ganti via Pengaturan
atau `BERTAUT_ADMIN_PASS`) untuk tambah/ubah/hapus/mengimpor.

Rincian: `frontend/README.md` dan `backend/README.md`.
