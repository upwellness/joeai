import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auditLog, lineIdentities } from "@joeai/db";
import { db } from "../../../../../lib/db";
import { requireUser } from "../../../../../lib/auth";
import { withAuthErrors } from "../../../../../lib/route-helpers";

export const runtime = "nodejs";

const bodySchema = z.object({
  employeeId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

export const POST = withAuthErrors(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser("admin", "manager");
    const { id } = await ctx.params;

    const body = await req.json().catch(() => null);
    const parse = bodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.flatten() },
        { status: 400 }
      );
    }
    if (!parse.data.employeeId && !parse.data.customerId) {
      return NextResponse.json(
        { error: "must_provide_employee_or_customer" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(lineIdentities)
      .set({
        employeeId: parse.data.employeeId ?? null,
        customerId: parse.data.customerId ?? null,
      })
      .where(eq(lineIdentities.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await db.insert(auditLog).values({
      actorId: user.id,
      action: "identity.map",
      entityType: "line_identity",
      entityId: id,
      afterState: parse.data,
      ipAddress: (req.headers.get("x-forwarded-for") ?? null) as never,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ identity: updated });
  }
);
