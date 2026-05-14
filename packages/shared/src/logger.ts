import pino, { type Logger as PinoLogger, type LoggerOptions } from "pino";

/**
 * Logger options shared across all services. PII redact paths centralised here.
 */
export function loggerOptions(service: string): LoggerOptions {
  return {
    name: service,
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      // Never log message content or PII
      paths: [
        "*.text",
        "*.textContent",
        "*.transcript",
        "*.ocrRawText",
        "*.passwordHash",
        "*.password",
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers['x-line-signature']",
      ],
      remove: true,
    },
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  };
}

export function createLogger(service: string): PinoLogger {
  return pino(loggerOptions(service));
}

export type Logger = PinoLogger;
