# Paapan Deploy Operational Checklist

Last updated: 2026-07-09

## Tujuan

Dokumen ini adalah runbook deploy praktis untuk membawa Paapan ke `Open Beta` dengan langkah yang bisa diikuti, dicek, dan diulang.

## Asumsi

- Target rilis saat ini adalah `Open Beta`
- Build dan lint sudah lolos di lokal
- Deploy production memakai Vercel dari branch utama
- Cron untuk finalisasi penghapusan akun sudah dikonfigurasi di `vercel.json`

## 1. Pre-Deploy Gate

Checklist ini harus hijau sebelum deploy:

- [x] `npm run lint` lolos tanpa error
- [x] `npm run build` lolos
- [x] Workflow CI GitHub aktif untuk `lint` + `build`
- [x] Copy pricing / subscription masih konsisten dengan mode `Open Beta`
- [x] Env production sudah terpasang menurut owner
- [x] SQL penting sudah dijalankan menurut owner
- [x] Admin allowlist sudah benar menurut test admin owner
- [x] Jalur feedback email sudah dites menurut owner
- [x] Cron account deletion sudah disiapkan

## 2. Environment Variables

Gunakan `.env.example` sebagai template aman, lalu lihat `docs/19_env_route_mapping.md` untuk peta pemakaian env per fitur dan `docs/20_env_production_checklist.md` untuk checklist final pengisian.

### Wajib untuk core app

- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] `GEMINI_API_KEY`

Dipakai di:

- `app/api/generate/route.ts`
- `app/api/credits/route.ts`
- `app/api/byok/validate/route.ts`
- `app/api/upload/image/route.ts`
- `app/api/public/board/*`
- `app/api/admin/*`

### Wajib untuk feedback / support

- [x] `ZOHO_SMTP_HOST`
- [x] `ZOHO_SMTP_PORT`
- [x] `ZOHO_SMTP_USER`
- [x] `ZOHO_SMTP_PASS`
- [x] `FEEDBACK_INBOX`

Dipakai di:

- `app/api/feedback/route.ts`

### Wajib untuk admin / internal ops

- [x] `ADMIN_EMAIL_ALLOWLIST`
- [x] `CRON_SECRET`

Dipakai di:

- `lib/admin.ts`
- `app/api/internal/account/finalize-deletions/route.ts`

### Format yang disarankan

- [x] `ADMIN_EMAIL_ALLOWLIST` format koma: `admin1@example.com,admin2@example.com`
- [x] `CRON_SECRET` random panjang, jangan pakai string sederhana
- [x] `ZOHO_SMTP_PORT` konsisten dengan mode SMTP yang dipakai

## 3. Database / SQL Migration

Jalankan dan verifikasi file berikut di Supabase project production:

- [x] `docs/07_ai_events_tracking.sql`
- [x] `docs/12_feedback_submissions.sql`
- [x] `docs/16_rate_limit_storage.sql`
- [x] `docs/security/2026-03-23-credit-reset-server-authoritative.sql`
- [x] `docs/security/2026-06-03-workspace-sharing-mvp.sql`

Lihat `docs/21_sql_migration_execution_order.md` untuk urutan eksekusi yang direkomendasikan dan verifikasi per langkah.

Sesudah eksekusi:

- [x] Tabel / policy yang dibutuhkan benar-benar ada menurut test owner
- [x] Tidak ada error SQL manual menurut test owner
- [x] Endpoint admin, feedback, credits, sharing masih bisa jalan menurut test owner

## 4. Deploy Sequence

1. Pastikan branch release sudah dipilih.
2. Pastikan env production sudah terisi.
3. Jalankan `npm run lint`.
4. Jalankan `npm run build`.
5. Deploy ke preview dulu jika platform mendukung.
6. Uji smoke test preview.
7. Baru promote / deploy ke production.

## 5. Cron / Scheduled Job

Repo punya endpoint internal:

- `GET /api/internal/account/finalize-deletions`

Kebutuhan:

- [x] Scheduler memanggil endpoint itu secara periodik
- [x] Jika pakai Vercel Cron, `Authorization: Bearer <CRON_SECRET>` otomatis terkirim
- [x] Jika pakai scheduler manual, boleh kirim `x-cron-secret: <CRON_SECRET>` atau `Authorization: Bearer <CRON_SECRET>`
- [x] Frekuensi minimal harian

Catatan:

- Repo sudah punya `vercel.json` dengan schedule `0 19 * * *`.
- Owner sudah menekan Run manual di Vercel dan endpoint mengembalikan `200`.

## 6. Smoke Test Setelah Deploy

Gunakan `docs/23_production_smoke_test_matrix.md` sebagai checklist eksekusi rinci setelah preview atau production deploy.

### Auth

- [ ] Register user baru
- [ ] Login user biasa
- [ ] Forgot password
- [ ] Reset password
- [ ] Schedule account deletion

### Core Product

- [ ] Buat workspace baru
- [ ] Tambah text node
- [ ] Tambah AI input node
- [ ] Generate AI response
- [ ] Upload image
- [ ] Simpan workspace
- [ ] Share board
- [ ] Buka shared board via token

### Admin / Support

- [ ] Admin overview terbuka untuk email allowlist
- [ ] Admin users page bisa load
- [ ] Feedback submit tersimpan
- [ ] Feedback email terkirim
- [ ] Rate limiting tidak memblokir flow normal

## 7. Open Beta Checks

- [x] CTA paket tambahan masih mengarah ke WhatsApp / email, bukan checkout live
- [x] Tidak ada copy yang menjanjikan payment gateway sudah aktif
- [x] Credit flow gratis dan BYOK masih jelas
- [x] Jalur bantuan user beta terlihat

## 8. Rollback Minimum

Jika deploy bermasalah:

- [ ] Rollback ke deployment stabil sebelumnya
- [ ] Jangan ubah SQL production lagi sampai root cause jelas
- [ ] Cek error di route: `generate`, `feedback`, `credits`, `upload/image`, `public/board`
- [ ] Verifikasi `ADMIN_EMAIL_ALLOWLIST` dan `SUPABASE_SERVICE_ROLE_KEY` tidak salah isi

## 9. Status Saat Ini

Status yang sudah terverifikasi pada 2026-07-09:

- [x] `npm run build` lolos
- [x] `npm run lint` lolos bersih
- [x] Dokumentasi readiness release sudah ada
- [x] Env production dilaporkan sudah benar oleh owner dari Vercel
- [x] SQL production dilaporkan sudah berhasil dijalankan oleh owner
- [x] Cron production terlihat di `vercel.json` dan dilaporkan berhasil dijalankan owner
- [ ] Monitoring 24-72 jam pertama setelah public beta masih berjalan setelah link dibagikan
