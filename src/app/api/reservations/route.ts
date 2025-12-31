import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser, requireApprovedForBooking } from "@/lib/guards";
import { reservationCreateSchema } from "@/lib/validators";
import { enqueueOutbox } from "@/lib/outbox";

export async function POST(req: Request) {
  const { appUser } = await requireUser();
  requireApprovedForBooking(appUser);

  const body = await req.json();
  const parsed = reservationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
  }

  const { resourceId, startTime, endTime, userNote } = parsed.data;
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (!(start < end)) {
    return NextResponse.json({ message: "INVALID_TIME_RANGE" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .insert({
      user_id: appUser.id,
      resource_id: resourceId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "REQUESTED",
      user_note: userNote ?? null,
    })
    .select("id, requested_at")
    .single();

  if (error) {
    return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });
  }

  // 사용자: 요청 접수 푸시
  await enqueueOutbox({
    userId: appUser.id,
    channel: "PUSH",
    template: "RESERVATION_REQUESTED",
    payload: { reservationId: data.id, startTime: startTime, endTime: endTime },
  });

  // 관리자: 이메일 알림(요청 발생)
  await enqueueOutbox({
    userId: null,
    channel: "EMAIL",
    template: "ADMIN_NEW_REQUEST",
    payload: { reservationId: data.id, userId: appUser.id, startTime, endTime },
  });

  return NextResponse.json({ ok: true, reservationId: data.id });
}
