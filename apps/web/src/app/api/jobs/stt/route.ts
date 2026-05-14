import type { SttJob } from "@joeai/shared";
import { jobHandler } from "../../../../lib/job-route";
import { handleStt } from "../../../../lib/handlers/stt";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = jobHandler<SttJob>("stt", handleStt);
