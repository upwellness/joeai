import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { lineIdentities } from "@joeai/db";
import { db } from "../../../lib/db";
import { requireUser } from "../../../lib/auth";
import { withAuthErrors } from "../../../lib/route-helpers";

export const runtime = "nodejs";

export const GET = withAuthErrors(async (req: NextRequest) => {
  await requireUser("admin", "manager");
  const { searchParams } = new URL(req.url);

  const conds = [] as Array<ReturnType<typeof eq>>;
  if (searchParams.get("unmappedOnly") === "true") {
    conds.push(isNull(lineIdentities.employeeId) as never);
    conds.push(isNull(lineIdentities.customerId) as never);
  }

  const rows = await db
    .select()
    .from(lineIdentities)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(lineIdentities.lastSeenAt))
    .limit(200);

  return NextResponse.json({ rows });
});
