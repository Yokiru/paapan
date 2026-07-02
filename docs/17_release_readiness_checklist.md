# Paapan Release Readiness Checklist

Last updated: 2026-07-02

## Tujuan

Dokumen ini adalah checklist kerja praktis supaya Paapan bisa bergerak dari kondisi sekarang menuju rilis yang aman, konsisten, dan bisa dioperasikan.

## Keputusan Rilis Dulu

Sebelum eksekusi teknis, putuskan mode rilis:

- [ ] `Open Beta`: payment tetap nonaktif, semua CTA mengarah ke waitlist / WhatsApp / email
- [ ] `Paid Launch`: payment aktif, harga final aktif, flow upgrade benar-benar bisa dipakai

Rekomendasi saat ini: pilih `Open Beta` dulu sampai blocker build, lint, dan operasional dasar selesai.

## Status Saat Audit

- `npm run build`: lolos pada 2026-07-01 setelah font eksternal dihapus dari jalur build
- `npm run lint`: lolos bersih pada 2026-07-02
- Security baseline: cukup baik untuk beta kecil
- Messaging product/pricing: sudah diselaraskan ke mode `Open Beta`
- CI/release automation: belum terlihat dari root project

## Checklist Prioritas P0

Ini yang sebaiknya dibereskan sebelum rilis beta yang lebih luas.

### 1. Stabilkan Build Produksi

- [x] Ganti `Shantell Sans` dari Google Font ke fallback lokal yang tidak butuh fetch saat build
- [x] Jalankan ulang `npm run build`
- [x] Pastikan build lolos tanpa dependency pada network eksternal

Referensi:

- `app/layout.tsx`

### 2. Bereskan Lint Error yang Berisiko Runtime

Fokus dulu ke error, bukan semua warning.

- [x] Perbaiki akses ref saat render
- [x] Perbaiki `setState` di dalam effect yang memicu rule React baru
- [x] Kurangi `any` pada path kritis auth, generate, settings, store
- [x] Hilangkan `require()` di file store/client yang sekarang ditolak lint
- [x] Jalankan ulang `npm run lint`

Fokus file awal:

- `components/ui/Sidebar.tsx`
- `components/admin/AdminShell.tsx`
- `components/ui/AISettingsModal.tsx`
- `components/ui/SearchBar.tsx`
- `store/useMindStore.ts`
- `app/api/generate/route.ts`

### 3. Samakan Positioning Produk dan Monetisasi

- [x] Putuskan apakah pricing page menampilkan `Coming Soon`, `Waitlist`, atau harga final
- [x] Samakan copy di pricing page, subscription modal, terms, dan docs
- [x] Jika payment belum aktif, hilangkan copy yang terkesan checkout sudah live
- [x] Tentukan satu CTA utama: `WhatsApp`, `email`, atau `waitlist form`

File yang perlu dicek:

- `app/pricing/page.tsx`
- `components/ui/SubscriptionModal.tsx`
- `app/terms/page.tsx`
- `docs/05_open_beta_plan.md`

## Checklist Prioritas P1

Ini penting untuk release yang rapi dan operasional.

### 4. Rapikan Dokumentasi Inti

- [x] Ganti `README.md` template Next.js dengan deskripsi proyek yang nyata
- [x] Update `docs/README.md` supaya daftar pricing/status tidak ketinggalan
- [x] Update `docs/04_product_roadmap.md` karena target fase lama sudah lewat
- [ ] Simpan keputusan rilis final di dokumen ini

### 5. Buat Checklist Deploy dan Operasional

Referensi operasional sekarang ada di `docs/18_deploy_operational_checklist.md`.

- [ ] Daftar env production yang wajib
- [ ] Daftar migration SQL yang wajib sudah dijalankan
- [ ] Daftar fitur yang harus dites setelah deploy
- [ ] Daftar akun admin / allowlist yang valid
- [ ] Daftar cron/job yang harus aktif

Minimal env yang terlihat dipakai sekarang:

- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ZOHO_SMTP_HOST`
- `ZOHO_SMTP_PORT`
- `ZOHO_SMTP_USER`
- `ZOHO_SMTP_PASS`
- `FEEDBACK_INBOX`
- `ADMIN_EMAIL_ALLOWLIST`
- `CRON_SECRET`

Migration / SQL yang perlu dicek status eksekusinya:

- `docs/12_feedback_submissions.sql`
- `docs/16_rate_limit_storage.sql`
- `docs/07_ai_events_tracking.sql`
- `docs/security/2026-03-23-credit-reset-server-authoritative.sql`
- `docs/security/2026-06-03-workspace-sharing-mvp.sql`

### 6. Tambahkan Guardrail Release

- [x] Tambah CI minimal untuk `npm run lint` dan `npm run build`
- [ ] Tentukan branch / preview flow sebelum merge ke production
- [ ] Pastikan ada smoke test manual sesudah deploy

## Checklist QA Sebelum Rilis

### Auth dan Akun

- [ ] Register
- [ ] Login
- [ ] Confirm signup
- [ ] Forgot password
- [ ] Reset password
- [ ] Account deletion flow

### Core Product

- [ ] Buat board baru
- [ ] Tambah text node
- [ ] Tambah AI node
- [ ] Generate AI response
- [ ] Upload image
- [ ] Share board via link
- [ ] Buka shared board sebagai viewer
- [ ] Export board
- [ ] Cek batas tier gratis / beta

### Admin dan Support

- [ ] Admin overview bisa diakses admin valid
- [ ] Feedback form tersimpan / terkirim
- [ ] Rate limit bekerja
- [ ] Blocked account benar-benar ditolak

## Urutan Eksekusi Rekomendasi

1. Selesaikan blocker build font.
2. Rapikan lint error prioritas tinggi.
3. Putuskan mode rilis `Open Beta` vs `Paid Launch`.
4. Samakan semua copy pricing dan subscription.
5. Rapikan README dan roadmap.
6. Verifikasi migration + env production.
7. Tambah CI minimal.
8. Jalankan QA smoke test.
9. Baru deploy / release.

## Definisi Siap Rilis

Paapan bisa dianggap siap untuk `Open Beta` jika semua poin ini terpenuhi:

- [x] `npm run build` lolos
- [x] `npm run lint` minimal tidak punya error kritis pada flow utama
- [x] Copy pricing dan monetisasi konsisten
- [ ] Env production lengkap
- [ ] Migration penting sudah dijalankan
- [ ] Smoke test flow utama lolos
- [ ] Ada jalur support yang jelas untuk user beta

## Catatan

- Untuk saat ini, target paling realistis adalah `Open Beta` yang rapi, bukan `Paid Launch` penuh.
- Security hardening besar terakhir sudah tercatat di `docs/security-audit.md`, jadi dokumen ini fokus pada readiness rilis end-to-end.
