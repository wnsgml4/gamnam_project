import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/guards";

export async function GET() {
  const { appUser } = await requireUser();

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select("id, resource_id, start_time, end_time, status, override_conflict, requested_at, approved_at, decided_at, decision_reason")
    .eq("user_id", appUser.id)
    .order("requested_at", { ascending: false });

  if (error) return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
