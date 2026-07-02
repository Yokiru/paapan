# Paapan Env Mapping

Last updated: 2026-07-02

## Tujuan

Dokumen ini memetakan environment variable ke route atau modul yang memakainya, supaya setup production, debugging, dan audit konfigurasi lebih cepat.

## Catatan

- Jangan isi file ini dengan secret asli.
- Gunakan `.env.example` sebagai template aman.
- `.env.local` sudah di-ignore oleh git lewat `.gitignore`.
- `NODE_ENV` biasanya disediakan otomatis oleh platform deploy, jadi tidak perlu dimasukkan ke `.env.example`.

## Ringkasan Variabel

| Env | Status | Tujuan singkat |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Optional but recommended | Canonical origin untuk auth callback dan metadata |
| `NEXT_PUBLIC_SUPABASE_URL` | Required | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Public anon key untuk client dan beberapa server helper |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Server-side privileged access ke Supabase |
| `GEMINI_API_KEY` | Required | Provider AI utama untuk generate |
| `FEEDBACK_INBOX` | Required for feedback email | Inbox tujuan feedback |
| `FEEDBACK_SENDER_NAME` | Optional | Nama pengirim email feedback |
| `ZOHO_SMTP_HOST` | Required for feedback email | SMTP host |
| `ZOHO_SMTP_PORT` | Required for feedback email | SMTP port |
| `ZOHO_SMTP_USER` | Required for feedback email | SMTP username |
| `ZOHO_SMTP_PASS` | Required for feedback email | SMTP password / app password |
| `ADMIN_EMAIL_ALLOWLIST` | Required for production ops | Daftar email admin yang diizinkan |
| `CRON_SECRET` | Required if cron enabled | Proteksi endpoint internal cron |
| `PAAPAN_SHARE_SECRET` | Recommended | Secret signing untuk share token |
| `SHARE_LINK_SECRET` | Legacy fallback | Fallback lama untuk share token |

## Mapping Per Variable

### `NEXT_PUBLIC_SITE_URL`

Dipakai di:

- `lib/authUrls.ts`

Fungsi:

- menentukan canonical origin untuk auth callback
- fallback origin di environment non-browser tertentu

### `NEXT_PUBLIC_SUPABASE_URL`

Dipakai di:

- `next.config.ts`
- `app/admin/page.tsx`
- `app/api/account/delete/route.ts`
- `app/api/admin/ai/route.ts`
- `app/api/admin/growth/route.ts`
- `app/api/admin/overview/route.ts`
- `app/api/admin/system/route.ts`
- `app/api/admin/users/route.ts`
- `app/api/boards/[workspaceId]/share/route.ts`
- `app/api/byok/validate/route.ts`
- `app/api/credits/route.ts`
- `app/api/feedback/route.ts`
- `app/api/generate/route.ts`
- `app/api/internal/account/finalize-deletions/route.ts`
- `app/api/public/board-by-id/[workspaceId]/route.ts`
- `app/api/public/board/[token]/route.ts`
- `app/api/scrape/route.ts`
- `app/api/upload/image/route.ts`
- `app/api/workspace/validate/route.ts`
- `lib/supabase.ts`
- `lib/supabaseServer.ts`

Fungsi:

- inisialisasi client Supabase client-side dan server-side
- akses admin route
- validasi workspace, credits, sharing, upload, feedback

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Dipakai di:

- `app/api/account/delete/route.ts`
- `lib/supabase.ts`
- `lib/supabaseServer.ts`

Fungsi:

- client public auth/session access
- server helper tertentu yang butuh anon context

### `SUPABASE_SERVICE_ROLE_KEY`

Dipakai di:

- `app/api/account/delete/route.ts`
- `app/api/admin/ai/route.ts`
- `app/api/admin/growth/route.ts`
- `app/api/admin/overview/route.ts`
- `app/api/admin/system/route.ts`
- `app/api/admin/users/route.ts`
- `app/api/boards/[workspaceId]/share/route.ts`
- `app/api/byok/validate/route.ts`
- `app/api/credits/route.ts`
- `app/api/feedback/route.ts`
- `app/api/generate/route.ts`
- `app/api/internal/account/finalize-deletions/route.ts`
- `app/api/public/board-by-id/[workspaceId]/route.ts`
- `app/api/public/board/[token]/route.ts`
- `app/api/scrape/route.ts`
- `app/api/upload/image/route.ts`
- `app/api/workspace/validate/route.ts`
- `lib/workspaceSharing.ts` sebagai fallback secret signing

