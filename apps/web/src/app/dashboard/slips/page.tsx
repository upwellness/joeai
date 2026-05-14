"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

interface SlipRow {
  id: string;
  status: string;
  extractedAmount: string | null;
  extractedDatetime: string | null;
  extractedRef: string | null;
  matchConfidence: string | null;
  createdAt: string;
}

const STATUSES = [
  "pending_review",
  "matched_auto",
  "matched_manual",
  "unresolved",
  "rejected",
] as const;

export default function SlipsPage() {
  const [status, setStatus] = useState<string>("pending_review");
  const [rows, setRows] = useState<SlipRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    apiFetch<{ rows: SlipRow[] }>(`/api/slips?status=${status}`)
      .then((d) => setRows(d.rows))
      .catch((e) => setError(String(e)));
  }, [status]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Slip Review</h1>
      <div className="flex gap-2 mb-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded px-3 py-1 text-sm ${
              status === s
                ? "bg-blue-600 text-white"
                : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {!rows && !error && <p className="opacity-60">Loading…</p>}
      <table className="w-full text-sm">
        <thead className="text-left opacity-70 text-xs uppercase">
          <tr>
            <th className="py-2">Created</th>
            <th>Amount</th>
            <th>Ref</th>
            <th>Slip time</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.id} className="border-t border-gray-800">
              <td className="py-2">
                {new Date(r.createdAt).toLocaleString("th-TH")}
              </td>
              <td>{r.extractedAmount ?? "—"}</td>
              <td>{r.extractedRef ?? "—"}</td>
              <td>
                {r.extractedDatetime
                  ? new Date(r.extractedDatetime).toLocaleString("th-TH")
                  : "—"}
              </td>
              <td>{r.matchConfidence ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
