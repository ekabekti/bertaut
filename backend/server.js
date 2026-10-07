/* BERTAUT backend — API + penyaji frontend + SSO Keycloak (OIDC).
 * Jalankan:  node backend/server.js   (atau: npm start --prefix backend)
 * Buka:      http://localhost:3000  (atau sesuai PORT)
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* muat .env sederhana (tanpa dependensi) */
(function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch (e) { /* abaikan */ }
})();

const PORT = +(process.env.PORT || 3000);
const DATA_DIR = process.env.BERTAUT_DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "bertaut.json");
const TTL_MS = (+(process.env.TOKEN_TTL_HOURS || 12)) * 3600e3;
const FRONT_DIR = path.join(__dirname, "..", "frontend");

/* ---------- SSO Keycloak (OIDC) ---------- */
const SSO_ISSUER = (process.env.KEYCLOAK_ISSUER || "").replace(/\/$/, ""); // cth. http://localhost:8080/realms/bertaut
const SSO_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "";
const SSO_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || "";
const SSO_REDIRECT_URI = process.env.KEYCLOAK_REDIRECT_URI || `http://localhost:${PORT}/auth/sso/callback`;
const SSO_SCOPES = process.env.KEYCLOAK_SCOPES || "openid profile email";
const SSO_ADMIN_ROLES = (process.env.BERTAUT_ADMIN_ROLES || "bertaut-admin,admin")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SSO_ENABLED = !!(SSO_ISSUER && SSO_CLIENT_ID);
const ssoStates = new Map(); // state -> { exp, nonce }
let discoveryCache = null;
let discoveryAt = 0;

const CATS = ["Kepegawaian", "Kinerja", "Administrasi", "Keuangan", "Kesehatan", "Lainnya"];
const ACCENTS = ["gold", "teal", "clay", "sage", "ink"];
const GLYPHS = ["◈", "⬢", "◎", "▲", "✦", "▣"];

const SEED = [
  { id: "myasn", name: "MyASN BKN", url: "https://myasn.bkn.go.id", desc: "Layanan mandiri ASN — profil, riwayat jabatan, SK & data pribadi.", cat: "Kepegawaian", accent: "gold", glyph: "◈", pin: true },
  { id: "siasn", name: "SIASN BKN", url: "https://siasn.bkn.go.id", desc: "Sistem Informasi ASN terpusat — layanan administrasi kepegawaian.", cat: "Kepegawaian", accent: "teal", glyph: "⬢", pin: true },
  { id: "ekin", name: "e-Kinerja BKN", url: "https://ekinerja.bkn.go.id", desc: "Perencanaan & penilaian kinerja harian hingga SKP tahunan.", cat: "Kinerja", accent: "clay", glyph: "▲", pin: true },
  { id: "srikandi", name: "Srikandi Arsip", url: "https://srikandi.arsip.go.id", desc: "Surat-menyurat dinas & kearsipan elektronik terintegrasi.", cat: "Administrasi", accent: "sage", glyph: "▣", pin: false },
  { id: "coretax", name: "Coretax DJP", url: "https://coretaxdjp.pajak.go.id", desc: "Administrasi perpajakan — e-Filing, e-Billing & profil Wajib Pajak.", cat: "Keuangan", accent: "ink", glyph: "◎", pin: false },
  { id: "taspen", name: "Taspen & e-Klim", url: "https://www.taspen.co.id", desc: "Tabungan pensiun, klaim manfaat & layanan kesejahteraan ASN.", cat: "Keuangan", accent: "gold", glyph: "✦", pin: false },
  { id: "edabu", name: "e-Dabu BPJS Kesehatan", url: "https://edabu.bpjs-kesehatan.go.id", desc: "Kepesertaan JKN-KIS — cek status, iuran & badan usaha.", cat: "Kesehatan", accent: "teal", glyph: "◎", pin: false },
  { id: "lapor", name: "LAPOR! SPAN", url: "https://www.lapor.go.id", desc: "Kanal aspirasi & pengaduan pelayanan publik nasional.", cat: "Administrasi", accent: "clay", glyph: "⬢", pin: false },
];

