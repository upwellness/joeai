import { describe, it, expect } from "vitest";
import { matchSlip, scoreCandidate, normalizeRef } from "./matcher";
import type { BankTransactionCandidate, SlipExtraction } from "./types";

const txn = (
  overrides: Partial<BankTransactionCandidate>
): BankTransactionCandidate => ({
  id: "txn-" + Math.random().toString(36).slice(2, 8),
  amount: 1000,
  txnDatetime: new Date("2026-05-14T10:00:00+07:00"),
  referenceNumber: null,
  alreadyMatched: false,
  ...overrides,
});

const slip = (overrides: Partial<SlipExtraction>): SlipExtraction => ({
  amount: 1000,
  datetime: new Date("2026-05-14T10:00:00+07:00"),
  referenceNumber: null,
  ...overrides,
});

describe("normalizeRef", () => {
  it("uppercases and strips separators", () => {
    expect(normalizeRef("abc-123.45 67")).toBe("ABC1234567");
  });
  it("returns empty string for null/undefined", () => {
    expect(normalizeRef(null)).toBe("");
    expect(normalizeRef(undefined)).toBe("");
  });
});

describe("scoreCandidate", () => {
  it("scores reference match at 0.98", () => {
    const result = scoreCandidate(
      slip({ referenceNumber: "REF123" }),
      txn({ referenceNumber: "REF123" })
    );
    expect(result.score).toBe(0.98);
    expect(result.method).toBe("reference");
  });

  it("scores amount + same minute high", () => {
    const result = scoreCandidate(slip({}), txn({}));
    expect(result.score).toBeGreaterThanOrEqual(0.9);
    expect(result.method).toBe("amount_time");
  });

  it("scores amount + close time (10 min) medium-high", () => {
    const result = scoreCandidate(
      slip({}),
      txn({ txnDatetime: new Date("2026-05-14T10:10:00+07:00") })
    );
    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.method).toBe("amount_time");
  });

  it("scores amount only at 0.7 when slip has no datetime", () => {
    const result = scoreCandidate(slip({ datetime: null }), txn({}));
    expect(result.score).toBe(0.7);
    expect(result.method).toBe("amount_date");
  });

  it("returns 0 when amounts mismatch", () => {
    const result = scoreCandidate(slip({ amount: 999 }), txn({}));
    expect(result.score).toBe(0);
  });

  it("degrades when time is far outside window", () => {
    const result = scoreCandidate(
      slip({}),
      txn({ txnDatetime: new Date("2026-05-14T13:00:00+07:00") })
    );
    expect(result.score).toBeLessThan(0.7);
  });
});

describe("matchSlip", () => {
  it("returns unresolved when slip has no amount", () => {
    const result = matchSlip(slip({ amount: null }), []);
    expect(result.status).toBe("unresolved");
    if (result.status === "unresolved") {
      expect(result.reason).toBe("no_amount");
    }
  });

  it("returns unresolved when no candidates", () => {
    const result = matchSlip(slip({}), []);
    expect(result.status).toBe("unresolved");
  });

  it("auto-matches on reference number", () => {
    const candidates = [
      txn({ amount: 500, referenceNumber: "OTHER" }),
      txn({ amount: 1000, referenceNumber: "REF123" }),
    ];
    const result = matchSlip(
      slip({ referenceNumber: "REF123" }),
      candidates
    );
    expect(result.status).toBe("matched_auto");
    if (result.status === "matched_auto") {
      expect(result.method).toBe("reference");
      expect(result.transaction.referenceNumber).toBe("REF123");
    }
  });

  it("auto-matches when single candidate with high score", () => {
    const result = matchSlip(slip({}), [txn({})]);
    expect(result.status).toBe("matched_auto");
    if (result.status === "matched_auto") {
      expect(result.method).toBe("amount_time");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("returns pending_review when multiple candidates close in score", () => {
    const result = matchSlip(slip({}), [
      txn({ txnDatetime: new Date("2026-05-14T10:00:00+07:00") }),
      txn({ txnDatetime: new Date("2026-05-14T10:02:00+07:00") }),
    ]);
    expect(result.status).toBe("pending_review");
    if (result.status === "pending_review") {
      expect(result.candidates.length).toBe(2);
    }
  });

  it("returns pending_review for amount-only match below threshold", () => {
    const result = matchSlip(slip({ datetime: null }), [txn({})]);
    expect(result.status).toBe("pending_review");
    if (result.status === "pending_review") {
      expect(result.confidence).toBe(0.7);
    }
  });

  it("excludes already-matched transactions", () => {
    const result = matchSlip(slip({}), [
      txn({ alreadyMatched: true }),
    ]);
    expect(result.status).toBe("unresolved");
  });

  it("prefers reference match over closer time", () => {
    const candidates = [
      txn({
        amount: 1000,
        txnDatetime: new Date("2026-05-14T10:00:00+07:00"),
        referenceNumber: null,
      }),
      txn({
        amount: 1000,
        txnDatetime: new Date("2026-05-14T10:25:00+07:00"),
        referenceNumber: "MATCH-REF",
      }),
    ];
    const result = matchSlip(
      slip({ referenceNumber: "MATCH-REF" }),
      candidates
    );
    expect(result.status).toBe("matched_auto");
    if (result.status === "matched_auto") {
      expect(result.method).toBe("reference");
      expect(result.transaction.referenceNumber).toBe("MATCH-REF");
    }
  });

  it("respects custom autoMatchThreshold", () => {
    const result = matchSlip(slip({}), [txn({})], { autoMatchThreshold: 0.99 });
    // Score is ~0.95 (amount + time), threshold 0.99 → should go to review
    expect(result.status).toBe("pending_review");
  });
});
