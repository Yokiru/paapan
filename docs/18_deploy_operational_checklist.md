# Paapan Deploy Operational Checklist

Last updated: 2026-07-02

## Tujuan

Dokumen ini adalah runbook deploy praktis untuk membawa Paapan ke `Open Beta` dengan langkah yang bisa diikuti, dicek, dan diulang.

## Asumsi

- Target rilis saat ini adalah `Open Beta`
- Build dan lint sudah lolos di lokal
- Repo belum menunjukkan automation deploy yang lengkap dari root project
- Cron untuk finalisasi penghapusan akun perlu dihubungkan dari platform deploy

## 1. Pre-Deploy Gate

Checklist ini harus hijau sebelum deploy:

- [ ] `npm run lint` lolos tanpa error
- [ ] `npm run build` lolos
- [ ] Workflow CI GitHub aktif dan passing minimal untuk `lint` + `build`
- [ ] Copy pricing / subscription masih konsisten dengan mode `Open Beta`
- [ ] Env production sudah terpasang
- [ ] SQL penting sudah dijalankan
- [ ] Admin allowlist sudah benar
- [ ] Jalur feedback email sudah dites
- [ ] Cron account deletion sudah disiapkan

## 2. Environment Variables

Gunakan `.env.example` sebagai template aman, lalu lihat `docs/19_env_route_mapping.md` untuk peta pemakaian env per fitur dan `docs/20_env_production_checklist.md` untuk checklist final pengisian.

### Wajib untuk core app

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GEMINI_API_KEY`

Dipakai di:

- `app/api/generate/route.ts`
- `app/api/credits/route.ts`
- `app/api/byok/validate/route.ts`
- `app/api/upload/image/route.ts`
- `app/api/public/board/*`
- `app/api/admin/*`

### Wajib untuk feedback / support

- [ ] `ZOHO_SMTP_HOST`
- [ ] `ZOHO_SMTP_PORT`
- [ ] `ZOHO_SMTP_USER`
- [ ] `ZOHO_SMTP_PASS`
- [ ] `FEEDBACK_INBOX`

Dipakai di:

- `app/api/feedback/route.ts`

### Wajib untuk admin / internal ops

- [ ] `ADMIN_EMAIL_ALLOWLIST`
- [ ] `CRON_SECRET`

Dipakai di:

- `lib/admin.ts`
- `app/api/internal/account/finalize-deletions/route.ts`

### Format yang disarankan

- [ ] `ADMIN_EMAIL_ALLOWLIST` format koma: `admin1@example.com,admin2@example.com`
- [ ] `CRON_SECRET` random panjang, jangan pakai string sederhana
- [ ] `ZOHO_SMTP_PORT` konsisten dengan mode SMTP yang dipakai

## 3. Database / SQL Migration

Jalankan dan verifikasi file berikut di Supabase project production:

- [ ] `docs/07_ai_events_tracking.sql`
- [ ] `docs/12_feedback_submissions.sql`
- [ ] `docs/16_rate_limit_storage.sql`
- [ ] `docs/security/2026-03-23-credit-reset-server-authoritative.sql`
- [ ] `docs/security/2026-06-03-workspace-sharing-mvp.sql`

Lihat `docs/21_sql_migration_execution_order.md` untuk urutan eksekusi yang direkomendasikan dan verifikasi per langkah.

Sesudah eksekusi:

- [ ] Tabel / policy yang dibutuhkan benar-benar ada
- [ ] Tidak ada error SQL manual
- [ ] Endpoint admin, feedback, credits, sharing masih bisa jalan

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

- [ ] Scheduler memanggil endpoint itu secara periodik
- [ ] Jika pakai Vercel Cron, `Authorization: Bearer <CRON_SECRET>` otomatis terkirim
- [ ] Jika pakai scheduler manual, boleh kirim `x-cron-secret: <CRON_SECRET>` atau `Authorization: Bearer <CRON_SECRET>`
- [ ] Frekuensi minimal harian

Catatan:

- Repo belum memperlihatkan file scheduler platform seperti `vercel.json`
- Artinya cron kemungkinan masih perlu dipasang manual di platform deploy

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

- [ ] CTA paket tambahan masih mengarah ke WhatsApp / email, bukan checkout live
- [ ] Tidak ada copy yang menjanjikan payment gateway sudah aktif
- [ ] Credit flow gratis dan BYOK masih jelas
- [ ] Jalur bantuan user beta terlihat

## 8. Rollback Minimum

Jika deploy bermasalah:

- [ ] Rollback ke deployment stabil sebelumnya
- [ ] Jangan ubah SQL production lagi sampai root cause jelas
- [ ] Cek error di route: `generate`, `feedback`, `credits`, `upload/image`, `public/board`
- [ ] Verifikasi `ADMIN_EMAIL_ALLOWLIST` dan `SUPABASE_SERVICE_ROLE_KEY` tidak salah isi

## 9. Status Saat Ini

Status yang sudah terverifikasi lokal pada 2026-07-02:

- [x] `npm run build` lolos
- [x] `npm run lint` lolos bersih
- [x] Dokumentasi readiness release sudah ada
- [ ] Env production belum diverifikasi dari dalam repo
- [ ] SQL production belum diverifikasi dari dalam repo
- [ ] Cron production belum terlihat konfigurasinya dari dalam repo
