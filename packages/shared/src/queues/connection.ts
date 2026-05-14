import { Redis } from "ioredis";

let _connection: Redis | undefined;

/**
 * BullMQ-compatible Redis connection.
 * Note: BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck: false`.
 */
export function getQueueConnection(): Redis {
  if (!_connection) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    _connection = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return _connection;
}

export async function closeQueueConnection(): Promise<void> {
  if (_connection) {
    await _connection.quit();
    _connection = undefined;
  }
}
