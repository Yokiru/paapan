# Paapan Production Smoke Test Matrix

Last updated: 2026-07-02

## Tujuan

Dokumen ini dipakai sesudah preview deploy atau production deploy untuk mengecek flow utama Paapan secara cepat, konsisten, dan bisa diulang oleh tim.

## Aturan Pakai

- Jalankan di environment preview dulu, lalu ulang di production
- Catat hasil `Pass`, `Fail`, atau `N/A`
- Jika satu flow inti gagal, hentikan promote ke production

## Test Roles

Siapkan minimal:

- 1 akun user biasa
- 1 akun admin yang ada di `ADMIN_EMAIL_ALLOWLIST`
- 1 browser / session anonim untuk cek flow guest dan public share

## A. Landing / Public Pages

### A1. Home

- Tujuan: halaman publik terbuka normal
- Langkah: buka `/`
- Ekspektasi:
  - halaman render tanpa error
  - CTA dan branding tampil

### A2. Pricing

- Tujuan: copy `Open Beta` konsisten
- Langkah: buka `/pricing`
- Ekspektasi:
  - tidak ada checkout live
  - CTA paket tambahan mengarah ke contact flow
  - tidak ada klaim payment sudah aktif

### A3. Terms

- Tujuan: legal copy sinkron dengan `Open Beta`
- Langkah: buka `/terms`
- Ekspektasi:
  - wording fitur berbayar belum live masih konsisten

## B. Auth

### B1. Register

- Langkah: daftar akun baru
- Ekspektasi:
  - akun berhasil dibuat
  - redirect / konfirmasi berjalan sesuai flow saat ini

### B2. Login

- Langkah: login dengan akun biasa
- Ekspektasi:
  - berhasil masuk
  - workspace bisa dimuat

### B3. Forgot Password

- Langkah: buka `/forgot-password`, kirim email reset
- Ekspektasi:
  - request diterima
  - user mendapat instruksi reset sesuai provider auth

### B4. Reset Password

- Langkah: selesaikan flow reset password
- Ekspektasi:
  - password baru tersimpan
  - user bisa login kembali

## C. Core Board

### C1. Create Workspace

- Langkah: buat board/workspace baru
- Ekspektasi:
  - workspace baru muncul di sidebar
  - URL board benar

### C2. Add Text Node

- Langkah: tambah text node card dan plain
- Ekspektasi:
  - node muncul
  - edit isi berhasil

### C3. Add AI Input Node

- Langkah: tambah AI node
- Ekspektasi:
  - node input muncul
  - bisa isi prompt

### C4. Generate AI Response

- Langkah: submit prompt AI
- Ekspektasi:
  - response muncul
  - tidak ada error auth / kredit / provider kalau akun memang valid
  - request tercatat kalau observability sudah aktif

### C5. Upload Image

- Langkah: upload gambar valid
- Ekspektasi:
  - upload berhasil
  - image node tersimpan
  - board tetap bisa disimpan ulang

### C6. Autosave / Reload

- Langkah: edit board, refresh halaman
- Ekspektasi:
  - perubahan tetap ada

### C7. Export

- Langkah: jalankan export board
- Ekspektasi:
  - preview muncul
  - hasil export terunduh atau dihasilkan tanpa error

## D. Sharing

### D1. Enable Share

- Langkah: aktifkan share board
- Ekspektasi:
  - share URL berhasil dibuat
  - pengaturan visibility tersimpan

### D2. Open Public Share

- Langkah: buka link share dari session anonim
- Ekspektasi:
  - board publik terbuka
  - board view-only

### D3. Disable Share

- Langkah: matikan share
- Ekspektasi:
  - link lama tidak lagi memberi akses

## E. Credits / AI Controls

### E1. Credit Display

- Langkah: lihat indikator kredit user
- Ekspektasi:
  - saldo tampil
  - tidak ada angka kosong / error

### E2. AI Rate Limit / Abuse Guard

- Langkah: kirim request AI berulang secukupnya di environment test
- Ekspektasi:
  - ketika limit tercapai, response rate-limited muncul
  - server tidak crash

### E3. BYOK Validation

- Langkah: masukkan API key valid dan tidak valid
- Ekspektasi:
  - key valid lolos
  - key invalid ditolak dengan pesan yang jelas

## F. Feedback / Support

### F1. Feedback Submit

- Langkah: kirim feedback dari UI
- Ekspektasi:
  - request sukses
  - data tersimpan di DB atau email notification terkirim sesuai desain

### F2. Feedback Ops

- Langkah: cek inbox / storage feedback
- Ekspektasi:
  - tim support bisa menemukan feedback yang baru dikirim

## G. Admin

### G1. Admin Access

- Langkah: login sebagai admin
- Ekspektasi:
  - halaman `/admin` bisa diakses

### G2. Admin AI Metrics

- Langkah: buka `/admin/ai`
- Ekspektasi:
  - metrik AI tampil
  - jika `ai_events` sudah aktif, data tidak kosong tanpa alasan

### G3. Admin Users

- Langkah: buka `/admin/users`
- Ekspektasi:
  - daftar user load
  - aksi admin utama bisa dibuka

### G4. Admin System

- Langkah: buka `/admin/system`
- Ekspektasi:
  - system health page render

## H. Account Deletion / Internal Ops

### H1. Schedule Account Deletion

- Langkah: schedule hapus akun dari profile flow
- Ekspektasi:
  - status scheduled tersimpan
  - user mendapat pesan yang benar

### H2. Cron Finalization Readiness

- Langkah: verifikasi scheduler siap memanggil `GET /api/internal/account/finalize-deletions`
- Ekspektasi:
  - `CRON_SECRET` sudah terpasang
  - jika pakai Vercel Cron, header `Authorization: Bearer <CRON_SECRET>` otomatis cocok
  - jika manual, `x-cron-secret` atau `Authorization` cocok

## Exit Criteria

Rilis aman untuk promote jika:

- semua flow A sampai D pass
- flow E dan F pass
- admin access pass
- tidak ada error blocker di auth, AI generate, upload image, sharing, atau feedback

## Template Hasil

| ID | Test | Result | Notes |
|---|---|---|---|
| A1 | Home |  |  |
| A2 | Pricing |  |  |
| A3 | Terms |  |  |
| B1 | Register |  |  |
| B2 | Login |  |  |
| B3 | Forgot Password |  |  |
| B4 | Reset Password |  |  |
| C1 | Create Workspace |  |  |
| C2 | Add Text Node |  |  |
| C3 | Add AI Input Node |  |  |
| C4 | Generate AI Response |  |  |
| C5 | Upload Image |  |  |
| C6 | Autosave / Reload |  |  |
| C7 | Export |  |  |
| D1 | Enable Share |  |  |
| D2 | Open Public Share |  |  |
| D3 | Disable Share |  |  |
| E1 | Credit Display |  |  |
| E2 | AI Rate Limit |  |  |
| E3 | BYOK Validation |  |  |
| F1 | Feedback Submit |  |  |
| F2 | Feedback Ops |  |  |
| G1 | Admin Access |  |  |
| G2 | Admin AI Metrics |  |  |
| G3 | Admin Users |  |  |
| G4 | Admin System |  |  |
| H1 | Schedule Account Deletion |  |  |
| H2 | Cron Finalization Readiness |  |  |

## Referensi

- `docs/18_deploy_operational_checklist.md`
- `docs/20_env_production_checklist.md`
- `docs/21_sql_migration_execution_order.md`
