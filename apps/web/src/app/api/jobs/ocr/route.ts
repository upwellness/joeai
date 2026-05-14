import type { OcrJob } from "@joeai/shared";
import { jobHandler } from "../../../../lib/job-route";
import { handleOcr } from "../../../../lib/handlers/ocr";

export const runtime = "nodejs";
export const maxDuration = 90;

export const POST = jobHandler<OcrJob>("ocr", handleOcr);
