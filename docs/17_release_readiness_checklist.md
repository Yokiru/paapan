# Paapan Release Readiness Checklist

Last updated: 2026-07-09

## Tujuan

Dokumen ini adalah checklist kerja praktis supaya Paapan bisa bergerak dari kondisi sekarang menuju rilis yang aman, konsisten, dan bisa dioperasikan.

## Keputusan Rilis Dulu

Sebelum eksekusi teknis, putuskan mode rilis:

- [x] `Open Beta`: payment tetap nonaktif, semua CTA mengarah ke waitlist / WhatsApp / email
- [ ] `Paid Launch`: payment aktif, harga final aktif, flow upgrade benar-benar bisa dipakai

Keputusan saat ini: `Open Beta` soft launch terbatas.

## Status Saat Audit

- `npm run build`: lolos pada 2026-07-01 setelah font eksternal dihapus dari jalur build
- `npm run lint`: lolos bersih pada 2026-07-09
- Security baseline: cukup baik untuk beta kecil
- Messaging product/pricing: sudah diselaraskan ke mode `Open Beta`
- CI/release automation: `.github/workflows/ci.yml` sudah ada

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
- [x] Simpan keputusan rilis final di dokumen ini

### 5. Buat Checklist Deploy dan Operasional

Referensi operasional sekarang ada di `docs/18_deploy_operational_checklist.md`.

- [x] Daftar env production yang wajib
- [x] Daftar migration SQL yang wajib sudah dijalankan
- [x] Daftar fitur yang harus dites setelah deploy
- [x] Daftar akun admin / allowlist yang valid
- [x] Daftar cron/job yang harus aktif

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
- [x] Tentukan branch / preview flow sebelum merge ke production
- [x] Pastikan ada smoke test manual sesudah deploy

Catatan 2026-07-09:

- Production deploy memakai `main -> Vercel` otomatis.
- Owner sudah menjalankan smoke test utama di production.
- Mode yang dipakai adalah soft launch, bukan paid launch penuh.

## Checklist QA Sebelum Rilis

### Auth dan Akun

- [x] Register / login dasar dilaporkan aman oleh owner
- [x] Forgot password / reset password flow tersedia dan production perlu terus dipantau
- [x] Account deletion flow didukung cron production

### Core Product

- [x] Buat board baru
- [x] Tambah text node
- [x] Tambah AI node
- [x] Generate AI response
- [x] Upload image / image node tersedia, tetap pantau quota storage
- [x] Share board via link
- [x] Buka shared board sebagai viewer
- [x] Export board tersedia, tetap pantau laporan user
- [x] Cek batas tier gratis / beta

### Admin dan Support

- [x] Admin overview bisa diakses admin valid
- [x] Feedback form tersimpan / terkirim
- [x] Rate limit tersedia
- [ ] Blocked account perlu dipantau jika ada kasus nyata

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
- [x] Env production lengkap menurut verifikasi owner di Vercel
- [x] Migration penting sudah dijalankan menurut verifikasi owner
- [x] Smoke test flow utama lolos menurut verifikasi owner
- [x] Ada jalur support yang jelas untuk user beta

## Definisi Siap Public Beta

Paapan bisa dianggap siap untuk `Public Open Beta terbatas` jika:

- [x] Production aktif
- [x] Env production terisi
- [x] SQL production dijalankan
- [x] Cron production aktif
- [x] AI credit dasar lolos
- [x] Feedback dan admin lolos
- [x] Share board lolos
- [x] Lint/build final lolos
- [ ] Monitoring 24-72 jam pertama dilakukan setelah link dibagikan

## Catatan

- Untuk saat ini, target paling realistis adalah `Open Beta` yang rapi, bukan `Paid Launch` penuh.
- Security hardening besar terakhir sudah tercatat di `docs/security-audit.md`, jadi dokumen ini fokus pada readiness rilis end-to-end.
