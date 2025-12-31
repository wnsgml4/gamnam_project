import { supabaseAdmin } from "./supabase";

export async function enqueueOutbox(params: {
  userId?: string | null;
  channel: "PUSH" | "EMAIL";
  template: string;
  payload: any;
}) {
  const { error } = await supabaseAdmin.from("notification_outbox").insert({
    user_id: params.userId ?? null,
    channel: params.channel,
    template: params.template,
    payload: params.payload,
    status: "PENDING",
  });
  if (error) throw error;
}

export async function logAdminAction(params: {
  adminId: string;
  targetType: string;
  targetId: string;
  action: string;
  detail?: any;
}) {
  const { error } = await supabaseAdmin.from("admin_action_logs").insert({
    admin_id: params.adminId,
    target_type: params.targetType,
    target_id: params.targetId,
    action: params.action,
    detail: params.detail ?? null,
  });
  if (error) throw error;
}
