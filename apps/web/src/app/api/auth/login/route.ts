import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getEnv } from "@joeai/shared";
import {
  createSessionToken,
  findEmployeeByEmail,
  verifyPassword,
} from "../../../../lib/auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parse = loginSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { email, password } = parse.data;

  const employee = await findEmployeeByEmail(email);
  if (!employee || !employee.passwordHash || !employee.active) {
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 }
    );
  }
  const ok = await verifyPassword(password, employee.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 }
    );
  }

  const token = createSessionToken(employee.id);
  const env = getEnv();

  const res = NextResponse.json({
    id: employee.id,
    email: employee.email,
    fullName: employee.fullName,
    role: employee.role,
  });
  res.cookies.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
  return res;
}
