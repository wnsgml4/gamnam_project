import { auth } from "./auth";
import { getAppUserById } from "./auth";
import type { AppUser, UserRole } from "./types";

export async function requireUser(): Promise<{ appUser: AppUser }> {
  const session = await auth();
  const appUserId = (session as any)?.appUserId as string | undefined;
  if (!appUserId) {
    throw new Response(JSON.stringify({ message: "UNAUTHENTICATED" }), { status: 401 });
  }
  const appUser = await getAppUserById(appUserId);
  if (!appUser) {
    throw new Response(JSON.stringify({ message: "USER_NOT_FOUND" }), { status: 401 });
  }
  return { appUser };
}

export function requireRole(appUser: AppUser, roles: UserRole[]) {
  if (!roles.includes(appUser.role)) {
    throw new Response(JSON.stringify({ message: "FORBIDDEN" }), { status: 403 });
  }
}

export function requireApprovedForBooking(appUser: AppUser) {
  if (appUser.role !== "USER") {
    throw new Response(JSON.stringify({ message: "ONLY_USER_CAN_BOOK" }), { status: 403 });
  }
  if (appUser.status !== "APPROVED") {
    throw new Response(JSON.stringify({ message: "USER_NOT_APPROVED" }), { status: 403 });
  }
  if (appUser.suspended_until && new Date(appUser.suspended_until) > new Date()) {
    throw new Response(JSON.stringify({ message: "USER_SUSPENDED", suspended_until: appUser.suspended_until }), { status: 403 });
  }
}
