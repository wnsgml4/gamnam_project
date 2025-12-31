"use client";

import { useEffect, useState } from "react";

export default function MyReservationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/reservations").then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }).then((d) => setItems(d.items ?? [])).catch((e) => setErr(e.message));
  }, []);

  return (
    <main>
      <h2>내 예약</h2>
      {err ? <p style={{ color: "crimson" }}>{err}</p> : null}
      <ul>
        {items.map((it) => (
          <li key={it.id} style={{ marginBottom: 10 }}>
            <div><b>{it.status}</b> {it.start_time} ~ {it.end_time}</div>
            <div>override: {String(it.override_conflict)}</div>
            {it.status !== "CANCELLED" && it.status !== "REJECTED" ? (
              <button onClick={async () => {
                const res = await fetch(`/api/reservations/${it.id}/cancel`, { method: "POST" });
                if (!res.ok) alert(await res.text());
                else location.reload();
              }}>취소</button>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
