# Supabase Auth Email Templates

Template ini dibuat agar email auth Paapan terasa satu keluarga dengan website:
- tone biru lembut seperti halaman auth
- copy Bahasa Indonesia yang lebih ramah
- hierarki visual lebih jelas
- aman untuk mayoritas email client karena memakai table layout dan inline styles

## Dipakai untuk

1. `Confirm signup`
2. `Reset password`

## File sumber

- `emails/supabase/confirm-signup.html`
- `emails/supabase/reset-password.html`

## Cara pakai di Supabase

1. Buka `Supabase Dashboard`
2. Masuk ke `Authentication`
3. Buka `Email Templates`
4. Pilih template yang ingin diubah
5. Ganti `Subject`
6. Paste isi HTML dari file template yang sesuai
7. Simpan

## Subject yang disarankan

### Confirm signup

`Konfirmasi akun Paapan Anda`

### Reset password

`Atur ulang kata sandi Paapan`

## Variabel penting

Template ini memakai variabel default Supabase:

- `{{ .ConfirmationURL }}`
- `{{ .Email }}`

`{{ .ConfirmationURL }}` dipakai untuk tombol utama dan link cadangan.

## Catatan desain

- Email client lebih stabil dengan `PNG` daripada `SVG`, jadi template memakai logo PNG.
- Pastikan domain produksi yang dipakai publik memang sudah aktif:
  - `https://paapan.com`
- Jika nanti domain utama yang dipakai adalah `https://www.paapan.com`, ganti semua URL aset dan link brand ke domain final itu.

## Rekomendasi lanjutan

Kalau template ini sudah dipakai, langkah berikut yang bagus:

1. tambah template `Magic Link`
2. tambah template `Invite`
3. tambah fallback plain-text copy untuk dokumentasi internal
