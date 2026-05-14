import { Queue, QueueEvents } from "bullmq";
import { getQueueConnection } from "./connection";
import type { LineWebhookEvent } from "../line/types";

// =============================================
// Job payloads (typed)
// =============================================

export interface MessageEventJob {
  event: LineWebhookEvent;
  receivedAt: string; // ISO timestamp
}

export interface MediaDownloadJob {
  messageId: string; // internal UUID
  lineMessageId: string;
  mediaType: "image" | "video" | "audio" | "file";
}

export interface OcrJob {
  slipId: string;
}

export interface SttJob {
  mediaAttachmentId: string;
}

export interface SlipPipelineJob {
  messageId: string;
}

export interface SlipMatchingJob {
  slipId: string;
}

// =============================================
// Queue names (used everywhere)
// =============================================

export const QUEUE_NAMES = {
  messageEvents: "message-events",
  mediaDownload: "media-download",
  ocr: "ocr-jobs",
  stt: "stt-jobs",
  slipPipeline: "slip-pipeline",
  slipMatching: "slip-matching",
} as const;

// =============================================
// Queue factories
// =============================================

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 86400, count: 5000 },
  removeOnFail: { age: 7 * 86400 },
} as const;

export function makeMessageEventsQueue() {
  return new Queue<MessageEventJob>(QUEUE_NAMES.messageEvents, {
    connection: getQueueConnection(),
    defaultJobOptions,
  });
}

export function makeMediaDownloadQueue() {
  return new Queue<MediaDownloadJob>(QUEUE_NAMES.mediaDownload, {
    connection: getQueueConnection(),
    defaultJobOptions,
  });
}

export function makeOcrQueue() {
  return new Queue<OcrJob>(QUEUE_NAMES.ocr, {
    connection: getQueueConnection(),
    defaultJobOptions,
  });
}

export function makeSttQueue() {
  return new Queue<SttJob>(QUEUE_NAMES.stt, {
    connection: getQueueConnection(),
    defaultJobOptions,
  });
}

export function makeSlipPipelineQueue() {
  return new Queue<SlipPipelineJob>(QUEUE_NAMES.slipPipeline, {
    connection: getQueueConnection(),
    defaultJobOptions,
  });
}

export function makeSlipMatchingQueue() {
  return new Queue<SlipMatchingJob>(QUEUE_NAMES.slipMatching, {
    connection: getQueueConnection(),
    defaultJobOptions,
  });
}

export function makeQueueEvents(name: string) {
  return new QueueEvents(name, { connection: getQueueConnection() });
}
