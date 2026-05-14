import { buildServer } from "./server";
import { getEnv } from "@joeai/shared";

async function main() {
  const env = getEnv();
  const app = await buildServer();

  try {
    await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
    app.log.info(`API listening on :${env.API_PORT}`);
  } catch (err) {
    app.log.error(err, "Failed to start");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
