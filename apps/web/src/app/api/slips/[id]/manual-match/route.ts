import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { auditLog, bankTransactions, slips } from "@joeai/db";
import { db } from "../../../../../lib/db";
import { requireUser } from "../../../../../lib/auth";
import { withAuthErrors } from "../../../../../lib/route-helpers";

export const runtime = "nodejs";

const bodySchema = z.object({
  transactionId: z.string().uuid(),
  note: z.string().optional(),
});

export const POST = withAuthErrors(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser("admin", "accounting");
    const { id } = await ctx.params;

    const body = await req.json().catch(() => null);
    const parse = bodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.flatten() },
        { status: 400 }
      );
    }

    const [claimed] = await db
      .update(bankTransactions)
      .set({ matchedSlipId: id })
      .where(
        and(
          eq(bankTransactions.id, parse.data.transactionId),
          sql`${bankTransactions.matchedSlipId} IS NULL`
        )
      )
      .returning();

    if (!claimed) {
      return NextResponse.json(
        { error: "transaction_already_matched" },
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(slips)
      .set({
        status: "matched_manual",
        matchedTxnId: parse.data.transactionId,
        matchedBy: user.id,
        matchMethod: "manual",
        matchConfidence: "1.00",
        matchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(slips.id, id))
      .returning();

    await db.insert(auditLog).values({
      actorId: user.id,
      action: "slip.manual_match",
      entityType: "slip",
      entityId: id,
      afterState: parse.data,
      ipAddress: (req.headers.get("x-forwarded-for") ?? null) as never,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ slip: updated });
  }
);
