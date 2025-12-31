import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser, requireRole } from "@/lib/guards";

export async function GET(req: Request) {
  const { appUser } = await requireUser();
  requireRole(appUser, ["ADMIN", "SUPER_ADMIN"]);

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "REQUESTED";

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select("id,user_id,resource_id,start_time,end_time,status,override_conflict,requested_at,approved_at,decision_reason,user_note,admin_note")
    .eq("status", status)
    .order("requested_at", { ascending: true });

  if (error) return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
