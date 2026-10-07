import { setAdminCreds } from "@/lib/db";
import { getBearer } from "@/lib/auth";


export async function POST(req: Request) {
  const me = await getBearer(req);
  if (!me) return Response.json({ error: "Perlu masuk sebagai pengelola." }, { status: 401 });
  if (!me.canManage) return Response.json({ error: "Akun SSO Anda tidak punya peran pengelola." }, { status: 403 });
  let b: { user?: string; pass?: string };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "JSON tidak valid" }, { status: 400 });
  }
  if (b.user !== undefined) {
    const nu = String(b.user).trim().slice(0, 32);
    if (nu.length < 3) return Response.json({ error: "Nama pengguna minimal 3 huruf." }, { status: 400 });
    await setAdminCreds(nu, undefined);
  }
  if (b.pass !== undefined && b.pass !== "") {
    if (String(b.pass).length < 6)
      return Response.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });
    await setAdminCreds(undefined, String(b.pass));
  }
  const { getAdmin } = await import("@/lib/db");
  const admin = await getAdmin();
  return Response.json({ ok: true, user: admin.user });
}
