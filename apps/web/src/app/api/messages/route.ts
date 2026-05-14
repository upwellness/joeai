import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { conversations, lineIdentities, messages } from "@joeai/db";
import { db } from "../../../lib/db";
import { requireUser } from "../../../lib/auth";
import { withAuthErrors } from "../../../lib/route-helpers";

export const runtime = "nodejs";

const querySchema = z.object({
  conversationId: z.string().uuid().optional(),
  identityId: z.string().uuid().optional(),
  search: z.string().min(1).optional(),
  type: z
    .enum(["text", "image", "video", "audio", "file", "location", "sticker"])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export const GET = withAuthErrors(async (req: NextRequest) => {
  await requireUser("admin", "manager", "accounting");

  const { searchParams } = new URL(req.url);
  const parse = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const q = parse.data;

  const conds = [] as Array<ReturnType<typeof eq>>;
  if (q.conversationId)
    conds.push(eq(messages.conversationId, q.conversationId));
  if (q.identityId) conds.push(eq(messages.lineIdentityId, q.identityId));
  if (q.type) conds.push(eq(messages.messageType, q.type));
  if (q.from) conds.push(gte(messages.lineTimestamp, new Date(q.from)));
  if (q.to) conds.push(lte(messages.lineTimestamp, new Date(q.to)));
  if (q.cursor) conds.push(lte(messages.lineTimestamp, new Date(q.cursor)));
  if (q.search) {
    conds.push(
      or(
        ilike(messages.textContent, `%${q.search}%`),
        ilike(messages.transcript, `%${q.search}%`)
      )!
    );
  }

  const rows = await db
    .select({
      id: messages.id,
      lineMessageId: messages.lineMessageId,
      messageType: messages.messageType,
      textContent: messages.textContent,
      transcript: messages.transcript,
      lineTimestamp: messages.lineTimestamp,
      receivedAt: messages.receivedAt,
      identityId: messages.lineIdentityId,
      identityDisplayName: lineIdentities.currentDisplayName,
      conversationId: messages.conversationId,
      conversationName: conversations.name,
      conversationType: conversations.type,
    })
    .from(messages)
    .leftJoin(lineIdentities, eq(lineIdentities.id, messages.lineIdentityId))
    .leftJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(messages.lineTimestamp))
    .limit(q.limit);

  const nextCursor =
    rows.length === q.limit
      ? rows[rows.length - 1]!.lineTimestamp.toISOString()
      : null;

  return NextResponse.json({ rows, nextCursor });
});
