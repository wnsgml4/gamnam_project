"use client";

import { useEffect, useMemo, useState } from "react";

export default function BookPage() {
  const [resourceId, setResourceId] = useState<string>("");
  const [resources, setResources] = useState<any[]>([]);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    // 단일 리소스라면 하드코딩도 가능하지만, 여기서는 DB에서 불러옵니다.
    fetch("/api/public/resources").then(r => r.json()).then(d => {
      setResources(d.items ?? []);
      if (d.items?.[0]?.id) setResourceId(d.items[0].id);
    });
  }, []);

  async function subscribePush() {
    if (!("serviceWorker" in navigator)) return alert("이 브라우저는 서비스워커 미지원");
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    const vapidPublicKey = (window as any).__VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidPublicKey) return alert("VAPID_PUBLIC_KEY가 필요합니다.");

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub }),
    });
    if (!res.ok) alert(await res.text());
    else alert("웹푸시 구독 완료");
  }

  async function submit() {
    setMsg("");
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId, startTime, endTime }),
    });
    if (!res.ok) {
      setMsg(await res.text());
      return;
    }
    const d = await res.json();
    setMsg(`요청 완료: ${d.reservationId}`);
  }

  return (
    <main>
      <h2>예약 요청</h2>

      <button onClick={subscribePush}>웹푸시 구독(권장)</button>

      <div style={{ marginTop: 12 }}>
        <label>대상(아지트): </label>
        <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
          {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>시작(ISO): </label>
        <input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="2026-01-01T19:00:00+09:00" style={{ width: 360 }} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label>종료(ISO): </label>
        <input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="2026-01-01T22:00:00+09:00" style={{ width: 360 }} />
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={submit}>요청 제출</button>
      </div>

      {msg ? <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{msg}</pre> : null}
      <p style={{ marginTop: 12, color: "#555" }}>
        승인형 선착순입니다. 요청은 즉시 등록되며, 관리자가 승인하면 확정됩니다.
      </p>

      <script dangerouslySetInnerHTML={{ __html: `window.__VAPID_PUBLIC_KEY=${json.dumps(os.environ.get("VAPID_PUBLIC_KEY",""))};` }} />
    </main>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
