import { cleanApp, createApp, listApps } from "@/lib/db";
import { getBearer } from "@/lib/auth";


export async function GET() {
  const apps = await listApps();
  return Response.json(apps);
}

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
  const c = cleanApp(b);
  if ("error" in c) return Response.json({ error: c.error }, { status: 400 });
  const id = await createApp({ ...c.app });
  return Response.json({ ok: true, id }, { status: 201 });
}
