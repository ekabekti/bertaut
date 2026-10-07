import { listApps } from "@/lib/db";
import { getBearer } from "@/lib/auth";


export async function GET(req: Request) {
  const me = await getBearer(req);
  if (!me) return Response.json({ error: "Perlu masuk sebagai pengelola." }, { status: 401 });
  if (!me.canManage) return Response.json({ error: "Akun SSO Anda tidak punya peran pengelola." }, { status: 403 });
  const apps = await listApps();
  return Response.json({ apps, exportedAt: new Date().toISOString() });
}
