import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser, requireRole } from "@/lib/guards";
import { enqueueOutbox, logAdminAction } from "@/lib/outbox";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { appUser } = await requireUser();
  requireRole(appUser, ["ADMIN", "SUPER_ADMIN"]);

  const userId = params.id;
  const { error } = await supabaseAdmin
    .from("users")
    .update({ status: "BLOCKED", updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: appUser.id,
    targetType: "USER",
    targetId: userId,
    action: "USER_BLOCK",
  });

  await enqueueOutbox({
    userId,
    channel: "PUSH",
    template: "USER_BLOCKED",
    payload: { userId },
  });

  return NextResponse.json({ ok: true });
}
