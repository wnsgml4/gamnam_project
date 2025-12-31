import NextAuth, { type NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import { env } from "./env";
import { supabaseAdmin } from "./supabase";
import type { AppUser } from "./types";

async function upsertUserFromKakao(params: {
  providerAccountId: string;
  email?: string | null;
  nickname?: string | null;
}) {
  const { providerAccountId, email, nickname } = params;

  const { data: existing, error: selErr } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("provider", "kakao")
    .eq("provider_account_id", providerAccountId)
    .maybeSingle();

  if (selErr) throw selErr;

  if (existing) {
    const { error: updErr } = await supabaseAdmin
      .from("users")
      .update({
        email: email ?? existing.email,
        nickname: nickname ?? existing.nickname,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updErr) throw updErr;
    return existing.id as string;
  }

  const { data: ins, error: insErr } = await supabaseAdmin
    .from("users")
    .insert({
      provider: "kakao",
      provider_account_id: providerAccountId,
      email: email ?? null,
      nickname: nickname ?? null,
      role: "USER",
      status: "PENDING",
    })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return ins.id as string;
}

export async function getAppUserById(id: string): Promise<AppUser | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,provider,provider_account_id,email,nickname,role,status,suspended_until")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    KakaoProvider({
      clientId: env.KAKAO_CLIENT_ID,
      clientSecret: env.KAKAO_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // account.providerAccountId = Kakao user id(string)
      if (!account?.providerAccountId) return false;
      const email = (profile as any)?.kakao_account?.email ?? null;
      const nickname =
        (profile as any)?.kakao_account?.profile?.nickname ??
        (profile as any)?.properties?.nickname ??
        null;

      const appUserId = await upsertUserFromKakao({
        providerAccountId: account.providerAccountId,
        email,
        nickname,
      });

      // store internal user id in account/session via JWT
      (account as any).appUserId = appUserId;
      return true;
    },

    async jwt({ token, account }) {
      if (account && (account as any).appUserId) {
        token.appUserId = (account as any).appUserId;
      }
      return token;
    },

    async session({ session, token }) {
      (session as any).appUserId = token.appUserId;
      return session;
    },
  },
};

export const { handlers: authHandlers, auth } = NextAuth(authOptions);
