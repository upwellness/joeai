import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { slips } from "@joeai/db";
import { db } from "../../../lib/db";
import { requireUser } from "../../../lib/auth";
import { withAuthErrors } from "../../../lib/route-helpers";

export const runtime = "nodejs";

const querySchema = z.object({
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

export const GET = withAuthErrors(async (req: NextRequest) => {
  await requireUser("admin", "accounting");

  const { searchParams } = new URL(req.url);
  const parse = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const q = parse.data;

  const conds = [] as Array<ReturnType<typeof eq>>;
  if (q.status) conds.push(eq(slips.status, q.status));

  const rows = await db
    .select()
    .from(slips)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(slips.createdAt))
    .limit(q.limit);

  return NextResponse.json({ rows });
});
