import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { lineIdentities } from "@joeai/db";
import { getDb } from "@joeai/db";
import { auditLog } from "@joeai/db";
import { requireAuth, type AuthenticatedRequest } from "../auth";

const mapBody = z.object({
  employeeId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

export const identitiesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth("admin", "manager"));

  app.get<{ Querystring: { unmappedOnly?: string } }>(
    "/",
    async (request) => {
      const db = getDb();
      const conds = [] as Array<ReturnType<typeof eq>>;
      if (request.query.unmappedOnly === "true") {
        conds.push(isNull(lineIdentities.employeeId) as never);
        conds.push(isNull(lineIdentities.customerId) as never);
      }
      const rows = await db
        .select()
        .from(lineIdentities)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(lineIdentities.lastSeenAt))
        .limit(200);
      return { rows };
    }
  );

  app.post<{ Params: { id: string } }>("/:id/map", async (request, reply) => {
    const parse = mapBody.safeParse(request.body);
    if (!parse.success)
      return reply.code(400).send({ error: parse.error.flatten() });
    if (!parse.data.employeeId && !parse.data.customerId) {
      return reply.code(400).send({ error: "must_provide_employee_or_customer" });
    }

    const db = getDb();
    const user = (request as AuthenticatedRequest).user;

    const [updated] = await db
      .update(lineIdentities)
      .set({
        employeeId: parse.data.employeeId ?? null,
        customerId: parse.data.customerId ?? null,
      })
      .where(eq(lineIdentities.id, request.params.id))
      .returning();

    if (!updated) return reply.code(404).send({ error: "not_found" });

    await db.insert(auditLog).values({
      actorId: user.id,
      action: "identity.map",
      entityType: "line_identity",
      entityId: request.params.id,
      afterState: parse.data,
      ipAddress: request.ip as never,
      userAgent: request.headers["user-agent"] ?? null,
    });

    return { identity: updated };
  });
};
