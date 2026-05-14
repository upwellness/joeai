import { QStashClient, getEnv } from "@joeai/shared";

let _client: QStashClient | undefined;

export function getQueue(): QStashClient {
  if (!_client) {
    const env = getEnv();
    _client = new QStashClient(env.QSTASH_TOKEN, env.APP_BASE_URL);
  }
  return _client;
}

export function getSigningKeys(): { current: string; next: string } {
  const env = getEnv();
  return {
    current: env.QSTASH_CURRENT_SIGNING_KEY,
    next: env.QSTASH_NEXT_SIGNING_KEY,
  };
}
