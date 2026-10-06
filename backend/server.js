/* BERTAUT backend — API + penyaji frontend. Nol dependensi.
 * Jalankan:  node backend/server.js   (atau: npm start --prefix backend)
 * Buka:      http://localhost:3000  (atau sesuai PORT)
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = +(process.env.PORT || 3000);
const DATA_DIR = process.env.BERTAUT_DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "bertaut.json");
const TTL_MS = (+(process.env.TOKEN_TTL_HOURS || 12)) * 3600e3;
const FRONT_DIR = path.join(__dirname, "..", "frontend");

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

  if (m === "GET" && p === "/api/health") return send(res, 200, { ok: true, name: "BERTAUT", apps: store.apps.length, time: new Date().toISOString() });
  if (m === "GET" && p === "/api/apps") return send(res, 200, store.apps);

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
    tokens.set(token, { user: store.admin.user, exp: now + TTL_MS });
    return send(res, 200, { token, user: store.admin.user });
  }
  if (m === "GET" && p === "/api/me") {
    const t = bearer(req);
    if (!t) return send(res, 401, { error: "Sesi berakhir." });
    return send(res, 200, { user: t.user });
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
    if (p === "/api" || p.startsWith("/api/")) {
      route(req, res).catch((e) => { try { send(res, 500, { error: "Galat server." }); } catch (_) {} console.error("[bertaut]", e.message); });
    } else if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res, p);
    } else { res.writeHead(405, SEC); res.end("metode tidak diizinkan"); }
  } catch (e) { try { res.writeHead(400, SEC); res.end("permintaan buruk"); } catch (_) {} }
});
server.listen(PORT, () => {
  console.log(`[bertaut] etalase publik:  http://localhost:${PORT}`);
  console.log(`[bertaut] data tersimpan: ${DATA_FILE}`);
});
