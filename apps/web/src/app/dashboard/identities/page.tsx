"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

interface Identity {
  id: string;
  lineUserId: string;
  currentDisplayName: string | null;
  employeeId: string | null;
  customerId: string | null;
  lastSeenAt: string;
}

export default function IdentitiesPage() {
  const [rows, setRows] = useState<Identity[] | null>(null);
  const [unmappedOnly, setUnmappedOnly] = useState(false);

  useEffect(() => {
    apiFetch<{ rows: Identity[] }>(
      `/api/identities?unmappedOnly=${unmappedOnly}`
    ).then((d) => setRows(d.rows));
  }, [unmappedOnly]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Identity Mapping</h1>
      <label className="flex items-center gap-2 mb-4 text-sm">
        <input
          type="checkbox"
          checked={unmappedOnly}
          onChange={(e) => setUnmappedOnly(e.target.checked)}
        />
        แสดงเฉพาะที่ยังไม่ map
      </label>
      <table className="w-full text-sm">
        <thead className="text-left opacity-70 text-xs uppercase">
          <tr>
            <th className="py-2">LINE Display Name</th>
            <th>LINE userId</th>
            <th>Mapped to</th>
            <th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.id} className="border-t border-gray-800">
              <td className="py-2">{r.currentDisplayName ?? "—"}</td>
              <td className="font-mono text-xs opacity-70">
                {r.lineUserId.slice(0, 8)}…
              </td>
              <td>
                {r.employeeId ? (
                  <span className="text-blue-400">Employee</span>
                ) : r.customerId ? (
                  <span className="text-green-400">Customer</span>
                ) : (
                  <span className="text-yellow-400">Unmapped</span>
                )}
              </td>
              <td>{new Date(r.lastSeenAt).toLocaleString("th-TH")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
