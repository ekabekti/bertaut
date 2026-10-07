import { cleanApp, replaceApps } from "@/lib/db";
import { getBearer } from "@/lib/auth";
import { randomBytes } from "node:crypto";


export async function POST(req: Request) {
  const me = await getBearer(req);
  if (!me) return Response.json({ error: "Perlu masuk sebagai pengelola." }, { status: 401 });
  if (!me.canManage) return Response.json({ error: "Akun SSO Anda tidak punya peran pengelola." }, { status: 403 });
  let b: unknown;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "JSON tidak valid" }, { status: 400 });
  }
  const arr = Array.isArray(b) ? b : (b as { apps?: unknown }).apps;
  if (!Array.isArray(arr)) return Response.json({ error: "Format berkas tidak valid." }, { status: 400 });
  const out: Array<{
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
  }> = [];
  for (const raw of arr.slice(0, 200)) {
    const c = cleanApp(raw);
    if ("error" in c) continue;
    const r = raw as Record<string, unknown>;
    out.push({
      id: String(r.id || "a" + randomBytes(4).toString("hex")).slice(0, 24),
      ...c.app,
      visits: Number(r.visits) || 0,
      lastOpen: (r.lastOpen as string | null) || null,
    });
  }
  await replaceApps(out);
  return Response.json({ ok: true, count: out.length });
}
