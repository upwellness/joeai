import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/*",
  "apps/webhook",
  "apps/worker",
  "apps/api",
]);
