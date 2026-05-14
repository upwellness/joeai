import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { bankTransactions, statementUploads } from "@joeai/db";
import { getDb } from "@joeai/db";
import { requireAuth, type AuthenticatedRequest } from "../auth";

const uploadBody = z.object({
  bank: z.string().min(1),
  accountNumber: z.string().optional(),
  statementDate: z.string().date(),
  transactions: z
    .array(
      z.object({
        txnDatetime: z.string().datetime(),
        amount: z.number().positive(),
        description: z.string().optional(),
        referenceNumber: z.string().optional(),
        channel: z.string().optional(),
      })
    )
    .min(1),
});

export const statementsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth("admin", "accounting"));

  app.get("/", async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(statementUploads)
      .orderBy(desc(statementUploads.uploadedAt))
      .limit(100);
    return { rows };
  });

  app.get<{ Params: { id: string } }>("/:id/transactions", async (request) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(bankTransactions)
      .where(eq(bankTransactions.statementUploadId, request.params.id))
      .orderBy(desc(bankTransactions.txnDatetime))
      .limit(2000);
    return { rows };
  });

  /**
   * Parsed-statement upload. For v1 the client (or a separate parser job)
   * sends parsed rows directly. A future endpoint will accept the raw file
   * and parse it server-side.
   */
  app.post("/", async (request, reply) => {
    const parse = uploadBody.safeParse(request.body);
    if (!parse.success)
      return reply.code(400).send({ error: parse.error.flatten() });
    const user = (request as AuthenticatedRequest).user;
    const db = getDb();

    const [upload] = await db
      .insert(statementUploads)
      .values({
        uploadedBy: user.id,
        bank: parse.data.bank,
        accountNumber: parse.data.accountNumber ?? null,
        statementDate: parse.data.statementDate,
        rowCount: parse.data.transactions.length,
        status: "parsed",
      })
      .returning();

    if (!upload) return reply.code(500).send({ error: "insert_failed" });

    const txnRows = parse.data.transactions.map((t) => ({
      statementUploadId: upload.id,
      bank: parse.data.bank,
      accountNumber: parse.data.accountNumber ?? null,
      txnDatetime: new Date(t.txnDatetime),
      amount: t.amount.toFixed(2),
      description: t.description ?? null,
      referenceNumber: t.referenceNumber ?? null,
      channel: t.channel ?? null,
      rawRow: t,
    }));

    // Bulk insert with conflict-on-unique-index to skip duplicates
    await db.insert(bankTransactions).values(txnRows).onConflictDoNothing();

    return {
      upload,
      inserted: txnRows.length,
    };
  });
};
