import type {
  BankTransactionCandidate,
  MatchOptions,
  MatchOutcome,
  SlipExtraction,
} from "./types";

const DEFAULTS: Required<MatchOptions> = {
  timeWindowMinutes: 30,
  autoMatchThreshold: 0.9,
  reviewThreshold: 0.6,
};

/**
 * Normalize a reference number for comparison.
 * - upper-case
 * - strip whitespace, dashes, dots
 */
export function normalizeRef(ref: string | null | undefined): string {
  if (!ref) return "";
  return ref.toUpperCase().replace(/[\s\-_.]/g, "");
}

/**
 * Amount equality with float tolerance.
 */
function amountEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005; // half-cent
}

/**
 * Score how confident we are in a candidate match given the slip + candidate.
 *
 * Tiers:
 *   1. Reference number match (highest)
 *   2. Amount + close time
 *   3. Amount only
 */
export function scoreCandidate(
  extraction: SlipExtraction,
  candidate: BankTransactionCandidate,
  options: MatchOptions = {}
): { score: number; method: "reference" | "amount_time" | "amount_date" } {
  const opts = { ...DEFAULTS, ...options };

  // Reference match
  const slipRef = normalizeRef(extraction.referenceNumber);
  const candRef = normalizeRef(candidate.referenceNumber);
  const hasRefMatch = slipRef.length >= 4 && slipRef === candRef;

  // Amount match
  const amountMatch =
    extraction.amount !== null && amountEqual(extraction.amount, candidate.amount);

  if (!amountMatch) {
    return { score: 0, method: "amount_date" };
  }

  if (hasRefMatch) {
    return { score: 0.98, method: "reference" };
  }

  // Amount-only baseline
  let score = 0.7;
  let method: "amount_time" | "amount_date" = "amount_date";

  if (extraction.datetime) {
    const diffMs = Math.abs(
      candidate.txnDatetime.getTime() - extraction.datetime.getTime()
    );
    const diffMin = diffMs / 60000;

    if (diffMin <= opts.timeWindowMinutes) {
      method = "amount_time";
      if (diffMin <= 5) score += 0.25;
      else if (diffMin <= 15) score += 0.15;
      else if (diffMin <= opts.timeWindowMinutes) score += 0.05;
    } else {
      // Outside time window — degrade confidence
      score = 0.5;
    }
  }

  return { score: Math.min(score, 1.0), method };
}

/**
 * Match a slip extraction against a list of candidate bank transactions
 * (caller is responsible for pre-filtering to plausible candidates, e.g.
 * by date range + amount = extraction.amount).
 */
export function matchSlip(
  extraction: SlipExtraction,
  candidates: BankTransactionCandidate[],
  options: MatchOptions = {}
): MatchOutcome {
  const opts = { ...DEFAULTS, ...options };

  if (extraction.amount === null) {
    return { status: "unresolved", reason: "no_amount" };
  }

  // Filter out already-matched candidates
  const available = candidates.filter((c) => !c.alreadyMatched);

  if (available.length === 0) {
    return { status: "unresolved", reason: "no_matching_transaction" };
  }

  // Tier 1 — Reference match (if extraction has one, look for matching ref)
  if (extraction.referenceNumber) {
    const slipRef = normalizeRef(extraction.referenceNumber);
    const refMatch = available.find(
      (c) => normalizeRef(c.referenceNumber) === slipRef
    );
    if (refMatch && amountEqual(refMatch.amount, extraction.amount)) {
      return {
        status: "matched_auto",
        transaction: refMatch,
        confidence: 0.98,
        method: "reference",
      };
    }
  }

  // Tier 2 — Score all amount-matching candidates
  const scored = available
    .map((c) => ({ c, ...scoreCandidate(extraction, c, opts) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { status: "unresolved", reason: "no_matching_transaction" };
  }

  const top = scored[0]!;

  // If exactly one strong match → auto
  if (
    scored.length === 1 ||
    (scored.length >= 2 && top.score - scored[1]!.score >= 0.2)
  ) {
    if (top.score >= opts.autoMatchThreshold) {
      return {
        status: "matched_auto",
        transaction: top.c,
        confidence: top.score,
        method: top.method,
      };
    }
    if (top.score >= opts.reviewThreshold) {
      return {
        status: "pending_review",
        candidates: scored.map((x) => x.c),
        bestCandidate: top.c,
        confidence: top.score,
        method: top.method,
      };
    }
    return { status: "unresolved", reason: "no_matching_transaction" };
  }

  // Multiple close candidates → ambiguous, send to review
  return {
    status: "pending_review",
    candidates: scored.map((x) => x.c),
    bestCandidate: top.c,
    confidence: Math.min(top.score, 0.7),
    method: "ambiguous",
  };
}
