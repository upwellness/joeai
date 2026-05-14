import type { MediaDownloadJob } from "@joeai/shared";
import { jobHandler } from "../../../../lib/job-route";
import { handleMediaDownload } from "../../../../lib/handlers/media-download";

export const runtime = "nodejs";
export const maxDuration = 90;

export const POST = jobHandler<MediaDownloadJob>(
  "media-download",
  handleMediaDownload
);
