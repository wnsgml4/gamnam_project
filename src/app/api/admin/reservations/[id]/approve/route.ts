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

  // 일반 승인: override=false (겹치면 DB 제약으로 실패)
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("reservations")
    .update({
      status: "APPROVED",
      override_conflict: false,
      decision_reason: parsed.data.reason ?? null,
      admin_note: parsed.data.adminNote ?? null,
      approved_at: now,
      decided_at: now,
      decided_by: appUser.id,
    })
    .eq("id", id)
    .eq("status", "REQUESTED")
    .select("id,user_id,start_time,end_time")
    .single();

  if (error) {
    // Postgres exclusion constraint violation typically returns a message containing "reservations_no_overlap"
    const msg = error.message ?? "";
    if (msg.includes("reservations_no_overlap") || msg.toLowerCase().includes("exclude")) {
      return NextResponse.json({ message: "CONFLICT_OVERLAP" }, { status: 409 });
    }
    return NextResponse.json({ message: "DB_ERROR", error: msg }, { status: 500 });
  }

  await logAdminAction({
    adminId: appUser.id,
    targetType: "RESERVATION",
    targetId: id,
    action: "APPROVE",
    detail: { override: false, reason: parsed.data.reason ?? null },
  });

  await enqueueOutbox({
    userId: data.user_id,
    channel: "PUSH",
    template: "RESERVATION_APPROVED",
    payload: { reservationId: id, startTime: data.start_time, endTime: data.end_time },
  });

  return NextResponse.json({ ok: true });
}
