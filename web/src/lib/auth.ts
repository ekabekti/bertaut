import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { randomBytes } from "node:crypto";

export type SessionPayload = {
  user: string;
  sso: boolean;
  roles: string[];
  canManage: boolean;
  sub?: string | null;
};

function secretKey() {
  const s = process.env.AUTH_SECRET || "dev-secret-ganti-di-produksi";
  return new TextEncoder().encode(s);
}

export function ttlMs() {
  return Number(process.env.TOKEN_TTL_HOURS || 12) * 3600 * 1000;
}

export async function signSession(p: SessionPayload) {
  const exp = Math.floor((Date.now() + ttlMs()) / 1000);
  const { sub, ...rest } = p;
  const payload: Record<string, unknown> = { ...rest };
  if (sub) payload.sub = sub;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.user) return null;
    return {
      user: String(payload.user),
      sso: !!payload.sso,
      roles: Array.isArray(payload.roles) ? (payload.roles as string[]).map(String) : [],
      canManage: payload.canManage !== undefined ? !!payload.canManage : true,
      sub: (payload.sub as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export async function getBearer(req: Request): Promise<SessionPayload | null> {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer (.+)$/.exec(h);
  if (!m) return null;
  return verifySession(m[1]);
}

/* ---------- SSO Keycloak ---------- */
export const SSO_ISSUER = (process.env.KEYCLOAK_ISSUER || "").replace(/\/$/, "");
export const SSO_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "";
export const SSO_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || "";
export function ssoRedirectUri(req?: Request) {
  if (process.env.KEYCLOAK_REDIRECT_URI) return process.env.KEYCLOAK_REDIRECT_URI;
  // Default: <origin>/api/auth/sso/callback (works on Vercel + local)
  try {
    if (req) return new URL("/api/auth/sso/callback", req.url).toString();
  } catch {}
  return "http://localhost:3000/api/auth/sso/callback";
}
export const SSO_SCOPES = process.env.KEYCLOAK_SCOPES || "openid profile email";
export const SSO_ADMIN_ROLES = (process.env.BERTAUT_ADMIN_ROLES || "bertaut-admin,admin")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
export const SSO_ENABLED = !!(SSO_ISSUER && SSO_CLIENT_ID);

let discoveryCache: Record<string, unknown> | null = null;
let discoveryAt = 0;

export async function getDiscovery() {
  if (!SSO_ENABLED) throw new Error("SSO belum dikonfigurasi (KEYCLOAK_ISSUER/CLIENT_ID kosong).");
  const now = Date.now();
  if (discoveryCache && now - discoveryAt < 10 * 60 * 1000) return discoveryCache;
  const r = await fetch(`${SSO_ISSUER}/.well-known/openid-configuration`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Gagal memuat OIDC discovery (${r.status})`);
  const j = (await r.json()) as Record<string, unknown>;
  if (!j.authorization_endpoint || !j.token_endpoint || !j.jwks_uri) throw new Error("Discovery OIDC tidak lengkap.");
  discoveryCache = j;
  discoveryAt = now;
  return j;
}

export function extractRoles(payload: Record<string, unknown>): string[] {
  const roles = new Set<string>();
  try {
    const p = payload as { realm_access?: { roles?: string[] }; resource_access?: Record<string, { roles?: string[] }> };
    for (const r of p.realm_access?.roles || []) roles.add(String(r));
    const resAccess = p.resource_access || {};
    for (const k of Object.keys(resAccess)) {
      for (const r of resAccess[k]?.roles || []) {
        roles.add(String(r));
        roles.add(`${k}:${String(r)}`);
      }
    }
  } catch {}
  return [...roles];
}

export async function verifyIdToken(idToken: string, discovery: Record<string, unknown>) {
  const JWKS = createRemoteJWKSet(new URL(String(discovery.jwks_uri)));
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: String(discovery.issuer || SSO_ISSUER),
    audience: SSO_CLIENT_ID,
  });
  return payload as unknown as Record<string, unknown>;
}

/* State stateless (JWT 10 mnt) — aman untuk serverless Vercel */
export async function createSsoState() {
  const nonce = randomBytes(16).toString("hex");
  const state = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretKey());
  return { state, nonce };
}

export async function verifySsoState(state: string): Promise<{ nonce: string } | null> {
  try {
    const { payload } = await jwtVerify(state, secretKey());
    if (!payload.nonce) return null;
    return { nonce: String(payload.nonce) };
  } catch {
    return null;
  }
}
