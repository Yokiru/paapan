# Paapan Owner Action List

Last updated: 2026-07-02

## Tujuan

Dokumen ini merangkum hal-hal yang memang harus dilakukan oleh owner / operator project di luar edit kode repo.

## Yang Harus Kamu Lakukan

### 1. Putuskan mode release final

- [ ] Konfirmasi `Open Beta` sebagai mode release saat ini
- [ ] Tahan dulu `Paid Launch` sampai payment dan operasional benar-benar siap

Kenapa ini perlu kamu putuskan:

- ini keputusan bisnis, bukan keputusan kode

### 2. Isi environment variable production

- [ ] Isi semua env dari `.env.example`
- [ ] Pastikan value production benar
- [ ] Pastikan preview dan production tidak berbagi secret sembarangan

Paling penting:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GEMINI_API_KEY`
- [ ] `ZOHO_SMTP_*`
- [ ] `FEEDBACK_INBOX`
- [ ] `ADMIN_EMAIL_ALLOWLIST`
- [ ] `CRON_SECRET`
- [ ] `PAAPAN_SHARE_SECRET`

### 3. Rotate secret jika perlu

- [ ] Evaluasi apakah `.env.local` atau secret production pernah terekspos
- [ ] Jika pernah, rotate secret terkait sebelum release

Paling sensitif:

- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GEMINI_API_KEY`
- [ ] `ZOHO_SMTP_PASS`
- [ ] `CRON_SECRET`
- [ ] `PAAPAN_SHARE_SECRET`

### 4. Jalankan SQL migration di Supabase production

- [ ] Eksekusi SQL sesuai urutan di `docs/21_sql_migration_execution_order.md`
- [ ] Simpan bukti sukses / log

### 5. Pasang cron production

- [ ] Buat scheduler untuk `GET /api/internal/account/finalize-deletions`
- [ ] Jika pakai Vercel Cron, cukup pastikan `CRON_SECRET` terpasang
- [ ] Jika pakai scheduler manual, kirim `Authorization: Bearer <CRON_SECRET>` atau `x-cron-secret`
- [ ] Atur minimal jalan harian

### 6. Pastikan admin access benar

- [ ] Isi `ADMIN_EMAIL_ALLOWLIST` dengan email admin yang valid
- [ ] Tes login admin setelah deploy

### 7. Tentukan flow branch / preview / production

- [ ] Tentukan branch utama release
- [ ] Tentukan apakah harus lewat preview dulu sebelum production
- [ ] Pastikan GitHub Actions jalan di remote

### 8. Jalankan smoke test manual

- [ ] Preview smoke test dulu
- [ ] Production smoke test sesudah promote
- [ ] Pakai `docs/23_production_smoke_test_matrix.md`

### 9. Pantau hasil setelah release

- [ ] Cek feedback masuk
- [ ] Cek admin metrics
- [ ] Cek share board
- [ ] Cek error AI / kredit / upload

## Yang Bisa Aku Bantu Lagi

Begitu kamu selesai langkah external di atas, aku bisa bantu:

- baca hasil error / screenshot / log
- cek ulang dokumen terhadap status terbaru
- bantu triage kalau ada route yang gagal setelah deploy
- bantu revisi checklist kalau proses production nyata menemukan gap

## Minimum Owner To-Do Sebelum Bisa Bilang "Selesai"

Kalau mau paling ringkas, minimum yang harus kamu selesaikan sendiri adalah:

1. isi env production
2. jalankan SQL migration
3. pasang cron
4. tentukan flow preview ke production
5. jalankan smoke test

## Referensi

- `.env.example`
- `docs/20_env_production_checklist.md`
- `docs/21_sql_migration_execution_order.md`
- `docs/23_production_smoke_test_matrix.md`
