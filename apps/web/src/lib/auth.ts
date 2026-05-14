import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { employees, type Employee } from "@joeai/db";
import { getEnv } from "@joeai/shared";
import { db } from "./db";
import { cookies } from "next/headers";

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

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
  const [row] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, email))
    .limit(1);
  return row ?? null;
}

export async function findEmployeeById(id: string): Promise<Employee | null> {
  const [row] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Resolve the current user from the session cookie. Returns null when
 * not authenticated. Use in route handlers + server components.
 */
export async function getCurrentUser(): Promise<Employee | null> {
  const env = getEnv();
  const cookieStore = await cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const decoded = verifySessionToken(token);
  if (!decoded) return null;

  const user = await findEmployeeById(decoded.employeeId);
  if (!user || !user.active) return null;
  return user;
}

/**
 * Require auth in a route handler. Returns the user, or throws an
 * AuthError that the handler should catch and turn into 401/403.
 */
export async function requireUser(
  ...roles: Employee["role"][]
): Promise<Employee> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "unauthenticated");
  if (roles.length && !roles.includes(user.role)) {
    throw new AuthError(403, "forbidden");
  }
  return user;
}

export class AuthError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}
