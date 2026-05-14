import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { loggerOptions, getEnv } from "@joeai/shared";
import { authRoutes } from "./routes/auth";
import { messagesRoutes } from "./routes/messages";
import { slipsRoutes } from "./routes/slips";
import { identitiesRoutes } from "./routes/identities";
import { statementsRoutes } from "./routes/statements";

export async function buildServer() {
  const env = getEnv();

  const app = Fastify({
    logger: loggerOptions("api"),
    bodyLimit: 10 * 1024 * 1024, // 10MB for statement uploads
  });

  await app.register(cors, {
    origin: env.NODE_ENV === "development" ? true : [/\.upwellness\.com$/],
    credentials: true,
  });

  await app.register(cookie, {
    secret: env.AUTH_SECRET,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  }));

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(messagesRoutes, { prefix: "/api/messages" });
  await app.register(slipsRoutes, { prefix: "/api/slips" });
  await app.register(identitiesRoutes, { prefix: "/api/identities" });
  await app.register(statementsRoutes, { prefix: "/api/statements" });

  return app;
}
