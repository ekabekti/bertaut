# Backend BERTAUT

API + penyaji berkas `frontend/`. Node.js ≥ 18 + `jose` (verifikasi JWT Keycloak).

## Menjalankan

```sh
npm install --prefix backend
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
| `KEYCLOAK_ISSUER` | _(kosong=SSO mati)_ | Issuer realm, cth. `http://localhost:8080/realms/bertaut` |
| `KEYCLOAK_CLIENT_ID` | `bertaut` | Client ID di Keycloak |
| `KEYCLOAK_CLIENT_SECRET` | _(kosong)_ | Secret bila client confidential |
| `KEYCLOAK_REDIRECT_URI` | `http://localhost:3000/auth/sso/callback` | Harus terdaftar di Keycloak |
| `KEYCLOAK_SCOPES` | `openid profile email` | Scope OIDC |
| `BERTAUT_ADMIN_ROLES` | `bertaut-admin,admin` | Role (realm/client) yang boleh Kelola |

## SSO Keycloak (hibrida + role-based)

- Login lokal (`admin/...`) tetap aktif. Bila `KEYCLOAK_ISSUER` + `CLIENT_ID` diisi, tombol **Masuk dengan SSO** muncul di kartu login.
- Alur: `GET /auth/sso/login` → Keycloak → `GET /auth/sso/callback?code&state` → tukar code → verifikasi `id_token` via JWKS (`jose`) → cek `realm_access.roles` + `resource_access[client].roles` → terbitkan token BERTAUT (`#sso_token=...`).
- `GET /api/me` mengembalikan `{ user, sso, roles, canManage }`. Tulis (`POST/PUT/DELETE /api/apps`, dst.) wajib `canManage=true`, selain itu `403`.
- Akun SSO tanpa peran pengelola tetap bisa melihat etalase publik, tapi tombol Kelola tersembunyi.
- Logout SSO: `GET /auth/sso/logout` (hapus token lokal + redirect ke `end_session_endpoint`).

Setup Keycloak minimal:
1. Realm baru (cth. `bertaut`), client `bertaut` (Standard flow ON, PKCE off bila pakai secret).
2. Valid redirect URI: `http://localhost:3000/auth/sso/callback`.
3. Buat role `bertaut-admin` (realm atau client), assign ke user pengelola.
4. Isi `.env` dari `.env.example`, restart backend.

## API

Publik: `GET /api/health`, `GET /api/apps`, `GET /api/auth/config`,
`POST /api/apps/:id/visit`.
Pengelola (header `Authorization: Bearer <token>`):
`POST /api/login`, `GET /api/me`, `POST /api/apps`,
`PUT /api/apps/:id`, `DELETE /api/apps/:id`,
`POST /api/apps/replace`, `POST /api/apps/reset`,
`POST /api/creds`, `GET /api/export`.

Data tersimpan di `backend/data/bertaut.json`
(sandi dalam bentuk hash scrypt, bukan teks polos).
