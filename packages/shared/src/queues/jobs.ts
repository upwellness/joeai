import type { LineWebhookEvent } from "../line/types";

/**
 * Job payloads exchanged between QStash producers and consumers.
 * The job path (e.g. "/api/jobs/message-event") is the canonical job name.
 */

export interface MessageEventJob {
  event: LineWebhookEvent;
  receivedAt: string; // ISO timestamp
}

export interface MediaDownloadJob {
  messageId: string;
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

export const JOB_PATHS = {
  messageEvent: "/api/jobs/message-event",
  mediaDownload: "/api/jobs/media-download",
  ocr: "/api/jobs/ocr",
  stt: "/api/jobs/stt",
  slipPipeline: "/api/jobs/slip-pipeline",
  slipMatching: "/api/jobs/slip-matching",
} as const;

export type JobPath = (typeof JOB_PATHS)[keyof typeof JOB_PATHS];
