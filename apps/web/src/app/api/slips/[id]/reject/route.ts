import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auditLog, slips } from "@joeai/db";
import { db } from "../../../../../lib/db";
import { requireUser } from "../../../../../lib/auth";
import { withAuthErrors } from "../../../../../lib/route-helpers";

export const runtime = "nodejs";

const bodySchema = z.object({ reason: z.string().min(1) });

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

    const [updated] = await db
      .update(slips)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(slips.id, id))
      .returning();

    await db.insert(auditLog).values({
      actorId: user.id,
      action: "slip.reject",
      entityType: "slip",
      entityId: id,
      afterState: { reason: parse.data.reason },
      ipAddress: (req.headers.get("x-forwarded-for") ?? null) as never,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ slip: updated });
  }
);
