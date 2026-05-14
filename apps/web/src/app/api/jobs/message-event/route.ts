import type { MessageEventJob } from "@joeai/shared";
import { jobHandler } from "../../../../lib/job-route";
import { handleMessageEvent } from "../../../../lib/handlers/message-event";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = jobHandler<MessageEventJob>(
  "message-event",
  handleMessageEvent
);
