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

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("reservations")
    .update({
      status: "REJECTED",
      decision_reason: parsed.data.reason ?? "관리자 거절",
      admin_note: parsed.data.adminNote ?? null,
      decided_at: now,
      decided_by: appUser.id,
    })
    .eq("id", id)
    .eq("status", "REQUESTED")
    .select("id,user_id")
    .single();

  if (error) return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: appUser.id,
    targetType: "RESERVATION",
    targetId: id,
    action: "REJECT",
    detail: { reason: parsed.data.reason ?? null },
  });

  await enqueueOutbox({
    userId: data.user_id,
    channel: "PUSH",
    template: "RESERVATION_REJECTED",
    payload: { reservationId: id, reason: parsed.data.reason ?? null },
  });

  return NextResponse.json({ ok: true });
}
