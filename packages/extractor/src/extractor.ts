import { parseThaiDate, makeBangkokDate } from "./thai-date";

export interface SlipFields {
  amount: number | null;
  datetime: Date | null;
  referenceNumber: string | null;
  bankFrom: string | null;
  bankTo: string | null;
  accountTo: string | null;
}

// Match an amount with either a Thai/THB suffix OR a leading ฿ symbol.
const AMOUNT_SUFFIX_RE =
  /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:บาท|฿|THB|baht)/i;
const AMOUNT_PREFIX_RE =
  /฿\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/;

// Reference number patterns — labels first, then bare value
const REF_RE =
  /(?:เลขที่อ้างอิง|รหัสอ้างอิง|หมายเลขอ้างอิง|Ref(?:erence)?(?:\s*(?:No|#))?|Trans(?:action)?\s*ID)\s*[:.#]?\s*([A-Z0-9-]{4,})/i;

const TIME_RE =
  /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(น\.?|AM|PM|am|pm)?/;

// Bank shortlist (more can be added)
const KNOWN_BANKS = [
  { keys: ["KBANK", "กสิกร", "Kasikorn"], code: "KBANK" },
  { keys: ["SCB", "ไทยพาณิชย์"], code: "SCB" },
  { keys: ["BBL", "กรุงเทพ", "Bangkok Bank"], code: "BBL" },
  { keys: ["KTB", "กรุงไทย"], code: "KTB" },
  { keys: ["BAY", "กรุงศรี", "Krungsri"], code: "BAY" },
  { keys: ["TTB", "TMB"], code: "TTB" },
  { keys: ["GSB", "ออมสิน"], code: "GSB" },
  { keys: ["BAAC", "ธ.ก.ส."], code: "BAAC" },
  { keys: ["TISCO", "ทิสโก้"], code: "TISCO" },
  { keys: ["UOB", "ยูโอบี"], code: "UOB" },
];

function detectBank(text: string): string | null {
  const upper = text.toUpperCase();
  for (const b of KNOWN_BANKS) {
    for (const key of b.keys) {
      if (upper.includes(key.toUpperCase()) || text.includes(key)) {
        return b.code;
      }
    }
  }
  return null;
}

/**
 * Parse amount from a substring like "1,500.00 บาท" → 1500.
 */
export function extractAmount(text: string): number | null {
  const m = AMOUNT_SUFFIX_RE.exec(text) ?? AMOUNT_PREFIX_RE.exec(text);
  if (!m) return null;
  const numStr = m[1]!.replace(/,/g, "");
  const n = parseFloat(numStr);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractReference(text: string): string | null {
  const m = REF_RE.exec(text);
  if (!m) return null;
  return m[1]!.trim();
}

/**
 * Extract datetime from a slip — date + optional time.
 * Returns Bangkok-local time converted to UTC.
 */
export function extractDatetime(text: string): Date | null {
  const dateParts = parseThaiDate(text);
  if (!dateParts) {
    // Try ISO-ish e.g. "14/05/2026" or "14-05-2026"
    const isoLikeRe = /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/;
    const m = isoLikeRe.exec(text);
    if (!m) return null;
    const day = parseInt(m[1]!, 10);
    const month = parseInt(m[2]!, 10);
    let year = parseInt(m[3]!, 10);
    if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
    if (year >= 2400 && year < 2700) year = year - 543;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;

    return combineWithTime(year, month, day, text);
  }
  return combineWithTime(dateParts.year, dateParts.month, dateParts.day, text);
}

function combineWithTime(
  year: number,
  month: number,
  day: number,
  text: string
): Date {
  const tm = TIME_RE.exec(text);
  if (!tm) return makeBangkokDate(year, month, day);

  let hour = parseInt(tm[1]!, 10);
  const minute = parseInt(tm[2]!, 10);
  const second = tm[3] ? parseInt(tm[3]!, 10) : 0;
  const suffix = tm[4]?.toLowerCase();

  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return makeBangkokDate(year, month, day);
  }

  return makeBangkokDate(year, month, day, hour, minute, second);
}

/**
 * Full slip field extraction from OCR text.
 */
export function extractSlipFields(ocrText: string): SlipFields {
  const text = ocrText.replace(/​/g, "").trim();

  return {
    amount: extractAmount(text),
    datetime: extractDatetime(text),
    referenceNumber: extractReference(text),
    bankFrom: detectFromBank(text),
    bankTo: detectToBank(text),
    accountTo: extractAccountTo(text),
  };
}

function detectFromBank(text: string): string | null {
  // Look for "from"/"จาก" context
  const fromMatch = text.match(/(?:จาก|From)[:\s]+([^\n]{1,40})/i);
  if (fromMatch) {
    const bank = detectBank(fromMatch[1]!);
    if (bank) return bank;
  }
  // Fallback: any bank mentioned at top
  return detectBank(text.split("\n").slice(0, 5).join(" "));
}

function detectToBank(text: string): string | null {
  const toMatch = text.match(/(?:ถึง|ไปยัง|To)[:\s]+([^\n]{1,40})/i);
  if (toMatch) {
    const bank = detectBank(toMatch[1]!);
    if (bank) return bank;
  }
  return null;
}

function extractAccountTo(text: string): string | null {
  // Common patterns: "xxx-x-x1234-x" or "1234567890" near "บัญชี" or "Account"
  const acctRe =
    /(?:บัญชี|เลขที่บัญชี|Account|Acct)\s*[:.#]?\s*([0-9X*\-x]{8,20})/i;
  const m = acctRe.exec(text);
  return m ? m[1]!.replace(/[^0-9X*]/gi, "") : null;
}
