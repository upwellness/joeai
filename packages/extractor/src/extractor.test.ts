import { describe, it, expect } from "vitest";
import {
  extractAmount,
  extractReference,
  extractDatetime,
  extractSlipFields,
} from "./extractor";
import { parseThaiDate, normalizeYear } from "./thai-date";

describe("extractAmount", () => {
  it("parses Thai baht amount with comma", () => {
    expect(extractAmount("ยอด 1,500.00 บาท")).toBe(1500);
  });

  it("parses amount with decimals", () => {
    expect(extractAmount("99.99 บาท")).toBe(99.99);
  });

  it("parses THB suffix", () => {
    expect(extractAmount("Amount: 2,000 THB")).toBe(2000);
  });

  it("parses baht symbol", () => {
    expect(extractAmount("฿500")).toBe(500);
  });

  it("returns null when no amount", () => {
    expect(extractAmount("hello world")).toBe(null);
  });

  it("returns null for zero", () => {
    expect(extractAmount("0 บาท")).toBe(null);
  });
});

describe("extractReference", () => {
  it("extracts Thai reference label", () => {
    expect(extractReference("เลขที่อ้างอิง: ABC123XYZ")).toBe("ABC123XYZ");
  });

  it("extracts English ref label", () => {
    expect(extractReference("Ref No: XYZ987")).toBe("XYZ987");
  });

  it("extracts ref with dash", () => {
    expect(extractReference("Reference: 2026-05-14-001")).toBe(
      "2026-05-14-001"
    );
  });

  it("returns null when no ref", () => {
    expect(extractReference("Amount 100")).toBe(null);
  });
});

describe("parseThaiDate", () => {
  it("parses full Thai month name", () => {
    expect(parseThaiDate("14 พฤษภาคม 2569")).toEqual({
      year: 2026,
      month: 5,
      day: 14,
    });
  });

  it("parses abbreviated Thai month with dots", () => {
    expect(parseThaiDate("1 ม.ค. 2569")).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
  });

  it("returns null for unknown month", () => {
    expect(parseThaiDate("14 xyz 2026")).toBe(null);
  });
});

describe("normalizeYear", () => {
  it("converts B.E. to A.D.", () => {
    expect(normalizeYear("2569")).toBe(2026);
  });

  it("keeps A.D. year", () => {
    expect(normalizeYear("2026")).toBe(2026);
  });

  it("treats small year as 20XX", () => {
    expect(normalizeYear("26")).toBe(2026);
  });
});

describe("extractDatetime", () => {
  it("extracts Thai date + time", () => {
    const d = extractDatetime("14 พ.ค. 2569 เวลา 14:30 น.");
    expect(d).not.toBeNull();
    // 14:30 ICT = 07:30 UTC
    expect(d!.getUTCHours()).toBe(7);
    expect(d!.getUTCMinutes()).toBe(30);
    expect(d!.getUTCDate()).toBe(14);
    expect(d!.getUTCMonth()).toBe(4); // May = index 4
  });

  it("extracts slash date format", () => {
    const d = extractDatetime("14/05/2026 10:00");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(14);
    expect(d!.getUTCMonth()).toBe(4);
  });

  it("returns null when no date found", () => {
    expect(extractDatetime("no date here")).toBe(null);
  });
});

describe("extractSlipFields (integration)", () => {
  it("extracts complete KBank-style slip", () => {
    const ocrText = `
      โอนเงินสำเร็จ
      ธนาคารกสิกรไทย
      จาก: นาย ABC
      ถึง: บริษัท XYZ จำกัด
      บัญชี: 123-4-56789-0
      จำนวนเงิน 1,500.00 บาท
      วันที่ 14 พ.ค. 2569 เวลา 14:30 น.
      เลขที่อ้างอิง: ABC123XYZ
    `;
    const fields = extractSlipFields(ocrText);
    expect(fields.amount).toBe(1500);
    expect(fields.referenceNumber).toBe("ABC123XYZ");
    expect(fields.bankFrom).toBe("KBANK");
    expect(fields.datetime).not.toBeNull();
  });

  it("handles missing fields gracefully", () => {
    const fields = extractSlipFields("just some text");
    expect(fields.amount).toBe(null);
    expect(fields.datetime).toBe(null);
    expect(fields.referenceNumber).toBe(null);
  });

  it("extracts SCB slip", () => {
    const ocrText = `
      SCB ไทยพาณิชย์
      Amount: 500.00 บาท
      Date: 14/05/2026 09:15
      Ref: SCB202605140001
    `;
    const fields = extractSlipFields(ocrText);
    expect(fields.amount).toBe(500);
    expect(fields.bankFrom).toBe("SCB");
    expect(fields.referenceNumber).toBe("SCB202605140001");
  });
});
