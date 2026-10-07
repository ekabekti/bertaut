import { getBearer } from "@/lib/auth";


export async function GET(req: Request) {
  const me = await getBearer(req);
  if (!me) return Response.json({ error: "Sesi berakhir." }, { status: 401 });
  return Response.json({ user: me.user, sso: me.sso, roles: me.roles, canManage: me.canManage });
}
