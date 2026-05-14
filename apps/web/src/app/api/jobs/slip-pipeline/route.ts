import type { SlipPipelineJob } from "@joeai/shared";
import { jobHandler } from "../../../../lib/job-route";
import { handleSlipPipeline } from "../../../../lib/handlers/slip-pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = jobHandler<SlipPipelineJob>(
  "slip-pipeline",
  handleSlipPipeline
);
