import jwt from "jsonwebtoken";
import { env } from "@/config/app.config";

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
  permissions: string[];
};

type SignableJwtPayload = Pick<JwtPayload, "sub" | "email" | "role" | "organizationId" | "permissions">;

function parseExpiry(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const num = parseInt(match[1]);
  switch (match[2]) {
    case "s": return num;
    case "m": return num * 60;
    case "h": return num * 3600;
    case "d": return num * 86400;
    default: return num;
  }
}

export function signAccessToken(payload: SignableJwtPayload): string {
  return jwt.sign(
    { sub: payload.sub, email: payload.email, role: payload.role, organizationId: payload.organizationId, permissions: payload.permissions },
    env.JWT_SECRET,
    { expiresIn: parseExpiry(env.JWT_EXPIRES_IN) }
  );
}

export function signRefreshToken(payload: SignableJwtPayload): string {
  return jwt.sign(
    { sub: payload.sub, email: payload.email, role: payload.role, organizationId: payload.organizationId, permissions: payload.permissions },
    env.JWT_REFRESH_SECRET,
    { expiresIn: parseExpiry(env.JWT_REFRESH_EXPIRES_IN) }
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