/* ---------- penyimpanan ---------- */
function blankApp(s) {
  return { id: s.id, name: s.name, url: s.url, desc: s.desc || "", cat: s.cat, accent: s.accent, glyph: s.glyph, pin: !!s.pin, visits: 0, lastOpen: null };
}
function hashPass(pass, salt) {
  return crypto.scryptSync(String(pass), salt, 64).toString("hex");
}
function loadStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const d = JSON.parse(raw);
    if (d && d.admin && Array.isArray(d.apps)) return d;
  } catch (e) { /* belum ada / rusak → seed */ }
  const adminUser = process.env.BERTAUT_ADMIN_USER || "admin";
  const adminPass = process.env.BERTAUT_ADMIN_PASS || "bertaut123";
  const salt = crypto.randomBytes(16).toString("hex");
  const d = {
    admin: { user: adminUser, salt, hash: hashPass(adminPass, salt) },
    apps: SEED.map(blankApp),
    visitsTotal: 0,
  };
  saveStore(d);
  if (!process.env.BERTAUT_ADMIN_PASS) {
    console.warn("[bertaut] memakai kata sandi admin bawaan — atur BERTAUT_ADMIN_PASS atau ganti via Pengaturan.");
  }
  return d;
}
function saveStore(d) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
}
let store = loadStore();
const tokens = new Map(); // token -> { user, exp }
const loginHits = new Map(); // ip -> [timestamp]

/* ---------- util ---------- */
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...SEC,
  });
  res.end(body);
}
const SEC = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
function readBody(req, limit = 262144) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks = [];
    req.on("data", (c) => { n += c.length; if (n > limit) { reject(new Error("Muatan terlalu besar")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(new Error("JSON tidak valid")); } });
    req.on("error", reject);
  });
}
function bearer(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer (.+)$/.exec(h);
  if (!m) return null;
  const t = tokens.get(m[1]);
  if (!t || t.exp < Date.now()) { tokens.delete(m[1]); return null; }
  return t;
}
function needAdmin(req, res) {
  const t = bearer(req);
  if (!t) { send(res, 401, { error: "Perlu masuk sebagai pengelola." }); return null; }
  // Token lokal lama (tanpa flag) tetap dianggap pengelola demi kompatibilitas.
  // Token SSO hanya lolos bila canManage === true (role admin terpenuhi).
  const canManage = (t.canManage !== undefined) ? !!t.canManage : true;
  if (!canManage) { send(res, 403, { error: "Akun SSO Anda tidak punya peran pengelola." }); return null; }
  return t;
}
function cleanApp(a) {
  if (!a || typeof a !== "object") return { error: "Data aplikasi tidak valid." };
  const name = String(a.name || "").trim().slice(0, 48);
  let url = String(a.url || "").trim().slice(0, 300);
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("x");
  } catch (e) { return { error: "Tautan tidak valid — awali dengan https://" }; }
  if (name.length < 2) return { error: "Nama aplikasi minimal 2 huruf." };
  const desc = String(a.desc || "").trim().slice(0, 120);
  const cat = CATS.includes(a.cat) ? a.cat : "Lainnya";
  const accent = ACCENTS.includes(a.accent) ? a.accent : "gold";
  const glyph = GLYPHS.includes(a.glyph) ? a.glyph : "◈";
  return { app: { name, url, desc, cat, accent, glyph, pin: !!a.pin } };
}

/* ---------- SSO helpers ---------- */
function redirect(res, location) {
  res.writeHead(302, { Location: location, ...SEC });
  res.end("mengalihkan…");
}
async function getDiscovery() {
  if (!SSO_ENABLED) throw new Error("SSO belum dikonfigurasi (KEYCLOAK_ISSUER/CLIENT_ID kosong).");
  const now = Date.now();
  if (discoveryCache && now - discoveryAt < 10 * 60e3) return discoveryCache;
  const wellKnown = SSO_ISSUER + "/.well-known/openid-configuration";
  const r = await fetch(wellKnown, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("Gagal memuat OIDC discovery (" + r.status + ") dari " + wellKnown);
  const j = await r.json();
  if (!j.authorization_endpoint || !j.token_endpoint || !j.jwks_uri) throw new Error("Discovery OIDC tidak lengkap.");
  discoveryCache = j; discoveryAt = now;
  return j;
}
function extractRoles(payload) {
  const roles = new Set();
  try {
    const realm = (payload.realm_access && payload.realm_access.roles) || [];
    for (const r of realm) roles.add(String(r));
    const res = payload.resource_access || {};
    for (const k of Object.keys(res)) {
      const arr = (res[k] && res[k].roles) || [];
      for (const r of arr) { roles.add(String(r)); roles.add(k + ":" + String(r)); }
    }
  } catch (e) {}
  return Array.from(roles);
}
async function verifyIdToken(idToken, discovery) {
  // Verifikasi tanda tangan + issuer + audience memakai JWKS Keycloak (lib jose).
  const { createRemoteJWKSet, jwtVerify } = await import("jose");
  const JWKS = createRemoteJWKSet(new URL(discovery.jwks_uri));
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: discovery.issuer || SSO_ISSUER,
    audience: SSO_CLIENT_ID,
  });
  return payload;
}

