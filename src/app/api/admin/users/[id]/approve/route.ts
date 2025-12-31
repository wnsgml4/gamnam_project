import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser, requireRole } from "@/lib/guards";
import { enqueueOutbox, logAdminAction } from "@/lib/outbox";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { appUser } = await requireUser();
  requireRole(appUser, ["ADMIN", "SUPER_ADMIN"]);

  const userId = params.id;
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ status: "APPROVED", updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id")
    .single();

  if (error) return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: appUser.id,
    targetType: "USER",
    targetId: userId,
    action: "USER_APPROVE",
  });

  await enqueueOutbox({
    userId,
    channel: "PUSH",
    template: "USER_APPROVED",
    payload: { userId },
  });

  return NextResponse.json({ ok: true });
}
