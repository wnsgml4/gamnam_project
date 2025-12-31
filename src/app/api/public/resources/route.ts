import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("resources")
    .select("id,name,capacity,min_duration_minutes,buffer_minutes")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