/* ---------- berkas statis (frontend) ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(FRONT_DIR, rel));
  if (!file.startsWith(FRONT_DIR)) { res.writeHead(403, SEC); res.end("dilarang"); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      if (path.extname(file) === "") { // fallback halaman utama
        fs.readFile(path.join(FRONT_DIR, "index.html"), (e2, d2) => {
          if (e2) { res.writeHead(404, SEC); res.end("tidak ditemukan"); }
          else { res.writeHead(200, { "Content-Type": MIME[".html"], ...SEC }); res.end(d2); }
        });
      } else { res.writeHead(404, SEC); res.end("tidak ditemukan"); }
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", ...SEC });
    res.end(data);
  });
}

/* ---------- router API ---------- */
async function route(req, res) {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;
  const m = req.method;

  if (m === "GET" && p === "/api/health") return send(res, 200, { ok: true, name: "BERTAUT", apps: store.apps.length, time: new Date().toISOString(), sso: SSO_ENABLED });
  if (m === "GET" && p === "/api/apps") return send(res, 200, store.apps);
  if (m === "GET" && p === "/api/auth/config") {
    return send(res, 200, {
      ssoEnabled: SSO_ENABLED,
      issuer: SSO_ISSUER || null,
      clientId: SSO_CLIENT_ID || null,
      redirectUri: SSO_REDIRECT_URI,
      loginUrl: SSO_ENABLED ? "/auth/sso/login" : null,
      adminRoles: SSO_ADMIN_ROLES,
    });
  }

  /* --- SSO: mulai login --- */
  if (m === "GET" && p === "/auth/sso/login") {
    try {
      const disc = await getDiscovery();
      const state = crypto.randomBytes(16).toString("hex");
      const nonce = crypto.randomBytes(16).toString("hex");
      ssoStates.set(state, { exp: Date.now() + 10 * 60e3, nonce });
      // bersihkan state kedaluwarsa
      for (const [k, v] of ssoStates) if (v.exp < Date.now()) ssoStates.delete(k);
      const authUrl = new URL(disc.authorization_endpoint);
      authUrl.searchParams.set("client_id", SSO_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", SSO_REDIRECT_URI);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SSO_SCOPES);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("nonce", nonce);
      return redirect(res, authUrl.toString());
    } catch (e) {
      return send(res, 500, { error: "SSO belum siap: " + e.message });
    }
  }

  /* --- SSO: callback dari Keycloak --- */
  if (m === "GET" && p === "/auth/sso/callback") {
    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");
    const errDesc = u.searchParams.get("error_description") || u.searchParams.get("error");
    if (errDesc && !code) {
      return redirect(res, "/?sso_error=" + encodeURIComponent(errDesc));
    }
    if (!code || !state) return send(res, 400, { error: "Callback SSO tidak lengkap (code/state hilang)." });
    const saved = ssoStates.get(state);
    ssoStates.delete(state);
    if (!saved || saved.exp < Date.now()) {
      return redirect(res, "/?sso_error=" + encodeURIComponent("State SSO kedaluwarsa. Coba lagi."));
    }
    try {
      const disc = await getDiscovery();
      const body = new URLSearchParams();
      body.set("grant_type", "authorization_code");
      body.set("code", code);
      body.set("redirect_uri", SSO_REDIRECT_URI);
      body.set("client_id", SSO_CLIENT_ID);
      if (SSO_CLIENT_SECRET) body.set("client_secret", SSO_CLIENT_SECRET);
      const tr = await fetch(disc.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: body.toString(),
      });
      const tj = await tr.json().catch(() => ({}));
      if (!tr.ok) throw new Error((tj.error_description || tj.error || ("token exchange " + tr.status)));
      const idToken = tj.id_token;
      if (!idToken) throw new Error("Keycloak tidak mengembalikan id_token.");
      const claims = await verifyIdToken(idToken, disc);
      if (saved.nonce && claims.nonce && claims.nonce !== saved.nonce) throw new Error("nonce tidak cocok.");
      const roles = extractRoles(claims);
      const canManage = roles.some((r) => SSO_ADMIN_ROLES.includes(r));
      const username = claims.preferred_username || claims.email || claims.name || claims.sub || "sso-user";
      const token = crypto.randomBytes(32).toString("hex");
      tokens.set(token, {
        user: String(username),
        exp: Date.now() + TTL_MS,
        sso: true,
        roles,
        canManage,
        sub: claims.sub || null,
      });
      // kembali ke etalase dengan token di fragment (tidak tercatat di log server)
      const frag = "#sso_token=" + encodeURIComponent(token);
      return redirect(res, "/" + frag);
    } catch (e) {
      console.error("[bertaut][sso]", e.message);
      return redirect(res, "/?sso_error=" + encodeURIComponent(e.message));
    }
  }

  /* --- SSO: logout (hapus sesi lokal + arahkan ke Keycloak) --- */
  if (m === "GET" && p === "/auth/sso/logout") {
    const h = req.headers.authorization || "";
    const mm = /^Bearer (.+)$/.exec(h);
    if (mm) tokens.delete(mm[1]);
    try {
      if (SSO_ENABLED) {
        const disc = await getDiscovery();
        if (disc.end_session_endpoint) {
          const lo = new URL(disc.end_session_endpoint);
          lo.searchParams.set("post_logout_redirect_uri", u.searchParams.get("next") || ("http://localhost:" + PORT + "/"));
          if (u.searchParams.get("id_token")) lo.searchParams.set("id_token_hint", u.searchParams.get("id_token"));
          return redirect(res, lo.toString());
        }
      }
    } catch (e) {}
    return redirect(res, "/");
  }

  if (m === "POST" && p === "/api/login") {
    const ip = req.socket.remoteAddress || "?";
    const now = Date.now();
    const hits = (loginHits.get(ip) || []).filter((t) => now - t < 5 * 60e3);
    if (hits.length >= 15) return send(res, 429, { error: "Terlalu banyak percobaan. Tunggu 5 menit." });
    hits.push(now); loginHits.set(ip, hits);
    await new Promise((r) => setTimeout(r, 600)); // lambatkan brute force
    let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const okUser = String(b.user || "") === store.admin.user;
    const okPass = okUser && hashPass(String(b.pass || ""), store.admin.salt) === store.admin.hash;
    if (!okPass) return send(res, 401, { error: "Kunci tidak cocok." });
    const token = crypto.randomBytes(32).toString("hex");
    tokens.set(token, { user: store.admin.user, exp: now + TTL_MS, sso: false, roles: ["local-admin"], canManage: true });
    return send(res, 200, { token, user: store.admin.user, sso: false, canManage: true });
  }
  if (m === "GET" && p === "/api/me") {
    const t = bearer(req);
    if (!t) return send(res, 401, { error: "Sesi berakhir." });
    return send(res, 200, { user: t.user, sso: !!t.sso, roles: t.roles || [], canManage: (t.canManage !== undefined) ? !!t.canManage : true });
  }

  const visit = /^\/api\/apps\/([A-Za-z0-9_-]+)\/visit$/.exec(p);
  if (m === "POST" && visit) {
    const a = store.apps.find((x) => x.id === visit[1]);
    if (!a) return send(res, 404, { error: "Tidak ditemukan." });
    a.visits = (a.visits | 0) + 1; a.lastOpen = new Date().toISOString();
    store.visitsTotal = (store.visitsTotal | 0) + 1; saveStore(store);
    return send(res, 200, { ok: true, visits: a.visits, total: store.visitsTotal });
  }

  if (m === "POST" && p === "/api/apps") {
    const t = needAdmin(req, res); if (!t) return;
    let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const c = cleanApp(b);
    if (c.error) return send(res, 400, { error: c.error });
    const app = { id: "a" + crypto.randomBytes(4).toString("hex"), visits: 0, lastOpen: null, ...c.app };
    store.apps.unshift(app); saveStore(store);
    return send(res, 201, { ok: true, id: app.id });
  }
  const one = /^\/api\/apps\/([A-Za-z0-9_-]+)$/.exec(p);
  if (one && (m === "PUT" || m === "DELETE")) {
    const t = needAdmin(req, res); if (!t) return;
    const a = store.apps.find((x) => x.id === one[1]);
    if (!a) return send(res, 404, { error: "Tidak ditemukan." });
    if (m === "DELETE") {
      store.apps = store.apps.filter((x) => x.id !== a.id); saveStore(store);
      return send(res, 200, { ok: true });
    }
    let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const c = cleanApp(b);
    if (c.error) return send(res, 400, { error: c.error });
    Object.assign(a, c.app); saveStore(store);
    return send(res, 200, { ok: true });
  }
  if (m === "POST" && p === "/api/apps/replace") {
    const t = needAdmin(req, res); if (!t) return;
    let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const arr = Array.isArray(b) ? b : b.apps;
    if (!Array.isArray(arr)) return send(res, 400, { error: "Format berkas tidak valid." });
    const out = [];
    for (const raw of arr.slice(0, 200)) {
      const c = cleanApp(raw);
      if (c.error) continue;
      out.push({ id: String((raw && raw.id) || "a" + crypto.randomBytes(4).toString("hex")).slice(0, 24), visits: (raw && raw.visits) | 0 || 0, lastOpen: (raw && raw.lastOpen) || null, ...c.app });
    }
    store.apps = out; saveStore(store);
    return send(res, 200, { ok: true, count: out.length });
  }
  if (m === "POST" && p === "/api/apps/reset") {
    const t = needAdmin(req, res); if (!t) return;
    store.apps = SEED.map(blankApp); saveStore(store);
    return send(res, 200, { ok: true, count: store.apps.length });
  }
  if (m === "POST" && p === "/api/creds") {
    const t = needAdmin(req, res); if (!t) return;
    let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    if (b.user !== undefined) {
      const nu = String(b.user).trim().slice(0, 32);
      if (nu.length < 3) return send(res, 400, { error: "Nama pengguna minimal 3 huruf." });
      store.admin.user = nu;
      for (const [, v] of tokens) v.user = nu;
    }
    if (b.pass !== undefined && b.pass !== "") {
      if (String(b.pass).length < 6) return send(res, 400, { error: "Kata sandi minimal 6 karakter." });
      const salt = crypto.randomBytes(16).toString("hex");
      store.admin.salt = salt; store.admin.hash = hashPass(String(b.pass), salt);
    }
    saveStore(store);
    return send(res, 200, { ok: true, user: store.admin.user });
  }
  if (m === "GET" && p === "/api/export") {
    const t = needAdmin(req, res); if (!t) return;
    return send(res, 200, { apps: store.apps, exportedAt: new Date().toISOString() });
  }

  return send(res, 404, { error: "Rute tidak dikenal." });
}

