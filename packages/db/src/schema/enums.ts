import { pgEnum } from "drizzle-orm/pg-core";

export const conversationTypeEnum = pgEnum("conversation_type", [
  "group",
  "room",
  "user",
]);

export const conversationPurposeEnum = pgEnum("conversation_purpose", [
  "sales_internal",
  "customer_support",
  "unknown",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "image",
  "video",
  "audio",
  "file",
  "location",
  "sticker",
  "unknown",
]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);

export const mediaStatusEnum = pgEnum("media_status", [
  "pending",
  "downloading",
  "stored",
  "failed",
  "expired",
]);

export const slipStatusEnum = pgEnum("slip_status", [
  "received",
  "ocr_pending",
  "ocr_done",
  "ocr_failed",
  "matched_auto",
  "pending_review",
  "matched_manual",
  "rejected",
  "unresolved",
]);

export const employeeRoleEnum = pgEnum("employee_role", [
  "sale",
  "manager",
  "admin",
  "accounting",
]);
