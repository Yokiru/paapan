# Paapan SQL Migration Execution Order

Last updated: 2026-07-02

## Tujuan

Dokumen ini memberi urutan eksekusi SQL migration production yang aman untuk `Open Beta`, plus apa yang harus dicek sesudah tiap langkah.

## Prinsip

- Jalankan di project Supabase yang benar
- Eksekusi satu file, verifikasi, baru lanjut file berikutnya
- Simpan log hasil eksekusi atau screenshot sukses
- Kalau ada error, berhenti dulu dan jangan lompat ke migration berikutnya

## Urutan Rekomendasi

### 1. Tracking AI Events

File:

- `docs/07_ai_events_tracking.sql`

Kenapa duluan:

- ini berdiri sendiri
- menambah tabel observability
- risiko bentrok relatif kecil

Verifikasi:

- [ ] tabel `public.ai_events` ada
- [ ] index `ai_events_*` terbentuk
- [ ] RLS aktif
- [ ] policy `ai_events_admin_service_only` ada

### 2. Feedback Submissions

File:

- `docs/12_feedback_submissions.sql`

Kenapa urutan kedua:

- tabel baru, trigger baru
- tidak bergantung ke rate limit atau sharing

Verifikasi:

- [ ] tabel `public.feedback_submissions` ada
- [ ] index feedback terbentuk
- [ ] function `public.set_feedback_submissions_updated_at()` ada
- [ ] trigger `feedback_submissions_set_updated_at` ada

### 3. Rate Limit Storage

File:

- `docs/16_rate_limit_storage.sql`

Kenapa urutan ketiga:

- menambah tabel + function penting untuk guardrail API
- berdampak ke runtime request path, jadi sebaiknya diverifikasi terpisah

Verifikasi:

- [ ] tabel `public.rate_limits` ada
- [ ] index `rate_limits_reset_at_idx` ada
- [ ] function `public.check_rate_limit(...)` ada
- [ ] grant execute ke `service_role` ada

### 4. Credit Reset Server-Authoritative

File:

- `docs/security/2026-03-23-credit-reset-server-authoritative.sql`

Kenapa sesudah rate limit:

- ini menyentuh logika kredit yang lebih sensitif
- lebih aman dikerjakan setelah observability dan infra dasar masuk

Verifikasi:

- [ ] function `public.deduct_credits(...)` ter-update
- [ ] row existing di `public.credit_balances` ter-normalisasi
- [ ] tier `free`, `plus`, `pro` punya perilaku reset yang sesuai

Catatan:

- migration ini meng-update data existing, jadi jalankan dengan perhatian lebih tinggi

### 5. Workspace Sharing MVP

File:

- `docs/security/2026-06-03-workspace-sharing-mvp.sql`

Kenapa terakhir:

- menyentuh schema `workspaces`
- terkait feature publik / sharing yang user-facing
- lebih aman dieksekusi sesudah core credits, feedback, dan observability stabil

Verifikasi:

- [ ] kolom `share_visibility` ada
- [ ] kolom `share_token_nonce` ada
- [ ] kolom `allow_public_duplicate` ada
- [ ] kolom `shared_at` ada
- [ ] kolom `share_updated_at` ada
- [ ] unique index `workspaces_share_token_nonce_unique_idx` ada

## Urutan Ringkas

1. `docs/07_ai_events_tracking.sql`
2. `docs/12_feedback_submissions.sql`
3. `docs/16_rate_limit_storage.sql`
4. `docs/security/2026-03-23-credit-reset-server-authoritative.sql`
5. `docs/security/2026-06-03-workspace-sharing-mvp.sql`

## Checklist Eksekusi Production

Sebelum mulai:

- [ ] Backup / export penting sudah ada
- [ ] Project Supabase production sudah dipastikan benar
- [ ] Env app production belum diarahkan ke schema yang setengah jadi

Saat eksekusi:

- [ ] Jalankan satu file
- [ ] Simpan hasil sukses / error
- [ ] Verifikasi object yang dibuat
- [ ] Lanjut file berikutnya hanya jika langkah sekarang sukses

Sesudah semua migration:

- [ ] `app/api/generate` masih jalan
- [ ] `app/api/feedback` masih jalan
- [ ] `app/api/credits` masih jalan
- [ ] `app/api/boards/[workspaceId]/share` masih jalan
- [ ] admin dashboard bisa membaca metrik AI

## Jika Ada Error

- Berhenti di migration yang gagal
- Catat statement yang gagal
- Cek apakah object sebagian sudah terbuat
- Jangan eksekusi migration berikutnya sebelum root cause jelas

## Referensi

- `docs/18_deploy_operational_checklist.md`
- `docs/19_env_route_mapping.md`
- `docs/20_env_production_checklist.md`
