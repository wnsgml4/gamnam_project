"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const [uRes, rRes] = await Promise.all([
      fetch("/api/admin/users?status=PENDING"),
      fetch("/api/admin/reservations?status=REQUESTED"),
    ]);
    if (!uRes.ok) throw new Error(await uRes.text());
    if (!rRes.ok) throw new Error(await rRes.text());
    setPendingUsers((await uRes.json()).items ?? []);
    setRequests((await rRes.json()).items ?? []);
  }

  useEffect(() => { load().catch(e => setErr(e.message)); }, []);

  return (
    <main>
      <h2>관리자</h2>
      {err ? <p style={{ color: "crimson" }}>{err}</p> : null}

      <section style={{ marginTop: 16 }}>
        <h3>승인 대기 사용자</h3>
        <ul>
          {pendingUsers.map(u => (
            <li key={u.id} style={{ marginBottom: 8 }}>
              {u.nickname ?? u.email ?? u.id}
              <button style={{ marginLeft: 8 }} onClick={async () => {
                const res = await fetch(`/api/admin/users/${u.id}/approve`, { method: "POST" });
                if (!res.ok) alert(await res.text());
                else load();
              }}>승인</button>
              <button style={{ marginLeft: 8 }} onClick={async () => {
                const res = await fetch(`/api/admin/users/${u.id}/block`, { method: "POST" });
                if (!res.ok) alert(await res.text());
                else load();
              }}>차단</button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>예약 요청(선착순)</h3>
        <ul>
          {requests.map(r => (
            <li key={r.id} style={{ marginBottom: 10 }}>
              <div><b>{r.requested_at}</b> / {r.start_time} ~ {r.end_time}</div>
              <div>reservationId: {r.id}</div>
              <button onClick={async () => {
                const res = await fetch(`/api/admin/reservations/${r.id}/approve`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ adminNote: "승인", reason: "" }),
                });
                if (res.status === 409) alert("겹침으로 승인 불가(예외승인 필요)");
                else if (!res.ok) alert(await res.text());
                else load();
              }}>승인</button>

              <button style={{ marginLeft: 8 }} onClick={async () => {
                const reason = prompt("중복 허용 승인 사유를 입력하세요(필수)");
                if (!reason) return;
                const res = await fetch(`/api/admin/reservations/${r.id}/approve-override`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ adminNote: "중복 허용 승인", reason }),
                });
                if (!res.ok) alert(await res.text());
                else load();
              }}>중복 허용 승인</button>

              <button style={{ marginLeft: 8 }} onClick={async () => {
                const reason = prompt("거절 사유(선택)") ?? "";
                const res = await fetch(`/api/admin/reservations/${r.id}/reject`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ adminNote: "거절", reason }),
                });
                if (!res.ok) alert(await res.text());
                else load();
              }}>거절</button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Outbox 발송(테스트)</h3>
        <button onClick={async () => {
          const res = await fetch(`/api/cron/process?token=${prompt("CRON_TOKEN 입력")}`);
          alert(res.ok ? JSON.stringify(await res.json(), null, 2) : await res.text());
        }}>Outbox 처리 실행</button>
      </section>
    </main>
  );
}
