import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processOutboxOnce } from "@/lib/process_outbox";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || token !== env.CRON_TOKEN) {
    return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  }

  const result = await processOutboxOnce(50);
  return NextResponse.json({ ok: true, ...result });
}
