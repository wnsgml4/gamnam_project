export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "PENDING" | "APPROVED" | "BLOCKED";
export type ReservationStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "NO_SHOW";

export type AppUser = {
  id: string;
  provider: string;
  provider_account_id: string;
  email: string | null;
  nickname: string | null;
  role: UserRole;
  status: UserStatus;
  suspended_until: string | null;
};
