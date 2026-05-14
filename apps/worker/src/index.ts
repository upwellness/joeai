import { Worker } from "bullmq";
import {
  QUEUE_NAMES,
  createLogger,
  getEnv,
  getQueueConnection,
  closeQueueConnection,
  type MessageEventJob,
  type MediaDownloadJob,
  type OcrJob,
  type SttJob,
  type SlipPipelineJob,
  type SlipMatchingJob,
} from "@joeai/shared";

import { handleMessageEvent } from "./handlers/message-event";
import { handleMediaDownload } from "./handlers/media-download";
import { handleOcr } from "./handlers/ocr";
import { handleStt } from "./handlers/stt";
import { handleSlipPipeline } from "./handlers/slip-pipeline";
import { handleSlipMatching } from "./handlers/slip-matching";

const log = createLogger("worker");

function startWorker<T>(
  name: string,
  handler: (data: T) => Promise<void>,
  concurrency = 4
) {
  const connection = getQueueConnection();
  const worker = new Worker<T>(
    name,
    async (job) => handler(job.data),
    { connection, concurrency }
  );
  worker.on("completed", (job) =>
    log.info({ queue: name, jobId: job.id }, "Job complete")
  );
  worker.on("failed", (job, err) =>
    log.error(
      { queue: name, jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
      "Job failed"
    )
  );
  return worker;
}

async function main() {
  getEnv(); // validate env up front

  log.info("Starting workers...");

  const workers = [
    startWorker<MessageEventJob>(QUEUE_NAMES.messageEvents, handleMessageEvent, 10),
    startWorker<MediaDownloadJob>(QUEUE_NAMES.mediaDownload, handleMediaDownload, 5),
    startWorker<SlipPipelineJob>(QUEUE_NAMES.slipPipeline, handleSlipPipeline, 4),
    startWorker<OcrJob>(QUEUE_NAMES.ocr, handleOcr, 4),
    startWorker<SttJob>(QUEUE_NAMES.stt, handleStt, 2),
    startWorker<SlipMatchingJob>(QUEUE_NAMES.slipMatching, handleSlipMatching, 4),
  ];

  log.info({ count: workers.length }, "Workers started");

  const shutdown = async (signal: string) => {
    log.info(`${signal} received, shutting down workers`);
    await Promise.all(workers.map((w) => w.close()));
    await closeQueueConnection();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
