#!/usr/bin/env tsx
/**
 * LINE webhook simulator — useful in dev.
 *
 * Usage:
 *   pnpm tsx scripts/sim-line.ts text --from sale --to group --text "ลูกค้าโอนแล้ว"
 *   pnpm tsx scripts/sim-line.ts image --from customer --to user
 */

import { createHmac } from "node:crypto";
import { argv } from "node:process";

const SECRET = process.env.LINE_CHANNEL_SECRET ?? "test-secret";
const URL = process.env.WEBHOOK_URL ?? "http://localhost:3001/webhook/line";

interface Args {
  type: "text" | "image" | "audio" | "follow";
  from?: "sale" | "customer";
  to?: "group" | "user";
  text?: string;
}

function parseArgs(): Args {
  const out: Args = { type: "text" };
  const [, , type, ...rest] = argv;
  out.type = (type as Args["type"]) ?? "text";
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i];
    const v = rest[i + 1];
    if (!k || !v) continue;
    if (k === "--from") out.from = v as Args["from"];
    if (k === "--to") out.to = v as Args["to"];
    if (k === "--text") out.text = v;
  }
  return out;
}

function makeEvent(args: Args) {
  const userId = args.from === "sale" ? "U_sale_abc" : "U_customer_xyz";
  const source =
    args.to === "group"
      ? { type: "group", groupId: "C_group_001", userId }
      : { type: "user", userId };

  const baseMsg: Record<string, unknown> = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };

  let message: Record<string, unknown>;
  if (args.type === "text") {
    message = {
      ...baseMsg,
      type: "text",
      text: args.text ?? "Hello from sim",
    };
  } else if (args.type === "image") {
    message = {
      ...baseMsg,
      type: "image",
      contentProvider: { type: "line" },
    };
  } else if (args.type === "audio") {
    message = {
      ...baseMsg,
      type: "audio",
      duration: 5000,
      contentProvider: { type: "line" },
    };
  } else {
    throw new Error(`Unsupported type: ${args.type}`);
  }

  return {
    type: "message",
    webhookEventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    source,
    replyToken: "rt_" + Math.random().toString(36).slice(2),
    message,
  };
}

async function main() {
  const args = parseArgs();
  const body = JSON.stringify({
    destination: "U_destination",
    events: [makeEvent(args)],
  });
  const signature = createHmac("sha256", SECRET).update(body).digest("base64");

  console.log("→ POST", URL);
  console.log("body:", body);

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-signature": signature,
    },
    body,
  });

  const text = await res.text();
  console.log("←", res.status, text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
