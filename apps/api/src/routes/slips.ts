import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { bankTransactions, slips } from "@joeai/db";
import { getDb } from "@joeai/db";
import { auditLog } from "@joeai/db";
import { requireAuth, type AuthenticatedRequest } from "../auth";

const listQuery = z.object({
  status: z
    .enum([
      "received",
      "ocr_pending",
      "ocr_done",
      "ocr_failed",
      "matched_auto",
      "pending_review",
      "matched_manual",
      "rejected",
      "unresolved",
    ])
    .optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
});

const manualMatchBody = z.object({
  transactionId: z.string().uuid(),
  note: z.string().optional(),
});

const rejectBody = z.object({
  reason: z.string().min(1),
});

export const slipsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth("admin", "accounting"));

  app.get("/", async (request, reply) => {
    const parse = listQuery.safeParse(request.query);
    if (!parse.success)
      return reply.code(400).send({ error: parse.error.flatten() });

    const db = getDb();
    const conds = [] as Array<ReturnType<typeof eq>>;
    if (parse.data.status)
      conds.push(eq(slips.status, parse.data.status));

    const rows = await db
      .select()
      .from(slips)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(slips.createdAt))
      .limit(parse.data.limit);

    return { rows };
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const db = getDb();
    const [row] = await db
      .select()
      .from(slips)
      .where(eq(slips.id, request.params.id))
      .limit(1);
    if (!row) return reply.code(404).send({ error: "not_found" });

    // Candidate transactions for review UI
    const candidates = row.extractedAmount
      ? await db
          .select()
          .from(bankTransactions)
          .where(
            and(
              eq(bankTransactions.amount, row.extractedAmount),
              sql`${bankTransactions.matchedSlipId} IS NULL`
            )
          )
          .limit(10)
      : [];

    return { slip: row, candidates };
  });

  app.post<{ Params: { id: string } }>(
    "/:id/manual-match",
    async (request, reply) => {
      const parse = manualMatchBody.safeParse(request.body);
      if (!parse.success)
        return reply.code(400).send({ error: parse.error.flatten() });
      const { transactionId, note } = parse.data;
      const user = (request as AuthenticatedRequest).user;

      const db = getDb();

      // Claim the transaction atomically
      const [claimed] = await db
        .update(bankTransactions)
        .set({ matchedSlipId: request.params.id })
        .where(
          and(
            eq(bankTransactions.id, transactionId),
            sql`${bankTransactions.matchedSlipId} IS NULL`
          )
        )
        .returning();

      if (!claimed) {
        return reply
          .code(409)
          .send({ error: "transaction_already_matched" });
      }

      const [updated] = await db
        .update(slips)
        .set({
          status: "matched_manual",
          matchedTxnId: transactionId,
          matchedBy: user.id,
          matchMethod: "manual",
          matchConfidence: "1.00",
          matchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(slips.id, request.params.id))
        .returning();

      await db.insert(auditLog).values({
        actorId: user.id,
        action: "slip.manual_match",
        entityType: "slip",
        entityId: request.params.id,
        afterState: { transactionId, note },
        ipAddress: request.ip as never,
        userAgent: request.headers["user-agent"] ?? null,
      });

      return { slip: updated };
    }
  );

  app.post<{ Params: { id: string } }>(
    "/:id/reject",
    async (request, reply) => {
      const parse = rejectBody.safeParse(request.body);
      if (!parse.success)
        return reply.code(400).send({ error: parse.error.flatten() });
      const user = (request as AuthenticatedRequest).user;

      const db = getDb();
      const [updated] = await db
        .update(slips)
        .set({
          status: "rejected",
          updatedAt: new Date(),
        })
        .where(eq(slips.id, request.params.id))
        .returning();

      await db.insert(auditLog).values({
        actorId: user.id,
        action: "slip.reject",
        entityType: "slip",
        entityId: request.params.id,
        afterState: { reason: parse.data.reason },
        ipAddress: request.ip as never,
        userAgent: request.headers["user-agent"] ?? null,
      });

      return { slip: updated };
    }
  );
};
