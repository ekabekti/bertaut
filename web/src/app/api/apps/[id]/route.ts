import { cleanApp, deleteApp, updateApp } from "@/lib/db";
import { getBearer } from "@/lib/auth";


async function needAdmin(req: Request) {
  const me = await getBearer(req);
  if (!me) return { error: Response.json({ error: "Perlu masuk sebagai pengelola." }, { status: 401 }) };
  if (!me.canManage)
    return { error: Response.json({ error: "Akun SSO Anda tidak punya peran pengelola." }, { status: 403 }) };
  return { me };
}

export async function PUT(req: Request, ctx: RouteContext<"/api/apps/[id]">) {
  const { error } = await needAdmin(req);
  if (error) return error;
  const { id } = await ctx.params;
  let b: unknown;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "JSON tidak valid" }, { status: 400 });
  }
  const c = cleanApp(b);
  if ("error" in c) return Response.json({ error: c.error }, { status: 400 });
  const ok = await updateApp(id, { ...c.app });
  if (!ok) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/apps/[id]">) {
  const { error } = await needAdmin(req);
  if (error) return error;
  const { id } = await ctx.params;
  await deleteApp(id);
  return Response.json({ ok: true });
}
