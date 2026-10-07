# BERTAUT Next.js (Vercel-ready)

App Router + SQLite lokal (`@libsql/client` file) + JWT stateless (`jose`).
SSO Keycloak hibrida + role-based, parity dengan `backend/` lama.

## Jalankan lokal

```sh
cd web
cp .env.example .env   # isi AUTH_SECRET acak ≥32 char
npm install
npm run dev            # http://localhost:3000
```

DB lokal: `web/data/bertaut.db` (auto-seed 8 aplikasi + admin dari env).
Login awal: `admin` / `bertaut123` (atau isi `BERTAUT_ADMIN_*`).

## Deploy Vercel

- **Root Directory = `web`**, Framework = Next.js (auto), Node ≥ 18.
- **Environment Variables** (Project → Settings → Variables):

| Nama | Wajib | Contoh |
| --- | --- | --- |
| `AUTH_SECRET` | ya | string acak ≥32 char |
| `BERTAUT_ADMIN_USER` / `BERTAUT_ADMIN_PASS` | ya (awal) | `admin` / sandi kuat |
| `TOKEN_TTL_HOURS` | tidak | `12` |
| `KEYCLOAK_ISSUER` | bila SSO | `https://sso.domain/realms/bertaut` |
| `KEYCLOAK_CLIENT_ID` / `KEYCLOAK_CLIENT_SECRET` | bila SSO | `bertaut` / secret |
| `KEYCLOAK_REDIRECT_URI` | kosongkan | auto `<origin>/api/auth/sso/callback` |
| `BERTAUT_ADMIN_ROLES` | bila SSO | `bertaut-admin,admin` |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | **ya di prod** | `libsql://xxx.turso.io` |

> Tanpa `TURSO_*`, Vercel pakai SQLite file yang **ephemeral** (reset tiap deploy/instance).
> Untuk data persisten di Vercel: buat DB gratis di turso.tech, isi 2 var di atas, redeploy.

Keycloak: Valid redirect URI = `https://<domain-vercel>/api/auth/sso/callback`,
buat role `bertaut-admin`, assign ke pengelola.

## API (sama dgn backend lama, base path `/api`)

Publik: `GET /api/health`, `GET /api/apps`, `GET /api/auth/config`, `POST /api/apps/:id/visit`.
Login: `POST /api/login` (lokal), `GET /api/auth/sso/login` → Keycloak → `/api/auth/sso/callback` → redirect `/#sso_token=...`.
Pengelola (`Authorization: Bearer <JWT>` + `canManage`): `GET /api/me`, CRUD `/api/apps`, `/replace`, `/reset`, `/api/creds`, `/api/export`, `GET /api/auth/sso/logout`.
