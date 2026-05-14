import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import {
  conversations,
  lineIdentities,
  mediaAttachments,
  messages,
} from "@joeai/db";
import { getDb } from "@joeai/db";
import { requireAuth } from "../auth";

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
  cursor: z.string().optional(), // ISO timestamp for keyset pagination
});

export const messagesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth("admin", "manager", "accounting"));

  app.get("/", async (request, reply) => {
    const parse = querySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten() });
    }
    const q = parse.data;
    const db = getDb();

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
      .leftJoin(
        lineIdentities,
        eq(lineIdentities.id, messages.lineIdentityId)
      )
      .leftJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(messages.lineTimestamp))
      .limit(q.limit);

    const nextCursor =
      rows.length === q.limit
        ? rows[rows.length - 1]!.lineTimestamp.toISOString()
        : null;

    return { rows, nextCursor };
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const db = getDb();
    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, request.params.id))
      .limit(1);
    if (!row) return reply.code(404).send({ error: "not_found" });

    const media = await db
      .select()
      .from(mediaAttachments)
      .where(eq(mediaAttachments.messageId, row.id));

    return { message: row, media };
  });
};
