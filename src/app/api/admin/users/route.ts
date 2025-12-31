import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser, requireRole } from "@/lib/guards";

export async function GET(req: Request) {
  const { appUser } = await requireUser();
  requireRole(appUser, ["ADMIN", "SUPER_ADMIN"]);

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "PENDING";

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,email,nickname,role,status,created_at")
    .eq("status", status)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
