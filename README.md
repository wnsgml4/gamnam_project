# 강남지부 위스키 아지트 예약(Web)

## 기능
- 카카오 로그인 (비밀번호/회원가입 UI 최소화)
- 사용자: 승인 대기(PENDING) → 관리자 승인(APPROVED) 후 예약 요청 가능
- 예약 요청(선착순 큐): REQUESTED
- 관리자: 승인(APPROVED) / 거절(REJECTED)
- 예외 중복 허용 승인: override_conflict=true + 사유 필수
- 사용자 알림: 웹푸시
- 관리자 알림: 이메일(Outbox 기반)
- 모든 관리자 행위: 감사 로그(admin_action_logs)

## 로컬 실행
1) Supabase 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` 실행
2) `.env.example`를 `.env.local`로 복사 후 값 채우기
3) 설치/실행
```bash
npm install
npm run dev
```

## 배포(무료)
- Vercel: Next.js 배포
- Supabase: Postgres/Storage 사용
- Cron(무료): GitHub Actions로 `/api/cron/process?token=...` 호출 (README 아래 참고)

## Cron(Outbox 처리)
- `/api/cron/process?token=CRON_TOKEN` : PENDING outbox를 발송 처리(웹푸시/이메일)

## 보안 원칙
- Supabase service role key는 서버에서만 사용 (절대 브라우저로 노출 금지)
- 관리자 API는 ADMIN/SUPER_ADMIN만 접근
- 예외 중복 승인은 별도 엔드포인트 + 사유 필수 + 로그 필수
