import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser, requireRole } from "@/lib/guards";
import { logAdminAction } from "@/lib/outbox";

const schema = z.object({ role: z.enum(["USER","ADMIN","SUPER_ADMIN"]) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { appUser } = await requireUser();
  requireRole(appUser, ["SUPER_ADMIN"]);

  const userId = params.id;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ role: parsed.data.role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: appUser.id,
    targetType: "USER",
    targetId: userId,
    action: "SET_ROLE",
    detail: { role: parsed.data.role },
  });

  return NextResponse.json({ ok: true });
}
