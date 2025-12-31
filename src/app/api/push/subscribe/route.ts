import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/guards";

const schema = z.object({
  subscription: z.any(),
});

export async function POST(req: Request) {
  const { appUser } = await requireUser();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "VALIDATION_ERROR" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("push_subscriptions").upsert({
    user_id: appUser.id,
    subscription: parsed.data.subscription,
  });

  if (error) return NextResponse.json({ message: "DB_ERROR", error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
