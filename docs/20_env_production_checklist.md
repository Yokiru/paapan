# Paapan Production Env Checklist

Last updated: 2026-07-09

## Tujuan

Dokumen ini dipakai saat menyiapkan environment variable di production, preview, atau staging supaya tidak ada env yang tertinggal atau salah isi.

## Aturan Dasar

- Jangan commit secret asli ke git
- Pakai `.env.example` sebagai template
- Cek `docs/19_env_route_mapping.md` kalau ingin tahu env dipakai fitur mana
- Pakai secret yang berbeda untuk local, preview, dan production

## Core App

- [x] `NEXT_PUBLIC_SITE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] `GEMINI_API_KEY`

Validasi cepat:

- [x] URL site mengarah ke domain production yang benar
- [x] URL Supabase mengarah ke project production yang benar
- [x] Anon key dan service role key berasal dari project yang sama
- [x] Gemini key aktif dan tidak expired

## Feedback / Email

- [x] `FEEDBACK_INBOX`
- [x] `FEEDBACK_SENDER_NAME`
- [x] `ZOHO_SMTP_HOST`
- [x] `ZOHO_SMTP_PORT`
- [x] `ZOHO_SMTP_USER`
- [x] `ZOHO_SMTP_PASS`

Validasi cepat:

- [x] SMTP user benar
- [x] SMTP password adalah app password / credential yang masih valid
- [x] Inbox tujuan benar
- [x] Sender name sesuai branding yang diinginkan

## Admin / Internal Ops

- [x] `ADMIN_EMAIL_ALLOWLIST`
- [x] `CRON_SECRET`

Validasi cepat:

- [x] Semua email admin production masuk allowlist
- [x] Tidak ada typo atau spasi aneh di daftar email
- [x] `CRON_SECRET` panjang dan random

## Share / Token Signing

- [x] `PAAPAN_SHARE_SECRET`

Opsional legacy fallback:

- [ ] `SHARE_LINK_SECRET` hanya jika memang masih diperlukan

Validasi cepat:

- [x] Secret signing share tidak bergantung ke `SUPABASE_SERVICE_ROLE_KEY`
- [x] Secret panjang dan random

## Canonical Separation

- [ ] Local memakai credential sendiri
- [ ] Preview memakai credential sendiri atau environment preview terpisah
- [ ] Production tidak berbagi secret dengan local

## Security Checks

- [x] Tidak ada secret production di file dokumentasi
- [x] Tidak ada secret production di screenshot / paste chat / issue tracker
- [x] Kalau secret pernah terekspos, lakukan rotation sebelum deploy

## Deploy Checks

Sebelum tekan deploy:

- [x] Semua env di atas sudah diisi
- [x] `npm run lint` lolos
- [x] `npm run build` lolos
- [x] CI remote tersedia

Sesudah deploy:

- [x] Login jalan
- [x] AI generate jalan
- [x] Feedback submit jalan
- [x] Admin page bisa dibuka oleh admin valid
- [x] Share board jalan
- [x] Cron endpoint siap dipanggil scheduler

## Catatan Status

Status checkbox production di atas berdasarkan verifikasi owner dari Vercel dan smoke test production pada 2026-07-09. Nilai secret asli tidak disimpan di repo.

## Referensi

- `.env.example`
- `docs/18_deploy_operational_checklist.md`
- `docs/19_env_route_mapping.md`
