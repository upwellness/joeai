export interface SlipExtraction {
  /** Amount in baht (numeric). Required for any match. */
  amount: number | null;
  /** Timestamp parsed from the slip image, if available. */
  datetime: Date | null;
  /** Bank reference number, if OCR'd. */
  referenceNumber: string | null;
  /** Optional bank info for sanity-check. */
  bankFrom?: string | null;
  bankTo?: string | null;
  accountTo?: string | null;
}

export interface BankTransactionCandidate {
  id: string;
  amount: number;
  txnDatetime: Date;
  referenceNumber: string | null;
  /** Whether this txn is already matched to another slip. */
  alreadyMatched: boolean;
}

export type MatchMethod =
  | "reference"
  | "amount_time"
  | "amount_date"
  | "ambiguous"
  | "manual";

export type MatchOutcome =
  | {
      status: "matched_auto";
      transaction: BankTransactionCandidate;
      confidence: number;
      method: MatchMethod;
    }
  | {
      status: "pending_review";
      candidates: BankTransactionCandidate[];
      bestCandidate?: BankTransactionCandidate;
      confidence: number;
      method: MatchMethod;
    }
  | {
      status: "unresolved";
      reason: "no_amount" | "no_matching_transaction" | "ocr_failed";
    };

export interface MatchOptions {
  /** Default 30 minutes. */
  timeWindowMinutes?: number;
  /** Confidence at or above which we auto-match. Default 0.9. */
  autoMatchThreshold?: number;
  /** Confidence at or above which we ask for review (else unresolved). Default 0.6. */
  reviewThreshold?: number;
}
