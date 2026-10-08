import { createClient, type Client } from "@libsql/client";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

export const CATS = ["Kepegawaian", "Kinerja", "Administrasi", "Keuangan", "Kesehatan", "Lainnya"] as const;
export const ACCENTS = ["gold", "teal", "clay", "sage", "ink"] as const;
export const GLYPHS = ["◈", "⬢", "◎", "▲", "✦", "▣"] as const;

export type AppRow = {
  id: string;
  name: string;
  url: string;
  desc: string;
  cat: string;
  accent: string;
  glyph: string;
  pin: number;
  sso: number;
  visits: number;
  lastOpen: string | null;
};

const SEED = [
  { id: "slaman", name: "SLAman Teknisi", url: "https://slaman-kabprob.vercel.app/login?sso=1", desc: "Pemantauan SLA kinerja teknisi — antrean tiket & ketepatan layanan.", cat: "Kinerja", accent: "sage", glyph: "⬢", pin: 1, sso: 1 },
  { id: "myasn", name: "MyASN BKN", url: "https://myasn.bkn.go.id", desc: "Layanan mandiri ASN — profil, riwayat jabatan, SK & data pribadi.", cat: "Kepegawaian", accent: "gold", glyph: "◈", pin: 1, sso: 1 },
  { id: "siasn", name: "SIASN BKN", url: "https://siasn.bkn.go.id", desc: "Sistem Informasi ASN terpusat — layanan administrasi kepegawaian.", cat: "Kepegawaian", accent: "teal", glyph: "⬢", pin: 1, sso: 1 },
  { id: "ekin", name: "e-Kinerja BKN", url: "https://ekinerja.bkn.go.id", desc: "Perencanaan & penilaian kinerja harian hingga SKP tahunan.", cat: "Kinerja", accent: "clay", glyph: "▲", pin: 1, sso: 0 },
  { id: "srikandi", name: "Srikandi Arsip", url: "https://srikandi.arsip.go.id", desc: "Surat-menyurat dinas & kearsipan elektronik terintegrasi.", cat: "Administrasi", accent: "sage", glyph: "▣", pin: 0, sso: 0 },
  { id: "coretax", name: "Coretax DJP", url: "https://coretaxdjp.pajak.go.id", desc: "Administrasi perpajakan — e-Filing, e-Billing & profil Wajib Pajak.", cat: "Keuangan", accent: "ink", glyph: "◎", pin: 0, sso: 0 },
  { id: "taspen", name: "Taspen & e-Klim", url: "https://www.taspen.co.id", desc: "Tabungan pensiun, klaim manfaat & layanan kesejahteraan ASN.", cat: "Keuangan", accent: "gold", glyph: "✦", pin: 0, sso: 0 },
  { id: "edabu", name: "e-Dabu BPJS Kesehatan", url: "https://edabu.bpjs-kesehatan.go.id", desc: "Kepesertaan JKN-KIS — cek status, iuran & badan usaha.", cat: "Kesehatan", accent: "teal", glyph: "◎", pin: 0, sso: 0 },
  { id: "lapor", name: "LAPOR! SPAN", url: "https://www.lapor.go.id", desc: "Kanal aspirasi & pengaduan pelayanan publik nasional.", cat: "Administrasi", accent: "clay", glyph: "⬢", pin: 0, sso: 0 },
];

let client: Client | null = null;

export function getClient(): Client {
  if (client) return client;
  const tursoUrl = process.env.TURSO_DATABASE_URL || "";
  const tursoToken = process.env.TURSO_AUTH_TOKEN || "";
  if (tursoUrl) {
    client = createClient({ url: tursoUrl, authToken: tursoToken || undefined });
  } else {
    // Lokal: SQLite file. Di Vercel filesystem read-only → wajib TURSO_*.
    const filePath = process.env.DATABASE_FILE || path.join(process.cwd(), "data", "bertaut.db");
    try {
      mkdirSync(path.dirname(filePath), { recursive: true });
    } catch {}
    client = createClient({ url: `file:${filePath}` });
  }
  return client;
}

