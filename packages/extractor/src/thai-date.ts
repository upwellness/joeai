/**
 * Thai date utilities.
 *
 * Thai slips commonly use Buddhist Era (B.E. = A.D. + 543) and Thai month
 * abbreviations like ม.ค., ก.พ., มี.ค., ...
 */

export const THAI_MONTHS: Record<string, number> = {
  // Full
  "มกราคม": 1,
  "กุมภาพันธ์": 2,
  "มีนาคม": 3,
  "เมษายน": 4,
  "พฤษภาคม": 5,
  "มิถุนายน": 6,
  "กรกฎาคม": 7,
  "สิงหาคม": 8,
  "กันยายน": 9,
  "ตุลาคม": 10,
  "พฤศจิกายน": 11,
  "ธันวาคม": 12,
  // Abbreviated with dots
  "ม.ค.": 1,
  "ก.พ.": 2,
  "มี.ค.": 3,
  "เม.ย.": 4,
  "พ.ค.": 5,
  "มิ.ย.": 6,
  "ก.ค.": 7,
  "ส.ค.": 8,
  "ก.ย.": 9,
  "ต.ค.": 10,
  "พ.ย.": 11,
  "ธ.ค.": 12,
  // Abbreviated without dots
  มค: 1,
  กพ: 2,
  มีค: 3,
  เมย: 4,
  พค: 5,
  มิย: 6,
  กค: 7,
  สค: 8,
  กย: 9,
  ตค: 10,
  พย: 11,
  ธค: 12,
};

/**
 * Convert a possibly-Buddhist-era year (2-4 digits) to A.D.
 */
export function normalizeYear(yearStr: string): number {
  const y = parseInt(yearStr, 10);
  if (Number.isNaN(y)) return NaN;
  if (y < 100) {
    // 2-digit — assume current century minus 1 if value > current short year + 1
    const nowShort = new Date().getFullYear() % 100;
    return y > nowShort + 1 ? 1900 + y : 2000 + y;
  }
  // B.E. range
  if (y >= 2400 && y < 2700) return y - 543;
  return y;
}

/**
 * Parse a Thai date string like "14 พ.ค. 2569" or "14 พ.ค. 26"
 */
export function parseThaiDate(input: string): { year: number; month: number; day: number } | null {
  const re = /(\d{1,2})\s*([฀-๿.]+?)\s*(\d{2,4})/;
  const m = re.exec(input);
  if (!m) return null;

  const day = parseInt(m[1]!, 10);
  const monthKey = m[2]!.replace(/\s+/g, "");
  const month = THAI_MONTHS[monthKey];
  if (!month) return null;
  const year = normalizeYear(m[3]!);
  if (Number.isNaN(year)) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Combine a date with an optional HH:MM time, defaulting to noon Bangkok.
 * Returns a UTC Date adjusted for ICT (+07:00).
 */
export function makeBangkokDate(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
  second = 0
): Date {
  // Bangkok is UTC+7 — construct UTC date that represents local noon
  const utcMs = Date.UTC(year, month - 1, day, hour - 7, minute, second);
  return new Date(utcMs);
}
