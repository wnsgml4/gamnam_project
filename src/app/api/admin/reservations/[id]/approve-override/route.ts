import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser, requireRole } from "@/lib/guards";
import { adminDecisionSchema } from "@/lib/validators";
import { enqueueOutbox, logAdminAction } from "@/lib/outbox";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { appUser } = await requireUser();
  requireRole(appUser, ["ADMIN", "SUPER_ADMIN"]);

  const id = params.id;
  const body = await req.json().catch(() => ({}));
  const parsed = adminDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
  }
  const reason = parsed.data.reason?.trim();
  if (!reason) {
    return NextResponse.json({ message: "REASON_REQUIRED_FOR_OVERRIDE" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("reservations")
    .update({
      status: "APPROVED",
      override_conflict: true,     // 예외 승인
      decision_reason: reason,
      admin_note: parsed.data.adminNote ?? null,
      approved_at: now,
      decided_at: now,
      decided_by: appUser.id,
    })
    .eq("id", id)
    .eq("status", "REQUESTED")
    .select("id,user_id,start_time,end_time")
    .single();

  if (error) return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: appUser.id,
    targetType: "RESERVATION",
    targetId: id,
    action: "APPROVE_OVERRIDE",
    detail: { override: true, reason },
  });

  await enqueueOutbox({
    userId: data.user_id,
    channel: "PUSH",
    template: "RESERVATION_APPROVED_OVERRIDE",
    payload: { reservationId: id, startTime: data.start_time, endTime: data.end_time, reason },
  });

  return NextResponse.json({ ok: true });
}
