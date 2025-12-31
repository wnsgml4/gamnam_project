import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/guards";
import { enqueueOutbox } from "@/lib/outbox";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { appUser } = await requireUser();
  const id = params.id;

  const { data: resv, error: selErr } = await supabaseAdmin
    .from("reservations")
    .select("id,user_id,status,start_time,end_time")
    .eq("id", id)
    .maybeSingle();

  if (selErr) return NextResponse.json({ message: "DB_ERROR", error: selErr.message }, { status: 500 });
  if (!resv) return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  if (resv.user_id !== appUser.id) return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });

  if (["CANCELLED", "REJECTED"].includes(resv.status)) {
    return NextResponse.json({ ok: true });
  }

  const { error: updErr } = await supabaseAdmin
    .from("reservations")
    .update({ status: "CANCELLED", decided_at: new Date().toISOString(), decided_by: null })
    .eq("id", id);

  if (updErr) return NextResponse.json({ message: "DB_ERROR", error: updErr.message }, { status: 500 });

  await enqueueOutbox({
    userId: appUser.id,
    channel: "PUSH",
    template: "RESERVATION_CANCELLED",
    payload: { reservationId: id },
  });

  await enqueueOutbox({
    userId: null,
    channel: "EMAIL",
    template: "ADMIN_CANCELLED",
    payload: { reservationId: id, userId: appUser.id },
  });

  return NextResponse.json({ ok: true });
}
