import Link from "next/link";
import { auth } from "@/lib/auth";
import { getAppUserById } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  const appUserId = (session as any)?.appUserId as string | undefined;
  const user = appUserId ? await getAppUserById(appUserId) : null;

  return (
    <main>
      <h1>강남지부 위스키 아지트 예약</h1>

      {!session ? (
        <div>
          <p>로그인 후 이용 가능합니다.</p>
          <a href="/api/auth/signin">카카오로 로그인</a>
        </div>
      ) : (
        <div>
          <p>안녕하세요{user?.nickname ? `, ${user.nickname}` : ""}.</p>
          <p>상태: <b>{user?.status}</b> / 권한: <b>{user?.role}</b></p>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/me">내 예약</Link>
            <Link href="/book">예약 요청</Link>
            <Link href="/admin">관리자</Link>
            <a href="/api/auth/signout">로그아웃</a>
          </div>

          {user?.status !== "APPROVED" && user?.role === "USER" ? (
            <p style={{ marginTop: 12, padding: 12, border: "1px solid #ddd" }}>
              현재 <b>승인 대기</b> 상태입니다. 관리자가 승인하면 예약 요청이 가능합니다.
            </p>
          ) : null}
        </div>
      )}
    </main>
  );
}
