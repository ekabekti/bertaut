import { createSsoState, getDiscovery, SSO_CLIENT_ID, SSO_SCOPES, ssoRedirectUri } from "@/lib/auth";
import { NextResponse } from "next/server";


export async function GET(req: Request) {
  try {
    const disc = await getDiscovery();
    const { state, nonce } = await createSsoState();
    const authUrl = new URL(String(disc.authorization_endpoint));
    authUrl.searchParams.set("client_id", SSO_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", ssoRedirectUri(req));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SSO_SCOPES);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    return NextResponse.redirect(authUrl.toString());
  } catch (e) {
    return Response.json({ error: "SSO belum siap: " + (e as Error).message }, { status: 500 });
  }
}
