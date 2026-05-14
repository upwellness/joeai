"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

interface StatementUpload {
  id: string;
  bank: string;
  accountNumber: string | null;
  statementDate: string;
  rowCount: number | null;
  status: string;
  uploadedAt: string;
}

export default function StatementsPage() {
  const [rows, setRows] = useState<StatementUpload[] | null>(null);

  useEffect(() => {
    apiFetch<{ rows: StatementUpload[] }>("/api/statements").then((d) =>
      setRows(d.rows)
    );
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Statement Uploads</h1>
      <p className="opacity-60 mb-4 text-sm">
        Upload statement files (server-side parsing coming in next iteration).
      </p>
      <table className="w-full text-sm">
        <thead className="text-left opacity-70 text-xs uppercase">
          <tr>
            <th className="py-2">Date</th>
            <th>Bank</th>
            <th>Account</th>
            <th>Rows</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.id} className="border-t border-gray-800">
              <td className="py-2">{r.statementDate}</td>
              <td>{r.bank}</td>
              <td className="font-mono text-xs">{r.accountNumber ?? "—"}</td>
              <td>{r.rowCount ?? "—"}</td>
              <td>{new Date(r.uploadedAt).toLocaleString("th-TH")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
