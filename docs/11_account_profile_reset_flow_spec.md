# Paapan Account Profile and Password Reset Flow

## Goal
Menyederhanakan area akun Paapan agar lebih mudah dipahami, lebih aman untuk perubahan kata sandi, dan lebih konsisten dengan pola auth page yang sudah ada.

## Why We Are Changing This
Masalah pada flow saat ini:
- `Profile` dan `Settings` terpisah padahal isi pengaturannya masih sedikit.
- Ganti kata sandi dilakukan langsung di modal settings, sehingga terasa terlalu teknis dan kurang meyakinkan.
- User berharap ada alur email reset yang lebih familiar dan lebih aman.
- Arsitektur account sekarang terasa belum proporsional dengan ukuran produk saat ini.

## Product Decision
Gunakan **satu modal `Profile` sebagai account hub utama** untuk sekarang.

Keputusan utama:
- menu `Settings` dihapus dari popup sidebar
- konten `Settings` yang masih relevan dipindahkan ke `Profile`
- `Ganti Kata Sandi` tidak lagi berupa input field inline
- `Ganti Kata Sandi` menjadi aksi yang memicu flow email reset
- reset password dilakukan di halaman khusus dengan visual yang konsisten dengan login/register

## Information Architecture
### Sidebar Menu
Untuk user login:
- `Profile`
- `Pengaturan AI`
- `Langganan`
- `Feedback`
- `Bantuan`
- `Keluar`

Untuk sekarang:
- item `Settings` dihapus

### Profile Modal
Modal `Profile` menjadi tempat utama untuk:
- melihat identitas akun
- mengubah nama
- melihat email akun
- melihat metode login
- melihat plan aktif
- mengubah bahasa
- memulai flow ganti kata sandi
- logout
- mengakses danger zone

## Profile Modal Content
### 1. Header
- title: `Profil`
- subtitle singkat: `Kelola informasi akun dan preferensi utama Anda`

### 2. Identity Section
Menampilkan:
- avatar/inisial
- nama
- email

Field editable:
- `Nama`

Field read-only:
- `Email`
- `Metode masuk`
  - contoh: `Google`
  - contoh: `Email & Password`
- `Paket`
  - contoh: `Free`
  - contoh: `Plus`

### 3. Preferences Section
Isi:
- `Bahasa`
- link kecil ke `Syarat & Ketentuan`
- link kecil ke `Kebijakan Privasi`

### 4. Security Section
Isi:
- label: `Kata Sandi`
- helper copy:
  - untuk akun email/password:
    - `Ubah kata sandi lewat email agar prosesnya lebih aman.`
  - untuk akun Google-only:
    - `Buat kata sandi jika Anda ingin juga bisa masuk memakai email dan kata sandi.`
- tombol utama:
  - `Ganti Kata Sandi`
  - atau untuk Google-only: `Buat Kata Sandi`

### 5. Security Action Confirmation
Saat user klik tombol kata sandi:
- jangan langsung pindah halaman
- tampilkan inline confirmation state atau card kecil di modal

Copy:
- `Kami akan mengirim link aman ke email akun Anda untuk mengatur ulang kata sandi.`
- tampilkan email tujuan secara jelas

Action:
- tombol `Kirim Link Reset`
- tombol sekunder `Batal`

### 6. Danger Zone
Untuk sekarang tetap ada di modal profile:
- `Hapus Akun`

Catatan:
- tampilannya tetap dipisah visual sebagai section terakhir
- tidak perlu diperkaya dulu sampai flow delete benar-benar siap

## Password Reset Flow
### Entry Point
User membuka:
- `Sidebar > Profile > Ganti Kata Sandi`

### Step 1: Send Reset Link
Saat klik `Kirim Link Reset`:
- app memanggil reset password email flow Supabase
- gunakan email user yang sedang login
- tampilkan feedback sukses yang jelas

Success copy:
- `Link ganti kata sandi sudah dikirim ke email Anda.`
- `Buka email Anda lalu lanjutkan dari sana.`

Failure copy:
- `Kami belum berhasil mengirim email reset. Coba lagi sebentar lagi.`

### Step 2: Email Link
User menerima email reset dari Paapan.

Link dari email mengarah ke:
- `/reset-password`

### Step 3: Reset Password Page
Halaman reset password harus memakai bahasa visual auth pages:
- background gradient yang sama dengan login/register
- auth shell yang sama
- form sederhana dan fokus

Isi page:
- title: `Buat Kata Sandi Baru`
- subtitle yang lebih jelas, misalnya:
  - `Masukkan kata sandi baru untuk akun Paapan Anda`
- field:
  - `Kata Sandi Baru`
  - `Konfirmasi Kata Sandi Baru`
- CTA:
  - `Simpan Kata Sandi Baru`

Success state:
- title: `Kata sandi berhasil diperbarui`
- body: `Sekarang Anda bisa masuk kembali ke Paapan dengan kata sandi baru.`
- CTA: `Lanjut ke Login`

### Expected Behavior
- reset password tidak lagi dilakukan dari modal settings
- update password dari session inline di settings dihapus untuk semua user
- flow email reset menjadi satu-satunya cara ganti password dari area profile

## UX Copy Principles
- hindari copy yang terlalu teknis
- tonenya tenang, aman, dan meyakinkan
- hindari alert browser default
- semua feedback gunakan inline status atau toast ringan

## Visual Principles
- profile modal tetap mengikuti modal language Paapan sekarang
- auth reset page mengikuti login/register shell
- tidak ada form password padat di modal profile
- section `Security` harus terasa jelas tapi tidak menakutkan

## Non-Goals
Belum termasuk pada versi ini:
- ubah email akun
- avatar upload
- notifikasi email preferences
- multi-factor authentication
- pemisahan halaman account penuh di luar modal

## Implementation Notes
### Files likely affected
- `components/ui/ProfileModal.tsx`
- `components/ui/SettingsModal.tsx`
- `components/ui/Sidebar.tsx`
- `app/reset-password/page.tsx`
- helper auth/reset flow yang terkait

### Expected structural changes
- `SettingsModal` kemungkinan dihapus atau tidak lagi dipakai dari sidebar
- `ProfileModal` diperluas menjadi account hub
- reset password page dipoles secara visual dan copy
- profile modal perlu bisa memanggil reset email untuk current user

## Rollout Recommendation
### Phase 1
- pindahkan konten settings yang relevan ke profile
- hapus item sidebar `Settings`
- ganti password inline dihapus

### Phase 2
- tambahkan flow `Kirim Link Reset`
- poles `reset-password` page

### Phase 3
- polish copy dan states
- bersihkan code lama settings jika sudah tidak dipakai

## Acceptance Criteria
- user tidak lagi melihat form ubah password inline di modal settings
- sidebar user login tidak lagi menampilkan item `Settings`
- profile modal memuat nama, email, metode login, plan, bahasa, dan aksi account utama
- user bisa memicu email reset dari profile modal
- reset password page tampil konsisten dengan login/register
- semua feedback sukses/gagal tampil jelas tanpa browser alert default
