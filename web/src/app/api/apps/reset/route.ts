import { resetApps } from "@/lib/db";
import { getBearer } from "@/lib/auth";


export async function POST(req: Request) {
  const me = await getBearer(req);
  if (!me) return Response.json({ error: "Perlu masuk sebagai pengelola." }, { status: 401 });
  if (!me.canManage) return Response.json({ error: "Akun SSO Anda tidak punya peran pengelola." }, { status: 403 });
  await resetApps();
  return Response.json({ ok: true, count: 8 });
}
