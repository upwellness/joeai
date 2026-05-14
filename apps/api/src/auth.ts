import { createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { employees, type Employee } from "@joeai/db";
import { getDb } from "@joeai/db";
import { getEnv } from "@joeai/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days

// Lightweight stateless session token:
//   <employeeId>:<expiresAtMs>:<hmac>
// In production prefer a session table or proper JWT lib.

function sign(payload: string): string {
  return createHmac("sha256", getEnv().AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(employeeId: string): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${employeeId}:${expiresAt}`;
  return `${payload}:${sign(payload)}`;
}

export function verifySessionToken(
  token: string
): { employeeId: string; expiresAt: number } | null {
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  const [employeeId, expStr, sig] = parts as [string, string, string];
  const expected = sign(`${employeeId}:${expStr}`);
  if (expected !== sig) return null;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  return { employeeId, expiresAt };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function findEmployeeByEmail(
  email: string
): Promise<Employee | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, email))
    .limit(1);
  return row ?? null;
}

export async function findEmployeeById(id: string): Promise<Employee | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1);
  return row ?? null;
}

export type AuthenticatedRequest = FastifyRequest & {
  user: Employee;
};

export function requireAuth(...roles: Employee["role"][]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const env = getEnv();
    const cookie = (req as FastifyRequest & {
      cookies?: Record<string, string>;
    }).cookies?.[env.SESSION_COOKIE_NAME];

    if (!cookie) {
      return reply.code(401).send({ error: "unauthenticated" });
    }
    const decoded = verifySessionToken(cookie);
    if (!decoded) {
      return reply.code(401).send({ error: "invalid_session" });
    }
    const user = await findEmployeeById(decoded.employeeId);
    if (!user || !user.active) {
      return reply.code(401).send({ error: "user_inactive" });
    }
    if (roles.length && !roles.includes(user.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }
    (req as AuthenticatedRequest).user = user;
  };
}

export function generateRandomToken(): string {
  return randomBytes(32).toString("base64url");
}
