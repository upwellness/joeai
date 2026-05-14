import { NextResponse, type NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { bankTransactions, slips } from "@joeai/db";
import { db } from "../../../../lib/db";
import { requireUser } from "../../../../lib/auth";
import { withAuthErrors } from "../../../../lib/route-helpers";

export const runtime = "nodejs";

export const GET = withAuthErrors(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    await requireUser("admin", "accounting");
    const { id } = await ctx.params;

    const [row] = await db.select().from(slips).where(eq(slips.id, id)).limit(1);
    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

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

    return NextResponse.json({ slip: row, candidates });
  }
);
