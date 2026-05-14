import type { SlipMatchingJob } from "@joeai/shared";
import { jobHandler } from "../../../../lib/job-route";
import { handleSlipMatching } from "../../../../lib/handlers/slip-matching";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = jobHandler<SlipMatchingJob>(
  "slip-matching",
  handleSlipMatching
);
