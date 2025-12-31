import webpush from "web-push";
import nodemailer from "nodemailer";
import { env } from "./env";
import { supabaseAdmin } from "./supabase";

webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

function getAdminEmails(): string[] {
  const raw = env.ADMIN_EMAILS?.trim();
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function smtpEnabled(): boolean {
  return !!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);
}

async function sendAdminEmail(subject: string, text: string) {
  const to = getAdminEmails();
  if (to.length === 0) return { skipped: true };

  if (!smtpEnabled()) {
    // SMTP 미설정 시 outbox는 FAILED로 기록하게 하되, 운영에서는 SMTP를 붙이세요.
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Number(env.SMTP_PORT) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: env.SMTP_USER,
    to,
    subject,
    text,
  });

  return { skipped: false };
}

async function sendPushToUser(userId: string, payload: any) {
  const { data: sub, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!sub) return { skipped: true };

  await webpush.sendNotification(sub.subscription as any, JSON.stringify(payload));
  return { skipped: false };
}

function renderEmail(template: string, payload: any): { subject: string; text: string } {
  switch (template) {
    case "ADMIN_NEW_REQUEST":
      return {
        subject: "[아지트] 새 예약 요청",
        text: `새 예약 요청이 도착했습니다.
예약ID: ${payload.reservationId}
사용자ID: ${payload.userId}
기간: ${payload.startTime} ~ ${payload.endTime}
`,
      };
    case "ADMIN_CANCELLED":
      return {
        subject: "[아지트] 예약 취소",
        text: `예약이 취소되었습니다.
예약ID: ${payload.reservationId}
사용자ID: ${payload.userId}
`,
      };
    default:
      return { subject: `[아지트] 알림(${template})`, text: JSON.stringify(payload, null, 2) };
  }
}

function renderPush(template: string, payload: any) {
  // 클라이언트에서 template별로 UX를 다르게 처리 가능
  return { template, payload };
}

export async function processOutboxOnce(limit = 50) {
  const { data: items, error } = await supabaseAdmin
    .from("notification_outbox")
    .select("id,user_id,channel,template,payload")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  let sent = 0, failed = 0, skipped = 0;

  for (const it of items ?? []) {
    try {
      if (it.channel === "PUSH") {
        if (!it.user_id) throw new Error("PUSH_REQUIRES_USER");
        const res = await sendPushToUser(it.user_id, renderPush(it.template, it.payload));
        if (res.skipped) skipped++;
      } else if (it.channel === "EMAIL") {
        const mail = renderEmail(it.template, it.payload);
        const res = await sendAdminEmail(mail.subject, mail.text);
        if (res.skipped) skipped++;
      }

      await supabaseAdmin
        .from("notification_outbox")
        .update({ status: "SENT", sent_at: new Date().toISOString(), error: null })
        .eq("id", it.id);
      sent++;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await supabaseAdmin
        .from("notification_outbox")
        .update({ status: "FAILED", error: msg })
        .eq("id", it.id);
      failed++;
    }
  }

  return { processed: (items ?? []).length, sent, failed, skipped };
}
