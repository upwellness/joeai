import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { bankTransactions, statementUploads } from "@joeai/db";
import { db } from "../../../lib/db";
import { requireUser } from "../../../lib/auth";
import { withAuthErrors } from "../../../lib/route-helpers";

export const runtime = "nodejs";

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

export const GET = withAuthErrors(async () => {
  await requireUser("admin", "accounting");
  const rows = await db
    .select()
    .from(statementUploads)
    .orderBy(desc(statementUploads.uploadedAt))
    .limit(100);
  return NextResponse.json({ rows });
});

export const POST = withAuthErrors(async (req: NextRequest) => {
  const user = await requireUser("admin", "accounting");

  const body = await req.json().catch(() => null);
  const parse = uploadBody.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

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
  if (!upload) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

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

  await db.insert(bankTransactions).values(txnRows).onConflictDoNothing();

  return NextResponse.json({ upload, inserted: txnRows.length });
});
