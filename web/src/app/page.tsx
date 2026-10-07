"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmberField, MegahVeil, useMegahFx } from "../components/megah";
import { ChainOverlay } from "../components/rantai";

type AppItem = {
  id: string;
  name: string;
  url: string;
  desc: string;
  cat: string;
  accent: string;
  glyph: string;
  pin: boolean;
  sso: boolean;
  visits: number;
  lastOpen: string | null;
};

type Session = { user: string; sso: boolean; roles: string[]; canManage: boolean } | null;

const CATS = ["Kepegawaian", "Kinerja", "Administrasi", "Keuangan", "Kesehatan", "Lainnya"];
const SS_TOKEN = "bertaut.token";
const ACCENTS = ["gold", "teal", "clay", "sage", "ink"];
const GLYPHS = ["◈", "⬢", "◎", "▲", "✦", "▣"];

function esc(s: string) {
  return s;
}
function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}
function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function api(path: string, opts?: { method?: string; body?: unknown; token?: string | null }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tok = opts?.token ?? (typeof window !== "undefined" ? sessionStorage.getItem(SS_TOKEN) : null);
  if (tok) headers.Authorization = `Bearer ${tok}`;
  const res = await fetch(path, {
    method: opts?.method || "GET",
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) throw new Error("Sesi pengelola berakhir. Masuk kembali.");
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || `Server menjawab ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : res.text();
}

export default function Home() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");
  const [sort, setSort] = useState("manual");
  const [managing, setManaging] = useState(false);
  const [session, setSession] = useState<Session>(null);
  const [serverOn, setServerOn] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [adminRoles, setAdminRoles] = useState<string[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [toasts, setToasts] = useState<string[]>([]);
  const [modal, setModal] = useState<null | Partial<AppItem>>(null);
  const [formErr, setFormErr] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [sUser, setSUser] = useState("");
  const [sPass, setSPass] = useState("");
  const [palOpen, setPalOpen] = useState(false);
  const [palQ, setPalQ] = useState("");
  const [clock, setClock] = useState("--:--");
  const [dateLine, setDateLine] = useState("—");
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [veilDone, setVeilDone] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const prevSso = useRef(false);

  const toast = useCallback((msg: string) => {
    setToasts((t) => [...t, msg]);
    setTimeout(() => setToasts((t) => t.slice(1)), 2600);
  }, []);

  const refreshApps = useCallback(async () => {
    const list = (await api("/api/apps")) as AppItem[];
    if (Array.isArray(list)) setApps(list);
  }, []);

  // Boot: SSO return + health + config + session
  useEffect(() => {
    try {
      const h = window.location.hash || "";
      const m = /#sso_token=([^&]+)/.exec(h);
      if (m) {
        sessionStorage.setItem(SS_TOKEN, decodeURIComponent(m[1]));
        window.location.hash = "";
        history.replaceState(null, "", window.location.pathname + window.location.search);
        setTimeout(() => toast("Masuk SSO berhasil."), 0);
      }
      const qs = new URLSearchParams(window.location.search);
      const err = qs.get("sso_error");
      if (err) {
        qs.delete("sso_error");
        history.replaceState(null, "", window.location.pathname + (qs.toString() ? `?${qs}` : ""));
        const msg = `SSO gagal: ${err}`;
        setTimeout(() => {
          setLoginErr(msg);
          setShowLogin(true);
          toast(msg);
        }, 0);
      }
    } catch {}
    api("/api/health")
      .then(() => setServerOn(true))
      .catch(() => setServerOn(false))
      .finally(() => {
        api("/api/auth/config")
          .then((c: { ssoEnabled?: boolean; adminRoles?: string[] }) => {
            setSsoEnabled(!!c.ssoEnabled);
            setAdminRoles(c.adminRoles || []);
          })
          .catch(() => {});
        refreshApps().catch(() => {});
        const tok = sessionStorage.getItem(SS_TOKEN);
        if (tok) {
          api("/api/me")
            .then((me: { user: string; sso: boolean; roles: string[]; canManage: boolean }) => {
              setSession(me);
              if (!me.canManage) toast(`Masuk SSO sebagai ${me.user} (lihat saja).`);
            })
            .catch(() => sessionStorage.removeItem(SS_TOKEN));
        }
      });
    const t = setInterval(() => {
      try {
        const now = new Date();
        const fmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
        const df = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
        setClock(fmt.format(now));
        setDateLine(df.format(now));
      } catch {}
    }, 1000);
    return () => clearInterval(t);
  }, [refreshApps, toast]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalOpen(true);
      } else if (e.key === "Escape") {
        setPalOpen(false);
        setModal(null);
        setDrawer(false);
      } else if (e.key === "/" && !(e.target as HTMLElement)?.matches?.("input,select,textarea")) {
        e.preventDefault();
        document.getElementById("q")?.focus();
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  function lockedTap() {
    if (ssoEnabled) window.location.href = "/api/auth/sso/login";
    else toast("SSO belum dikonfigurasi — hubungi pengelola.");
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let list = apps.filter((a) => {
      const okC = cat === "Semua" || a.cat === cat;
      const okQ = !qq || `${a.name} ${a.desc} ${hostOf(a.url)}`.toLowerCase().includes(qq);
      return okC && okQ;
    });
    if (sort === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "id"));
    else if (sort === "recent") list = [...list].sort((a, b) => String(b.lastOpen || "").localeCompare(String(a.lastOpen || "")));
    else list = [...list.filter((a) => a.pin), ...list.filter((a) => !a.pin)];
    return list;
  }, [apps, q, cat, sort]);

  const cats = useMemo(
    () => ["Semua", ...CATS.filter((c) => apps.some((a) => a.cat === c))],
    [apps]
  );
  const totalVisits = apps.reduce((s, a) => s + (a.visits || 0), 0);
  const isAdmin = !!session?.canManage;
  const authed = !!session;
  const who = session?.user ? cap(session.user) + (session.sso ? " (SSO)" : "") : serverOn ? "Tamu" : "Arunika";
  const gridKey = useMemo(() => filtered.map((a) => a.id).join(","), [filtered]);
  const ssoCount = useMemo(() => apps.filter((a) => a.sso).length, [apps]);
  useMegahFx(rootRef, gridKey, veilDone);

  // Segel terlepas: tepat saat sesi lahir — setelah tabir terangkat agar terlihat.
  useEffect(() => {
    if (!veilDone) return;
    if (!authed || prevSso.current) {
      prevSso.current = authed;
      return;
    }
    prevSso.current = true;
    if (ssoCount === 0) return;
    const t1 = setTimeout(() => {
      setBreaking(true);
      toast(`Akses SSO terbuka — ${ssoCount} aplikasi tersedia.`);
    }, 0);
    const t2 = setTimeout(() => setBreaking(false), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [authed, veilDone, ssoCount, toast]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = (await api("/api/login", { method: "POST", body: { user: loginUser.trim(), pass: loginPass } })) as {
        token: string;
        user: string;
      };
      sessionStorage.setItem(SS_TOKEN, r.token);
      const me = (await api("/api/me")) as Session;
      setSession(me);
      setLoginErr("");
      setShowLogin(false);
      toast(`Selamat bertugas, ${r.user}.`);
    } catch (ex) {
      setLoginErr((ex as Error).message || "Kunci tidak cocok.");
    }
  }

  function doLogout() {
    const wasSso = session?.sso;
    sessionStorage.removeItem(SS_TOKEN);
    setSession(null);
    setManaging(false);
    setLoginPass("");
    if (wasSso && ssoEnabled) {
      window.location.href = `/api/auth/sso/logout?next=${encodeURIComponent(window.location.origin + "/")}`;
      return;
    }
    toast("Anda keluar. Etalase tetap terbuka publik.");
  }

  function needAdmin(): boolean {
    if (isAdmin) return true;
    if (session && !session.canManage) {
      toast(`Akun SSO ${session.user} tidak punya peran pengelola (${adminRoles.join(", ")}).`);
      return false;
    }
    toast("Masuk dahulu sebagai pengelola.");
    setShowLogin(true);
    return false;
  }

  async function openApp(a: AppItem) {
    try {
      await api(`/api/apps/${encodeURIComponent(a.id)}/visit`, { method: "POST" });
    } catch {}
    setApps((prev) => prev.map((x) => (x.id === a.id ? { ...x, visits: (x.visits || 0) + 1, lastOpen: new Date().toISOString() } : x)));
    window.open(a.url, "_blank", "noopener");
  }

  async function removeApp(a: AppItem) {
    if (!confirm(`Hapus "${a.name}" dari etalase?`)) return;
    if (!needAdmin()) return;
    try {
      await api(`/api/apps/${encodeURIComponent(a.id)}`, { method: "DELETE" });
      await refreshApps();
      toast("Gerbang dihapus.");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function saveModal(e: React.FormEvent) {
    e.preventDefault();
    if (!needAdmin()) return;
    const f = modal || {};
    const name = String(f.name || "").trim();
    let url = String(f.url || "").trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) throw new Error("x");
    } catch {
      setFormErr("Tautan tidak valid — awali dengan https://");
      return;
    }
    if (name.length < 2) {
      setFormErr("Nama aplikasi minimal 2 huruf.");
      return;
    }
    const payload = {
      name,
      url,
      desc: String(f.desc || "").trim().slice(0, 120),
      cat: f.cat || "Kepegawaian",
      accent: f.accent || "gold",
      glyph: f.glyph || "◈",
      pin: !!f.pin,
      sso: !!f.sso,
    };
    try {
      if (f.id) await api(`/api/apps/${encodeURIComponent(String(f.id))}`, { method: "PUT", body: payload });
      else await api("/api/apps", { method: "POST", body: payload });
      await refreshApps();
      setModal(null);
      setFormErr("");
      toast(`Gerbang "${name}" tersimpan & terbit publik.`);
    } catch (ex) {
      setFormErr((ex as Error).message);
    }
  }

  async function saveCreds() {
    if (sUser.trim().length < 3) return toast("Nama pengguna minimal 3 huruf.");
    if (sPass && sPass.length < 6) return toast("Kata sandi minimal 6 karakter.");
    try {
      await api("/api/creds", { method: "POST", body: { user: sUser.trim(), pass: sPass || undefined } });
      const me = (await api("/api/me")) as Session;
      setSession(me);
      setSPass("");
      toast("Kunci masuk diperbarui.");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  function exportJson() {
    const tok = sessionStorage.getItem(SS_TOKEN);
    fetch("/api/export", { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
      .then((r) => {
        if (!r.ok) throw new Error("Perlu masuk sebagai pengelola.");
        return r.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "bertaut-etalase.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      })
      .catch((e) => toast(e.message));
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const d = JSON.parse(String(reader.result));
        const arr = Array.isArray(d) ? d : d.apps;
        if (!Array.isArray(arr)) throw new Error("Berkas tidak valid.");
        const mapped = arr
          .filter((x: { name?: string; url?: string }) => x?.name && x?.url)
          .slice(0, 200)
          .map((x: Record<string, unknown>) => ({
            id: String(x.id || "").slice(0, 24) || undefined,
            name: String(x.name).slice(0, 48),
            url: String(x.url),
            desc: String(x.desc || "").slice(0, 120),
            cat: CATS.includes(String(x.cat)) ? String(x.cat) : "Lainnya",
            accent: ACCENTS.includes(String(x.accent)) ? String(x.accent) : "gold",
            glyph: String(x.glyph || "◈").slice(0, 4),
            pin: !!(x.pin as boolean),
            sso: !!(x.sso as boolean),
            visits: Number(x.visits) || 0,
            lastOpen: (x.lastOpen as string) || null,
          }));
        const r = (await api("/api/apps/replace", { method: "POST", body: { apps: mapped } })) as { count?: number };
        await refreshApps();
        toast(`${r.count || mapped.length} gerbang diimpor & terbit.`);
      } catch (e) {
        toast((e as Error).message);
      }
    };
    reader.readAsText(file);
  }

  const palList = useMemo(() => {
    const qq = palQ.toLowerCase();
    return apps.filter((a) => `${a.name} ${a.cat}`.toLowerCase().includes(qq)).slice(0, 8);
  }, [apps, palQ]);

  return (
    <div ref={rootRef} className={isAdmin ? "is-admin is-logged is-server" : session ? "is-logged is-server" : "is-server"}>
      {!veilDone && <MegahVeil onDone={() => setVeilDone(true)} />}
      <EmberField />
      <div className="grain" aria-hidden="true" />

      {/* LOGIN */}
      {showLogin && (
        <main id="loginView" className="login">
          <section className="login-right" style={{ margin: "0 auto", padding: 24 }}>
              <div className="login-card" id="loginCard">
                <p className="eyebrow">Akses terbatas · pemilik portal</p>
                <h2>Masuki ruang kerja</h2>
                <p className="muted">Login lokal atau SSO Keycloak. Etalase publik tetap bisa dilihat tanpa login.</p>
                <form onSubmit={doLogin}>
                  <label className="field">
                    <span>Nama pengguna</span>
                    <input value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="cth. admin" required minLength={3} maxLength={32} />
                  </label>
                  <label className="field">
                    <span>Kata sandi</span>
                    <input value={loginPass} onChange={(e) => setLoginPass(e.target.value)} type="password" placeholder="••••••••" required minLength={6} maxLength={64} />
                  </label>
                  {loginErr && (
                    <p className="form-err" role="alert">
                      {loginErr}
                    </p>
                  )}
                  <button className="btn-gold" type="submit">
                    <span>Buka Portal</span>
                    <i>→</i>
                  </button>
                  {ssoEnabled && (
                    <div id="ssoWrap" style={{ marginTop: 12 }}>
                      <div style={{ textAlign: "center", fontSize: 12, opacity: 0.7, margin: "8px 0" }}>— atau —</div>
                      <button className="btn-ghost" type="button" style={{ width: "100%", justifyContent: "center" }} onClick={() => (window.location.href = "/api/auth/sso/login")}>
                        ◈ Masuk dengan SSO (Keycloak)
                      </button>
                      <p className="muted small" style={{ marginTop: 8 }}>
                        Peran pengelola: {adminRoles.join(", ") || "—"}
                      </p>
                    </div>
                  )}
                </form>
                <div className="back-row server-only">
                  <button type="button" onClick={() => setShowLogin(false)}>
                    ← Kembali ke etalase publik
                  </button>
                </div>
              </div>
            </section>
        </main>
      )}

      {/* APP */}
      <div id="appView">
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            <span>PORTAL KERJA PRIBADI</span>
            <i>✦</i>
            <span>BERANDA APLIKASI &amp; TAUTAN TERPADU</span>
            <i>✦</i>
            <span>MYASN · SIASN · E-KINERJA · SRIKANDI</span>
            <i>✦</i>
          </div>
        </div>

        <header className="topbar">
          <div className="brand-row small">
            <span className="sigil">◈</span>
            <span className="brand-name">BERTAUT</span>
            <span className="ver">v2.0-next</span>
          </div>
          <div className="top-search">
            <span aria-hidden="true">⌕</span>
            <input id="q" type="search" placeholder="Cari aplikasi… ( / atau Ctrl+K )" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="top-right">
            <div className="clock">
              <b>{clock}</b>
              <span>{dateLine}</span>
            </div>
            {!session && (
              <button id="loginNavBtn" type="button" onClick={() => setShowLogin(true)}>
                Masuk
              </button>
            )}
            {isAdmin && (
              <>
                <button className="btn-ghost admin-only" style={{ display: "inline-block" }} aria-pressed={managing} onClick={() => { if (!needAdmin()) return; setManaging(!managing); }}>
                  Kelola
                </button>
                <button className="btn-ghost" style={{ display: isAdmin ? "inline-block" : "none" }} onClick={() => { if (!needAdmin()) return; setModal({}); setFormErr(""); }}>
                  ＋ Tambah
                </button>
                <button className="btn-ghost icon" style={{ display: isAdmin ? "inline-block" : "none" }} aria-label="Pengaturan" onClick={() => { if (needAdmin()) { setDrawer(true); setSUser(session?.user || ""); } }}>
                  ⚙
                </button>
              </>
            )}
            {session && (
              <button className="avatar" title={`Keluar (${session.user})`} onClick={doLogout}>
                {(session.user || "?").charAt(0).toUpperCase()}
              </button>
            )}
          </div>
        </header>

        <section className="hero">
          <div className="hero-left">
            <p className="eyebrow">
              Selamat datang, <b>{esc(who)}</b> — <span>{dateLine}</span>
            </p>
            <h2 className="hero-title">
              <span className="mg-line">
                <span className="mg-line-inner">Pilih gerbang</span>
              </span>
              <span className="mg-line">
                <span className="mg-line-inner">
                  <em>tugas Anda</em> hari ini.
                </span>
              </span>
            </h2>
            <div className="stats">
              <div className="stat">
                <b data-count={apps.length}>{apps.length}</b>
                <span>gerbang terdaftar</span>
              </div>
              <div className="stat">
                <b data-count={apps.filter((a) => a.pin).length}>{apps.filter((a) => a.pin).length}</b>
                <span>disematkan</span>
              </div>
              <div className="stat">
                <b data-count={totalVisits}>{totalVisits}</b>
                <span>kunjungan tercatat</span>
              </div>
            </div>
          </div>
          <div className="hero-right">
            <div className="dial-wrap">
              <svg className="dial-runes" viewBox="0 0 168 168" aria-hidden="true">
                <defs>
                  <path id="rune-circle" d="M84,84 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" />
                </defs>
                <circle className="ring" cx={84} cy={84} r={78} />
                <circle className="ring" cx={84} cy={84} r={58} />
                <text>
                  <textPath href="#rune-circle">◈ ✦ ▲ ● ◆ ✧ ◈ ✦ ▲ ● ◆ ✧ ◈ ✦ ▲ ● ◆ ✧ ◈ ✦</textPath>
                </text>
              </svg>
              <div className="dial">
                <div
                  className="dial-ring"
                  data-p={`${apps.length ? Math.min(100, (filtered.length / apps.length) * 100) : 0}%`}
                />
                <div className="dial-core">
                  <b>{String(filtered.length).padStart(2, "0")}</b>
                  <span>siap dibuka</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <nav className="filters" aria-label="Saring kategori">
          <div className="chips">
            {cats.map((c) => (
              <button key={c} className={`chip${cat === c ? " on" : ""}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="sort">
            <label>
              Urut{" "}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="manual">Susunan saya</option>
                <option value="az">A – Z</option>
                <option value="recent">Terakhir dibuka</option>
              </select>
            </label>
          </div>
        </nav>

        <main className="grid" aria-live="polite">
          {filtered.map((a, i) => {
            const isLocked = !!a.sso && !authed;
            const showChain = isLocked || (breaking && !!a.sso);
            return (
              <article key={a.id} className={`card${isLocked ? " is-locked" : ""}`} data-accent={a.accent}>
                <div className="card-top">
                  <span className="card-idx">
                    {String(i + 1).padStart(2, "0")} / {esc(a.cat)}
                  </span>
                  {a.pin && <span className="pin-flag">★ SEMAT</span>}
                  <span className="glyph" aria-hidden="true">
                    {esc(a.glyph)}
                  </span>
                </div>
                <p className="cat">
                  {esc(a.cat)} {a.sso && <span className="sso-flag">⛓ SSO</span>}
                </p>
                <h3>{esc(a.name)}</h3>
                <p className="desc">{esc(a.desc || hostOf(a.url))}</p>
                <div className="card-meta">
                  <span>{esc(hostOf(a.url))}</span>
                  <span>{a.visits || 0}× dibuka</span>
                </div>
                <div className="card-actions">
                  {isLocked ? (
                    <button className="go is-chained" onClick={lockedTap}>
                      ⛓ Buka dengan SSO <span>→</span>
                    </button>
                  ) : (
                    <button className="go" onClick={() => openApp(a)}>
                      Kunjungi <span>↗</span>
                    </button>
                  )}
                  {isAdmin && managing && (
                    <>
                      <button className="mini" title="Ubah" onClick={() => { if (!needAdmin()) return; setModal({ ...a }); setFormErr(""); }}>
                        ✎
                      </button>
                      <button className="mini" title="Hapus" onClick={() => removeApp(a)}>
                        🗑
                      </button>
                    </>
                  )}
                </div>
                {showChain && <ChainOverlay breaking={breaking && !isLocked} name={a.name} onUnlock={lockedTap} />}
              </article>
            );
          })}
        </main>

        {filtered.length === 0 && (
          <div className="empty">
            <p className="empty-mark">◇</p>
            <h3>Ruang ini masih sunyi</h3>
            <p>Belum ada gerbang yang cocok.</p>
            <button className="btn-gold" onClick={() => { if (needAdmin()) { setModal({}); setFormErr(""); } }}>
              <span>Tambah aplikasi</span>
              <i>＋</i>
            </button>
          </div>
        )}

        <footer className="foot">
          <span>
            ◈ BERTAUT Next.js · SQLite/Turso · {apps.length} gerbang · {totalVisits} kunjungan
          </span>
        </footer>
      </div>

      {/* MODAL */}
      {modal && (
        <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <p className="eyebrow">{modal.id ? "Menyunting gerbang" : "Gerbang baru"}</p>
              <h3>{String(modal.name || "Tambah aplikasi")}</h3>
              <button className="x" aria-label="Tutup" onClick={() => setModal(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={saveModal}>
              <label className="field">
                <span>Nama aplikasi *</span>
                <input required maxLength={48} placeholder="cth. MyASN BKN" value={String(modal.name || "")} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Tautan (URL) *</span>
                <input required maxLength={300} placeholder="https://myasn.bkn.go.id" value={String(modal.url || "")} onChange={(e) => setModal({ ...modal, url: e.target.value })} />
              </label>
              <label className="field">
                <span>Deskripsi singkat</span>
                <input maxLength={120} value={String(modal.desc || "")} onChange={(e) => setModal({ ...modal, desc: e.target.value })} />
              </label>
              <div className="two">
                <label className="field">
                  <span>Kategori</span>
                  <select value={String(modal.cat || "Kepegawaian")} onChange={(e) => setModal({ ...modal, cat: e.target.value })}>
                    {CATS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Aksen</span>
                  <select value={String(modal.accent || "gold")} onChange={(e) => setModal({ ...modal, accent: e.target.value })}>
                    <option value="gold">Emas Pusaka</option>
                    <option value="teal">Teal Samudra</option>
                    <option value="clay">Tanah Liat</option>
                    <option value="sage">Daun Sage</option>
                    <option value="ink">Tinta Malam</option>
                  </select>
                </label>
              </div>
              <div className="two">
                <label className="field">
                  <span>Simbol</span>
                  <select value={String(modal.glyph || "◈")} onChange={(e) => setModal({ ...modal, glyph: e.target.value })}>
                    {GLYPHS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check">
                  <input type="checkbox" checked={!!modal.pin} onChange={(e) => setModal({ ...modal, pin: e.target.checked })} />
                  <span>Sematkan di baris depan</span>
                </label>
              </div>
              <label className="check chain-check">
                <input type="checkbox" checked={!!modal.sso} onChange={(e) => setModal({ ...modal, sso: e.target.checked })} />
                <span>⛓ Gembok rantai — hanya terbuka setelah masuk</span>
              </label>
              {formErr && (
                <p className="form-err" role="alert">
                  {formErr}
                </p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setModal(null)}>
                  Batal
                </button>
                <button className="btn-gold" type="submit">
                  <span>Simpan gerbang</span>
                  <i>✓</i>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER */}
      {drawer && (
        <aside className="drawer" aria-label="Pengaturan">
          <div className="drawer-head">
            <div>
              <p className="eyebrow">Perawatan portal</p>
              <h3>Pengaturan</h3>
            </div>
            <button className="x" aria-label="Tutup pengaturan" onClick={() => setDrawer(false)}>
              ✕
            </button>
          </div>
          <section>
            <h4>Ganti kunci masuk (lokal)</h4>
            <label className="field">
              <span>Nama pengguna baru</span>
              <input maxLength={32} value={sUser} onChange={(e) => setSUser(e.target.value)} />
            </label>
            <label className="field">
              <span>Kata sandi baru (min. 6)</span>
              <input type="password" maxLength={64} placeholder="••••••••" value={sPass} onChange={(e) => setSPass(e.target.value)} />
            </label>
            <button className="btn-ghost" onClick={saveCreds}>
              Simpan kunci
            </button>
          </section>
          <section>
            <h4>Arsip data</h4>
            <div className="row">
              <button className="btn-ghost" onClick={exportJson}>
                ⭳ Ekspor JSON
              </button>
              <button className="btn-ghost" onClick={() => needAdmin() && fileRef.current?.click()}>
                ⭱ Impor JSON
              </button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ""; }} />
            </div>
            <button
              className="btn-danger"
              onClick={async () => {
                if (!confirm("Kembalikan 8 aplikasi bawaan?")) return;
                if (!needAdmin()) return;
                try {
                  await api("/api/apps/reset", { method: "POST" });
                  await refreshApps();
                  toast("Kembali ke susunan bawaan.");
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              Kembalikan ke bawaan
            </button>
          </section>
        </aside>
      )}

      {/* PALETTE */}
      {palOpen && (
        <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setPalOpen(false); }}>
          <div className="palette" role="dialog" aria-modal="true" aria-label="Lompat cepat">
            <input placeholder="Ketik nama aplikasi… lalu Enter untuk membuka" value={palQ} onChange={(e) => setPalQ(e.target.value)} autoFocus />
            <div>
              {palList.map((a) => (
                <button key={a.id} className="pal-item" onClick={() => { setPalOpen(false); openApp(a); }}>
                  <b>{a.glyph}</b>
                  <span>
                    {a.name}
                    <br />
                    <small>
                      {a.cat} · {hostOf(a.url)}
                    </small>
                  </span>
                </button>
              ))}
              {palList.length === 0 && <div className="pal-item">Tidak ditemukan — tekan Esc</div>}
            </div>
          </div>
        </div>
      )}

      <div id="toasts" aria-live="polite">
        {toasts.map((t, i) => (
          <div key={i} className="toast">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
