import { getAdmin, hashPass } from "@/lib/db";
import { signSession } from "@/lib/auth";


// Rate-limit sederhana per-instance (best-effort di serverless)
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 5 * 60 * 1000);
  if (arr.length >= 15)
    return Response.json({ error: "Terlalu banyak percobaan. Tunggu 5 menit." }, { status: 429 });
  arr.push(now);
  hits.set(ip, arr);

  let b: { user?: string; pass?: string };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "JSON tidak valid" }, { status: 400 });
  }
  const admin = await getAdmin();
  const okUser = String(b.user || "") === admin.user;
  const okPass = okUser && admin.salt && hashPass(String(b.pass || ""), admin.salt) === admin.hash;
  if (!okPass) {
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: "Kunci tidak cocok." }, { status: 401 });
  }
  const token = await signSession({ user: admin.user, sso: false, roles: ["local-admin"], canManage: true });
  return Response.json({ token, user: admin.user, sso: false, canManage: true });
}