const server = http.createServer((req, res) => {
  try {
    const p = new URL(req.url, "http://x").pathname;
    if (p === "/api" || p.startsWith("/api/") || p === "/auth" || p.startsWith("/auth/")) {
      route(req, res).catch((e) => { try { send(res, 500, { error: "Galat server." }); } catch (_) {} console.error("[bertaut]", e.message); });
    } else if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res, p);
    } else { res.writeHead(405, SEC); res.end("metode tidak diizinkan"); }
  } catch (e) { try { res.writeHead(400, SEC); res.end("permintaan buruk"); } catch (_) {} }
});
server.listen(PORT, () => {
  console.log(`[bertaut] etalase publik:  http://localhost:${PORT}`);
  console.log(`[bertaut] data tersimpan: ${DATA_FILE}`);
  if (SSO_ENABLED) {
    console.log(`[bertaut] SSO aktif: ${SSO_ISSUER} (client=${SSO_CLIENT_ID})`);
    console.log(`[bertaut] SSO callback: ${SSO_REDIRECT_URI}`);
    console.log(`[bertaut] peran pengelola: ${SSO_ADMIN_ROLES.join(", ")}`);
  } else {
    console.log("[bertaut] SSO nonaktif — isi KEYCLOAK_ISSUER + KEYCLOAK_CLIENT_ID untuk mengaktifkan.");
  }
});
