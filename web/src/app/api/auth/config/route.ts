import { SSO_ADMIN_ROLES, SSO_CLIENT_ID, SSO_ENABLED, SSO_ISSUER, ssoRedirectUri } from "@/lib/auth";


export async function GET(req: Request) {
  return Response.json({
    ssoEnabled: SSO_ENABLED,
    issuer: SSO_ISSUER || null,
    clientId: SSO_CLIENT_ID || null,
    redirectUri: ssoRedirectUri(req),
    loginUrl: SSO_ENABLED ? "/api/auth/sso/login" : null,
    adminRoles: SSO_ADMIN_ROLES,
  });
}