let initDone = false;

export async function initDb() {
  const db = getClient();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      descr TEXT NOT NULL DEFAULT '',
      cat TEXT NOT NULL DEFAULT 'Lainnya',
      accent TEXT NOT NULL DEFAULT 'gold',
      glyph TEXT NOT NULL DEFAULT '◈',
      pin INTEGER NOT NULL DEFAULT 0,
      sso INTEGER NOT NULL DEFAULT 0,
      visits INTEGER NOT NULL DEFAULT 0,
      lastOpen TEXT
    );
    CREATE TABLE IF NOT EXISTS meta (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL
    );
  `);
  // Migrasi: basis data lama belum punya kolom sso.
  try {
    await db.execute("ALTER TABLE apps ADD COLUMN sso INTEGER NOT NULL DEFAULT 0");
  } catch {}
  if (initDone) return;
  initDone = true;
  const count = await db.execute("SELECT COUNT(*) AS n FROM apps");
  const n = Number(count.rows[0]?.n ?? 0);
  if (n === 0) {
    for (const s of SEED) {
      await db.execute({
        sql: "INSERT INTO apps (id,name,url,descr,cat,accent,glyph,pin,sso,visits,lastOpen) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        args: [s.id, s.name, s.url, s.desc, s.cat, s.accent, s.glyph, s.pin, s.sso, 0, null],
      });
    }
  }
  // Admin lokal: meta.admin_user / admin_salt / admin_hash (scrypt, spt backend lama)
  const m = await db.execute("SELECT k,v FROM meta WHERE k IN ('admin_user','admin_salt','admin_hash')");
  const has = new Set(m.rows.map((r) => String(r.k)));
  if (!has.has("admin_user") || !has.has("admin_salt") || !has.has("admin_hash")) {
    const adminUser = process.env.BERTAUT_ADMIN_USER || "admin";
    const adminPass = process.env.BERTAUT_ADMIN_PASS || "bertaut123";
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(String(adminPass), salt, 64).toString("hex");
    await db.batch([
      { sql: "INSERT OR REPLACE INTO meta (k,v) VALUES ('admin_user',?)", args: [adminUser] },
      { sql: "INSERT OR REPLACE INTO meta (k,v) VALUES ('admin_salt',?)", args: [salt] },
      { sql: "INSERT OR REPLACE INTO meta (k,v) VALUES ('admin_hash',?)", args: [hash] },
    ]);
  }
  // Migrasi sekali: SLAman selalu paling atas (pin + urutan baris pertama).
  // DB lama yang sudah ter-seed tidak ikut SEED baru, jadi perbaiki di sini.
  const orderFlag = await db.execute("SELECT v FROM meta WHERE k='order_fix_slaman_top'");
  if (!orderFlag.rows.length) {
    const seedSl = SEED.find((s) => s.id === "slaman")!;
    const found = await db.execute("SELECT id FROM apps WHERE id='slaman'");
    if (!found.rows.length) {
      await db.execute({
        sql: "INSERT INTO apps (id,name,url,descr,cat,accent,glyph,pin,sso,visits,lastOpen) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        args: [seedSl.id, seedSl.name, seedSl.url, seedSl.desc, seedSl.cat, seedSl.accent, seedSl.glyph, 1, seedSl.sso, 0, null],
      });
    } else {
      await db.execute("UPDATE apps SET pin=1 WHERE id='slaman'");
    }
    const all = await db.execute("SELECT * FROM apps ORDER BY rowid ASC");
    const rows = all.rows as unknown as Record<string, unknown>[];
    if (rows.length && String(rows[0].id) !== "slaman") {
      const first = rows.find((r) => String(r.id) === "slaman")!;
      const rest = rows.filter((r) => String(r.id) !== "slaman");
      await db.execute("DELETE FROM apps");
      for (const r of [first, ...rest]) {
        await db.execute({
          sql: "INSERT INTO apps (id,name,url,descr,cat,accent,glyph,pin,sso,visits,lastOpen) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          args: [String(r.id), String(r.name), String(r.url), String(r.descr ?? ""), String(r.cat ?? "Lainnya"), String(r.accent ?? "gold"), String(r.glyph ?? "◈"), Number(r.pin ?? 0), Number(r.sso ?? 0), Number(r.visits ?? 0), (r.lastOpen as string | null) ?? null],
        });
      }
    }
    await db.execute("INSERT OR REPLACE INTO meta (k,v) VALUES ('order_fix_slaman_top','1')");
  }
  // Migrasi sekali: terapkan sandi dari env HANYA bila diisi eksplisit.
  // Tidak pernah menimpa sandi yang sudah diganti via Pengaturan, dan tidak
  // pernah memakai sandi hardcoded.
  const passFlag = await db.execute("SELECT v FROM meta WHERE k='admin_pass_v2'");
  if (!passFlag.rows.length) {
    if (process.env.BERTAUT_ADMIN_PASS) {
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(String(process.env.BERTAUT_ADMIN_PASS), salt, 64).toString("hex");
      await db.batch([
        { sql: "INSERT OR REPLACE INTO meta (k,v) VALUES ('admin_user',?)", args: [process.env.BERTAUT_ADMIN_USER || "admin"] },
        { sql: "INSERT OR REPLACE INTO meta (k,v) VALUES ('admin_salt',?)", args: [salt] },
        { sql: "INSERT OR REPLACE INTO meta (k,v) VALUES ('admin_hash',?)", args: [hash] },
      ]);
    }
    await db.execute("INSERT OR REPLACE INTO meta (k,v) VALUES ('admin_pass_v2','1')");
  }
}

export function hashPass(pass: string, salt: string) {
  return scryptSync(String(pass), salt, 64).toString("hex");
}

export async function getAdmin() {
  await initDb();
  const db = getClient();
  const r = await db.execute("SELECT k,v FROM meta WHERE k IN ('admin_user','admin_salt','admin_hash')");
  const map = new Map(r.rows.map((x) => [String(x.k), String(x.v)]));
  return {
    user: map.get("admin_user") || process.env.BERTAUT_ADMIN_USER || "admin",
    salt: map.get("admin_salt") || "",
    hash: map.get("admin_hash") || "",
  };
}

export async function setAdminCreds(nextUser?: string, nextPass?: string) {
  await initDb();
  const db = getClient();
  if (nextUser !== undefined) {
    await db.execute({ sql: "INSERT OR REPLACE INTO meta (k,v) VALUES ('admin_user',?)", args: [nextUser] });
  }
  if (nextPass) {
    const salt = randomBytes(16).toString("hex");
    const hash = hashPass(nextPass, salt);
    await db.batch([
      { sql: "INSERT OR REPLACE INTO meta (k,v) VALUES ('admin_salt',?)", args: [salt] },
      { sql: "INSERT OR REPLACE INTO meta (k,v) VALUES ('admin_hash',?)", args: [hash] },
    ]);
  }
  return getAdmin();
}

function rowToApp(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    name: String(r.name),
    url: String(r.url),
    desc: String(r.descr ?? ""),
    cat: String(r.cat ?? "Lainnya"),
    accent: String(r.accent ?? "gold"),
    glyph: String(r.glyph ?? "◈"),
    pin: !!Number(r.pin ?? 0),
    sso: !!Number(r.sso ?? 0),
    visits: Number(r.visits ?? 0),
    lastOpen: (r.lastOpen as string | null) ?? null,
  };
}

export async function listApps() {
  await initDb();
  const db = getClient();
  const r = await db.execute("SELECT * FROM apps ORDER BY rowid ASC");
  return r.rows.map((x) => rowToApp(x as unknown as Record<string, unknown>));
}

export async function createApp(a: { name: string; url: string; desc: string; cat: string; accent: string; glyph: string; pin: boolean; sso: boolean }) {
  await initDb();
  const db = getClient();
  const id = "a" + randomBytes(4).toString("hex");
  await db.execute({
    sql: "INSERT INTO apps (id,name,url,descr,cat,accent,glyph,pin,sso,visits,lastOpen) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    args: [id, a.name, a.url, a.desc, a.cat, a.accent, a.glyph, a.pin ? 1 : 0, a.sso ? 1 : 0, 0, null],
  });
  return id;
}

export async function updateApp(id: string, a: { name: string; url: string; desc: string; cat: string; accent: string; glyph: string; pin: boolean; sso: boolean }) {
  await initDb();
  const db = getClient();
  const r = await db.execute({
    sql: "UPDATE apps SET name=?,url=?,descr=?,cat=?,accent=?,glyph=?,pin=?,sso=? WHERE id=?",
    args: [a.name, a.url, a.desc, a.cat, a.accent, a.glyph, a.pin ? 1 : 0, a.sso ? 1 : 0, id],
  });
  return Number(r.rowsAffected ?? 0) > 0;
}

export async function deleteApp(id: string) {
  await initDb();
  const db = getClient();
  await db.execute({ sql: "DELETE FROM apps WHERE id=?", args: [id] });
}

export async function replaceApps(arr: Array<{ id?: string; name: string; url: string; desc: string; cat: string; accent: string; glyph: string; pin: boolean; sso?: boolean; visits?: number; lastOpen?: string | null }>) {
  await initDb();
  const db = getClient();
  await db.execute("DELETE FROM apps");
  for (const a of arr.slice(0, 200)) {
    const id = String(a.id || "a" + randomBytes(4).toString("hex")).slice(0, 24);
    await db.execute({
      sql: "INSERT INTO apps (id,name,url,descr,cat,accent,glyph,pin,sso,visits,lastOpen) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      args: [id, a.name, a.url, a.desc, a.cat, a.accent, a.glyph, a.pin ? 1 : 0, a.sso ? 1 : 0, a.visits || 0, a.lastOpen || null],
    });
  }
  return arr.length;
}

export async function resetApps() {
  return replaceApps(SEED.map((s) => ({ ...s, pin: !!s.pin, sso: !!s.sso, desc: s.desc, visits: 0, lastOpen: null })));
}

export async function recordVisit(id: string) {
  await initDb();
  const db = getClient();
  const now = new Date().toISOString();
  await db.execute({ sql: "UPDATE apps SET visits = visits + 1, lastOpen=? WHERE id=?", args: [now, id] });
  const r = await db.execute({ sql: "SELECT visits FROM apps WHERE id=?", args: [id] });
  const visits = Number(r.rows[0]?.visits ?? 0);
  const t = await db.execute("SELECT COALESCE(SUM(visits),0) AS total FROM apps");
  return { visits, total: Number(t.rows[0]?.total ?? 0) };
}

export function cleanApp(input: unknown): { error: string } | { app: { name: string; url: string; desc: string; cat: string; accent: string; glyph: string; pin: boolean; sso: boolean } } {
  const a = (input ?? {}) as Record<string, unknown>;
  const name = String(a.name ?? "").trim().slice(0, 48);
  let url = String(a.url ?? "").trim().slice(0, 300);
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("x");
  } catch {
    return { error: "Tautan tidak valid — awali dengan https://" };
  }
  if (name.length < 2) return { error: "Nama aplikasi minimal 2 huruf." };
  const desc = String(a.desc ?? "").trim().slice(0, 120);
  const cat = (CATS as readonly string[]).includes(String(a.cat)) ? String(a.cat) : "Lainnya";
  const accent = (ACCENTS as readonly string[]).includes(String(a.accent)) ? String(a.accent) : "gold";
  const glyph = (GLYPHS as readonly string[]).includes(String(a.glyph)) ? String(a.glyph) : "◈";
  return { app: { name, url, desc, cat, accent, glyph, pin: !!a.pin, sso: !!a.sso } };
}
