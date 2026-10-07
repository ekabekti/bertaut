import {
  extractRoles,
  getDiscovery,
  signSession,
  SSO_ADMIN_ROLES,
  SSO_CLIENT_ID,
  SSO_CLIENT_SECRET,
  ssoRedirectUri,
  verifyIdToken,
  verifySsoState,
} from "@/lib/auth";
import { NextResponse } from "next/server";


export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errDesc = url.searchParams.get("error_description") || url.searchParams.get("error");
  const home = new URL("/", req.url);
  if (errDesc && !code) {
    home.searchParams.set("sso_error", errDesc);
    return NextResponse.redirect(home.toString());
  }
  if (!code || !state) return Response.json({ error: "Callback SSO tidak lengkap." }, { status: 400 });
  const saved = await verifySsoState(state);
  if (!saved) {
    home.searchParams.set("sso_error", "State SSO kedaluwarsa. Coba lagi.");
    return NextResponse.redirect(home.toString());
  }
  try {
    const disc = await getDiscovery();
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", ssoRedirectUri(req));
    body.set("client_id", SSO_CLIENT_ID);
    if (SSO_CLIENT_SECRET) body.set("client_secret", SSO_CLIENT_SECRET);
    const tr = await fetch(String(disc.token_endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    const tj = (await tr.json().catch(() => ({}))) as Record<string, string>;
    if (!tr.ok) throw new Error(tj.error_description || tj.error || `token exchange ${tr.status}`);
    if (!tj.id_token) throw new Error("Keycloak tidak mengembalikan id_token.");
    const claims = await verifyIdToken(tj.id_token, disc as Record<string, unknown>);
    const claimNonce = (claims.nonce as string | undefined) || "";
    if (claimNonce && claimNonce !== saved.nonce) throw new Error("nonce tidak cocok.");
    const roles = extractRoles(claims);
    const canManage = roles.some((r) => SSO_ADMIN_ROLES.includes(r));
    const username =
      (claims.preferred_username as string) || (claims.email as string) || (claims.name as string) || "sso-user";
    const token = await signSession({
      user: String(username),
      sso: true,
      roles,
      canManage,
      sub: (claims.sub as string) || null,
    });
    // Token via fragment agar tidak tercatat di log server
    return NextResponse.redirect(new URL(`/#sso_token=${encodeURIComponent(token)}`, req.url).toString());
  } catch (e) {
    console.error("[bertaut][sso]", (e as Error).message);
    home.searchParams.set("sso_error", (e as Error).message);
    return NextResponse.redirect(home.toString());
  }
}
