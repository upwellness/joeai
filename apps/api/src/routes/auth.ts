import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createSessionToken,
  findEmployeeByEmail,
  verifyPassword,
} from "../auth";
import { getEnv } from "@joeai/shared";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", async (request, reply) => {
    const parse = loginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: "invalid_input" });
    }
    const { email, password } = parse.data;

    const employee = await findEmployeeByEmail(email);
    if (!employee || !employee.passwordHash || !employee.active) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const ok = await verifyPassword(password, employee.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const token = createSessionToken(employee.id);
    const env = getEnv();
    reply.setCookie(env.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });

    return {
      id: employee.id,
      email: employee.email,
      fullName: employee.fullName,
      role: employee.role,
    };
  });

  app.post("/logout", async (request, reply) => {
    const env = getEnv();
    reply.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });
};