Fungsi:

- akses server-side privileged ke Supabase
- admin dashboard, credits, feedback, upload, sharing, cron cleanup

### `GEMINI_API_KEY`

Dipakai di:

- `app/api/generate/route.ts`

Fungsi:

- generate AI response utama di server

### `FEEDBACK_INBOX`

Dipakai di:

- `app/api/feedback/route.ts`

Fungsi:

- alamat inbox tujuan feedback dari user

### `FEEDBACK_SENDER_NAME`

Dipakai di:

- `app/api/feedback/route.ts`

Fungsi:

- nama pengirim yang tampil saat feedback email dikirim

### `ZOHO_SMTP_HOST`

Dipakai di:

- `app/api/feedback/route.ts`

### `ZOHO_SMTP_PORT`

Dipakai di:

- `app/api/feedback/route.ts`

### `ZOHO_SMTP_USER`

Dipakai di:

- `app/api/feedback/route.ts`

### `ZOHO_SMTP_PASS`

Dipakai di:

- `app/api/feedback/route.ts`

Fungsi gabungan empat env SMTP di atas:

- kirim email feedback / support lewat Zoho SMTP

### `ADMIN_EMAIL_ALLOWLIST`

Dipakai di:

- `lib/admin.ts`

Terpakai secara tidak langsung oleh:

- route admin yang memanggil `isAdminEmail(...)`

Catatan:

- ada fallback email hardcoded saat allowlist kosong
- untuk production tetap disarankan isi env ini eksplisit

### `CRON_SECRET`

Dipakai di:

- `app/api/internal/account/finalize-deletions/route.ts`

Fungsi:

- memverifikasi secret cron dari scheduler
- kompatibel dengan `Authorization: Bearer <CRON_SECRET>` dan legacy `x-cron-secret`

### `PAAPAN_SHARE_SECRET`

Dipakai di:

- `lib/workspaceSharing.ts`

Fungsi:

- secret utama untuk HMAC signing share token workspace

### `SHARE_LINK_SECRET`

Dipakai di:

- `lib/workspaceSharing.ts`

Fungsi:

- fallback legacy jika `PAAPAN_SHARE_SECRET` belum diisi

## Mapping Per Route / Modul

### Auth / URL / Metadata

- `lib/authUrls.ts` -> `NEXT_PUBLIC_SITE_URL`

### AI

- `app/api/generate/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- `app/api/byok/validate/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/admin/ai/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Credits / Users / Admin

- `app/api/credits/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/admin/users/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/admin/growth/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/admin/overview/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/admin/system/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `lib/admin.ts` -> `ADMIN_EMAIL_ALLOWLIST`

### Workspaces / Sharing / Public Board

- `app/api/boards/[workspaceId]/share/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/public/board-by-id/[workspaceId]/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/public/board/[token]/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/workspace/validate/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `lib/workspaceSharing.ts` -> `PAAPAN_SHARE_SECRET`, `SHARE_LINK_SECRET`, fallback `SUPABASE_SERVICE_ROLE_KEY`

### Upload / Scrape / Feedback

- `app/api/upload/image/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/scrape/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/feedback/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FEEDBACK_INBOX`, `FEEDBACK_SENDER_NAME`, `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASS`

### Account Deletion / Internal Cron

- `app/api/account/delete/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `app/api/internal/account/finalize-deletions/route.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`

### Client / Shared Helpers

- `lib/supabase.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `lib/supabaseServer.ts` -> `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `app/admin/page.tsx` -> `NEXT_PUBLIC_SUPABASE_URL`
- `next.config.ts` -> `NEXT_PUBLIC_SUPABASE_URL`

## Urutan Cek Saat Deploy Error

Kalau fitur gagal, cek env dengan urutan ini:

1. Fitur AI gagal -> cek `GEMINI_API_KEY`, lalu Supabase pair
2. Feedback gagal -> cek `ZOHO_SMTP_*`, `FEEDBACK_INBOX`, lalu Supabase pair
3. Admin gagal -> cek `ADMIN_EMAIL_ALLOWLIST`, lalu Supabase pair
4. Share board gagal -> cek `PAAPAN_SHARE_SECRET`, lalu Supabase pair
5. Cron gagal -> cek `CRON_SECRET`, lalu header `Authorization` / `x-cron-secret`

## Referensi

- `.env.example`
- `docs/18_deploy_operational_checklist.md`
