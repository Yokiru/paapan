# Paapan Owner Action List

Last updated: 2026-07-09

## Tujuan

Dokumen ini merangkum hal-hal yang memang harus dilakukan oleh owner / operator project di luar edit kode repo.

## Yang Harus Kamu Lakukan

### 1. Putuskan mode release final

- [x] Konfirmasi `Open Beta` sebagai mode release saat ini
- [x] Tahan dulu `Paid Launch` sampai payment dan operasional benar-benar siap

Kenapa ini perlu kamu putuskan:

- ini keputusan bisnis, bukan keputusan kode

### 2. Isi environment variable production

- [x] Isi semua env dari `.env.example`
- [x] Pastikan value production benar
- [x] Pastikan preview dan production tidak berbagi secret sembarangan

Paling penting:

- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] `GEMINI_API_KEY`
- [x] `ZOHO_SMTP_*`
- [x] `FEEDBACK_INBOX`
- [x] `ADMIN_EMAIL_ALLOWLIST`
- [x] `CRON_SECRET`
- [x] `PAAPAN_SHARE_SECRET`

### 3. Rotate secret jika perlu

- [x] Evaluasi apakah `.env.local` atau secret production pernah terekspos
- [x] Jika pernah, rotate secret terkait sebelum release

Paling sensitif:

- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] `GEMINI_API_KEY`
- [x] `ZOHO_SMTP_PASS`
- [x] `CRON_SECRET`
- [x] `PAAPAN_SHARE_SECRET`

### 4. Jalankan SQL migration di Supabase production

- [x] Eksekusi SQL sesuai urutan di `docs/21_sql_migration_execution_order.md`
- [x] Simpan bukti sukses / log

### 5. Pasang cron production

- [x] Buat scheduler untuk `GET /api/internal/account/finalize-deletions`
- [x] Jika pakai Vercel Cron, cukup pastikan `CRON_SECRET` terpasang
- [x] Jika pakai scheduler manual, kirim `Authorization: Bearer <CRON_SECRET>` atau `x-cron-secret`
- [x] Atur minimal jalan harian

### 6. Pastikan admin access benar

- [x] Isi `ADMIN_EMAIL_ALLOWLIST` dengan email admin yang valid
- [x] Tes login admin setelah deploy

### 7. Tentukan flow branch / preview / production

- [x] Tentukan branch utama release
- [x] Tentukan apakah harus lewat preview dulu sebelum production
- [x] Pastikan GitHub Actions jalan di remote

### 8. Jalankan smoke test manual

- [x] Preview smoke test dulu
- [x] Production smoke test sesudah promote
- [x] Pakai `docs/23_production_smoke_test_matrix.md`

### 9. Pantau hasil setelah release

- [ ] Cek feedback masuk selama 24-72 jam public beta
- [ ] Cek admin metrics selama 24-72 jam public beta
- [ ] Cek share board selama 24-72 jam public beta
- [ ] Cek error AI / kredit / upload selama 24-72 jam public beta

## Yang Bisa Aku Bantu Lagi

Selama public beta berjalan, aku bisa bantu:

- baca hasil error / screenshot / log
- cek ulang dokumen terhadap status terbaru
- bantu triage kalau ada route yang gagal setelah deploy
- bantu revisi checklist kalau proses production nyata menemukan gap

## Minimum Owner To-Do Sebelum Bisa Bilang "Public Beta Stabil"

Kalau mau paling ringkas, minimum yang harus kamu lakukan setelah link dibagikan adalah:

1. pantau Vercel logs
2. pantau Supabase usage
3. cek feedback masuk
4. cek AI credit/cost
5. catat 5-10 feedback user nyata

## Referensi

- `.env.example`
- `docs/20_env_production_checklist.md`
- `docs/21_sql_migration_execution_order.md`
- `docs/23_production_smoke_test_matrix.md`
