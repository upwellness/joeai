import { and, between, eq, sql } from "drizzle-orm";
import {
  bankTransactions,
  slips,
  lineIdentities,
  messages,
} from "@joeai/db";
import {
  LineClient,
  createLogger,
  getEnv,
  matchSlip,
  type BankTransactionCandidate,
  type SlipMatchingJob,
  type SlipExtraction,
} from "@joeai/shared";
import { db } from "../db";

const log = createLogger("handler.slip-matching");

function startOfBangkokDay(d: Date): Date {
  const utc = new Date(d.getTime());
  utc.setUTCHours(-7, 0, 0, 0);
  return utc;
}
function endOfBangkokDay(d: Date): Date {
  const start = startOfBangkokDay(d);
  return new Date(start.getTime() + 24 * 3600 * 1000 - 1);
}

export async function handleSlipMatching(job: SlipMatchingJob): Promise<void> {
  const env = getEnv();

  const [slip] = await db
    .select()
    .from(slips)
    .where(eq(slips.id, job.slipId))
    .limit(1);
  if (!slip) throw new Error(`Slip ${job.slipId} not found`);

  const amount = slip.extractedAmount ? Number(slip.extractedAmount) : null;
  const extraction: SlipExtraction = {
    amount,
    datetime: slip.extractedDatetime,
    referenceNumber: slip.extractedRef,
    bankFrom: slip.extractedBankFrom,
    bankTo: slip.extractedBankTo,
    accountTo: slip.extractedAccountTo,
  };

  if (extraction.amount === null) {
    await markStatus(slip.id, "unresolved");
    return;
  }

  const center = extraction.datetime ?? slip.createdAt;
  const from = startOfBangkokDay(new Date(center.getTime() - 24 * 3600 * 1000));
  const to = endOfBangkokDay(new Date(center.getTime() + 24 * 3600 * 1000));

  const rows = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        between(bankTransactions.txnDatetime, from, to),
        eq(bankTransactions.amount, extraction.amount.toFixed(2))
      )
    );

  const candidates: BankTransactionCandidate[] = rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    txnDatetime: r.txnDatetime,
    referenceNumber: r.referenceNumber,
    alreadyMatched: !!r.matchedSlipId,
  }));

  const outcome = matchSlip(extraction, candidates, {
    autoMatchThreshold: env.SLIP_AUTO_REPLY_CONFIDENCE_THRESHOLD,
    reviewThreshold: env.SLIP_REVIEW_CONFIDENCE_THRESHOLD,
  });

  if (outcome.status === "matched_auto") {
    const claimed = await claimTransaction(outcome.transaction.id, slip.id);
    if (!claimed) {
      log.info(
        { slipId: slip.id, txnId: outcome.transaction.id },
        "Lost race on txn claim — re-matching"
      );
      throw new Error("txn_already_claimed");
    }

    await db
      .update(slips)
      .set({
        status: "matched_auto",
        matchedTxnId: outcome.transaction.id,
        matchConfidence: outcome.confidence.toString(),
        matchMethod: outcome.method,
        matchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(slips.id, slip.id));

    await sendReply(slip.id, "matched_auto", extraction.amount);
    return;
  }

  if (outcome.status === "pending_review") {
    await db
      .update(slips)
      .set({
        status: "pending_review",
        matchConfidence: outcome.confidence.toString(),
        matchMethod: outcome.method,
        updatedAt: new Date(),
      })
      .where(eq(slips.id, slip.id));

    await sendReply(slip.id, "pending_review", extraction.amount);
    return;
  }

  await markStatus(slip.id, "unresolved");
  await sendReply(slip.id, "unresolved", extraction.amount);
}

async function claimTransaction(
  txnId: string,
  slipId: string
): Promise<boolean> {
  const result = await db
    .update(bankTransactions)
    .set({ matchedSlipId: slipId })
    .where(
      and(
        eq(bankTransactions.id, txnId),
        sql`${bankTransactions.matchedSlipId} IS NULL`
      )
    )
    .returning({ id: bankTransactions.id });
  return result.length > 0;
}

async function markStatus(slipId: string, status: "unresolved") {
  await db
    .update(slips)
    .set({ status, updatedAt: new Date() })
    .where(eq(slips.id, slipId));
}

async function sendReply(
  slipId: string,
  outcome: "matched_auto" | "pending_review" | "unresolved",
  amount: number
): Promise<void> {
  const env = getEnv();
  const line = new LineClient(env.LINE_CHANNEL_ACCESS_TOKEN);

  const [row] = await db
    .select({ lineUserId: lineIdentities.lineUserId })
    .from(slips)
    .innerJoin(messages, eq(messages.id, slips.messageId))
    .innerJoin(lineIdentities, eq(lineIdentities.id, messages.lineIdentityId))
    .where(eq(slips.id, slipId))
    .limit(1);

  if (!row?.lineUserId) {
    log.warn({ slipId }, "Cannot send reply — no LINE userId found");
    return;
  }

  const message =
    outcome === "matched_auto"
      ? `ขอบคุณค่ะ ✓ ยืนยันการชำระเงินยอด ${formatBaht(amount)} เรียบร้อยแล้ว`
      : outcome === "pending_review"
      ? `ขอบคุณค่ะ ทางเรากำลังตรวจสอบยอด ${formatBaht(amount)} จะแจ้งกลับภายใน 2 ชั่วโมง`
      : `ขอบคุณค่ะ แต่ระบบยังไม่พบยอด ${formatBaht(amount)} กรุณาส่ง slip อีกครั้ง หรือแจ้งเลขอ้างอิง`;

  try {
    await line.pushMessage(row.lineUserId, [{ type: "text", text: message }]);

    await db
      .update(slips)
      .set({
        replySentAt: new Date(),
        replyTemplate: outcome,
        updatedAt: new Date(),
      })
      .where(eq(slips.id, slipId));
  } catch (err) {
    log.error({ err, slipId }, "Failed to send LINE reply");
  }
}

function formatBaht(amount: number): string {
  return (
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " บาท"
  );
}
