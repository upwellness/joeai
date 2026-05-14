import type { FastifyPluginAsync } from "fastify";

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    status: "ok",
    service: "webhook",
    timestamp: new Date().toISOString(),
  }));

  app.get("/", async () => ({
    service: "joeai-webhook",
    docs: "POST /webhook/line",
  }));
};
