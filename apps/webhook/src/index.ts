import { buildServer } from "./server";
import { getEnv } from "@joeai/shared";

async function main() {
  const env = getEnv();
  const app = await buildServer();

  try {
    await app.listen({ port: env.WEBHOOK_PORT, host: "0.0.0.0" });
    app.log.info(`Webhook listening on :${env.WEBHOOK_PORT}`);
  } catch (err) {
    app.log.error(err, "Failed to start");
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error(err, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
