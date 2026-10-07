import { getDiscovery } from "@/lib/auth";
import { NextResponse } from "next/server";


export async function GET(req: Request) {
  const url = new URL(req.url);
  // Sesi bersifat stateless (JWT di client) → logout lokal cukup buang token.
  // Opsi: teruskan ke end_session_endpoint Keycloak bila tersedia.
  try {
    const disc = await getDiscovery();
    const end = disc.end_session_endpoint ? String(disc.end_session_endpoint) : null;
    if (end) {
      const lo = new URL(end);
      lo.searchParams.set("post_logout_redirect_uri", url.searchParams.get("next") || new URL("/", req.url).toString());
      const idToken = url.searchParams.get("id_token");
      if (idToken) lo.searchParams.set("id_token_hint", idToken);
      return NextResponse.redirect(lo.toString());
    }
  } catch {}
  return NextResponse.redirect(new URL("/", req.url).toString());
}
