"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

interface MessageRow {
  id: string;
  messageType: string;
  textContent: string | null;
  transcript: string | null;
  lineTimestamp: string;
  identityDisplayName: string | null;
  conversationName: string | null;
}

export default function MessagesPage() {
  const [rows, setRows] = useState<MessageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ rows: MessageRow[] }>("/api/messages?limit=100")
      .then((d) => setRows(d.rows))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sales Activity</h1>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      {!rows && !error && <p className="opacity-60">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="opacity-60">ยังไม่มีข้อความ</p>
      )}
      <div className="space-y-2">
        {rows?.map((r) => (
          <div
            key={r.id}
            className="rounded border border-gray-800 p-3 bg-gray-900/40 text-sm"
          >
            <div className="flex justify-between opacity-60 text-xs">
              <span>
                {r.identityDisplayName ?? "—"} · {r.conversationName ?? "—"}
              </span>
              <span>{new Date(r.lineTimestamp).toLocaleString("th-TH")}</span>
            </div>
            <div className="mt-1">
              <span className="inline-block mr-2 rounded bg-gray-700 px-2 py-0.5 text-xs">
                {r.messageType}
              </span>
              {r.textContent ?? r.transcript ?? <em className="opacity-60">(media)</em>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
