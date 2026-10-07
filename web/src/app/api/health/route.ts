import { listApps } from "@/lib/db";
import { SSO_ENABLED } from "@/lib/auth";


export async function GET() {
  const apps = await listApps();
  return Response.json({ ok: true, name: "BERTAUT", apps: apps.length, time: new Date().toISOString(), sso: SSO_ENABLED });
}
