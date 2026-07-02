# Paapan Production Env Checklist

Last updated: 2026-07-02

## Tujuan

Dokumen ini dipakai saat menyiapkan environment variable di production, preview, atau staging supaya tidak ada env yang tertinggal atau salah isi.

## Aturan Dasar

- Jangan commit secret asli ke git
- Pakai `.env.example` sebagai template
- Cek `docs/19_env_route_mapping.md` kalau ingin tahu env dipakai fitur mana
- Pakai secret yang berbeda untuk local, preview, dan production

## Core App

- [ ] `NEXT_PUBLIC_SITE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GEMINI_API_KEY`

Validasi cepat:

- [ ] URL site mengarah ke domain production yang benar
- [ ] URL Supabase mengarah ke project production yang benar
- [ ] Anon key dan service role key berasal dari project yang sama
- [ ] Gemini key aktif dan tidak expired

## Feedback / Email

- [ ] `FEEDBACK_INBOX`
- [ ] `FEEDBACK_SENDER_NAME`
- [ ] `ZOHO_SMTP_HOST`
- [ ] `ZOHO_SMTP_PORT`
- [ ] `ZOHO_SMTP_USER`
- [ ] `ZOHO_SMTP_PASS`

Validasi cepat:

- [ ] SMTP user benar
- [ ] SMTP password adalah app password / credential yang masih valid
- [ ] Inbox tujuan benar
- [ ] Sender name sesuai branding yang diinginkan

## Admin / Internal Ops

- [ ] `ADMIN_EMAIL_ALLOWLIST`
- [ ] `CRON_SECRET`

Validasi cepat:

- [ ] Semua email admin production masuk allowlist
- [ ] Tidak ada typo atau spasi aneh di daftar email
- [ ] `CRON_SECRET` panjang dan random

## Share / Token Signing

- [ ] `PAAPAN_SHARE_SECRET`

Opsional legacy fallback:

- [ ] `SHARE_LINK_SECRET` hanya jika memang masih diperlukan

Validasi cepat:

- [ ] Secret signing share tidak bergantung ke `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Secret panjang dan random

## Canonical Separation

- [ ] Local memakai credential sendiri
- [ ] Preview memakai credential sendiri atau environment preview terpisah
- [ ] Production tidak berbagi secret dengan local

## Security Checks

- [ ] Tidak ada secret production di file dokumentasi
- [ ] Tidak ada secret production di screenshot / paste chat / issue tracker
- [ ] Kalau secret pernah terekspos, lakukan rotation sebelum deploy

## Deploy Checks

Sebelum tekan deploy:

- [ ] Semua env di atas sudah diisi
- [ ] `npm run lint` lolos
- [ ] `npm run build` lolos
- [ ] CI remote hijau

Sesudah deploy:

- [ ] Login jalan
- [ ] AI generate jalan
- [ ] Feedback submit jalan
- [ ] Admin page bisa dibuka oleh admin valid
- [ ] Share board jalan
- [ ] Cron endpoint siap dipanggil scheduler

## Referensi

- `.env.example`
- `docs/18_deploy_operational_checklist.md`
- `docs/19_env_route_mapping.md`
