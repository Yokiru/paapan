# Email Plan

> Status: Planned  
> Priority: High  
> Target: After domain purchase  
> Owner: Paapan admin

## Ringkasan

Rencana email Paapan akan memakai dua layanan yang dibagi jelas:

- Zoho Mail untuk inbox manusia dan menerima email domain
- Resend untuk mengirim email aplikasi dan email transaksional

Keputusan ini dipilih supaya:

- inbox tim tetap murah dan rapi
- email aplikasi punya deliverability yang lebih baik
- risiko reputasi domain lebih terkontrol
- setup awal tetap sederhana untuk public test dan early growth

## Keputusan Utama

### 1. Inbound email

Gunakan Zoho Mail untuk:

- `hello@<domain>`
- `support@<domain>`
- `founder@<domain>` atau email pribadi kerja

Fungsi:

- menerima pertanyaan user
- menerima balasan dari partner
- komunikasi manusia ke manusia

### 2. Outbound app email

Gunakan Resend untuk:

- `noreply@send.<domain>`
- `auth@send.<domain>`
- `updates@send.<domain>`

Fungsi:

- verifikasi email
- reset password
- welcome email
- notifikasi produk
- email sistem lain

### 3. Struktur domain yang direkomendasikan

- domain utama: `<domain>`
- subdomain pengirim app: `send.<domain>`

Kenapa subdomain:

- reputasi email aplikasi terpisah dari inbox manusia
- DNS lebih rapi
- kalau suatu hari deliverability email app terganggu, mailbox utama tidak terlalu ikut terdampak

## Arsitektur yang Direkomendasikan

```text
Human inbox
  hello@<domain>        -> Zoho Mail
  support@<domain>      -> Zoho Mail
  founder@<domain>      -> Zoho Mail

App sending
  noreply@send.<domain> -> Resend
  auth@send.<domain>    -> Resend
  updates@send.<domain> -> Resend
```

## Kapan Email Dipakai

### Zoho Mail

Dipakai untuk:

- membaca email masuk
- membalas email user
- support manual
- kontak partner atau investor

Tidak dipakai untuk:

- verifikasi akun otomatis
- reset password otomatis
- email blast sistem

### Resend

Dipakai untuk:

- semua email yang dikirim dari aplikasi
- email otomatis dari server
- email yang butuh template HTML
- email auth dan notifikasi

Tidak dipakai untuk:

- inbox tim
- membaca email masuk manusia

## Alamat Email yang Disarankan

### Tahap awal

- `hello@<domain>` -> kontak umum
- `support@<domain>` -> bantuan user
- `noreply@send.<domain>` -> email default aplikasi
- `auth@send.<domain>` -> verifikasi dan reset password

### Setelah growth mulai naik

- `billing@<domain>` -> urusan pembayaran
- `updates@send.<domain>` -> product updates
- `security@<domain>` -> pelaporan keamanan

## Alur Email Paapan

### 1. Verifikasi email

```text
User register
-> server membuat token/verifikasi
-> Resend kirim email dari auth@send.<domain>
-> user klik link
-> akun tervalidasi
```

### 2. Reset password

```text
User klik lupa password
-> server buat reset link
-> Resend kirim email dari auth@send.<domain>
-> user klik link
-> user ganti password
```

### 3. Welcome email

```text
User berhasil verifikasi
-> server kirim welcome email
-> Resend kirim dari noreply@send.<domain> atau updates@send.<domain>
```

### 4. Support

```text
User kirim email ke support@<domain>
-> email masuk ke Zoho Mail
-> tim balas dari inbox Zoho
```

## Kebijakan Beta

Pada tahap beta, email akan diperlakukan sebagai fitur penting tetapi tetap dijaga ketat supaya kuota gratis tidak cepat habis dan sistem tidak mudah disalahgunakan.

### Email yang benar-benar aktif saat beta

- verifikasi email saat daftar dengan email dan password
- reset password

### Email yang tidak wajib diaktifkan dulu

- welcome email
- product update email
- notifikasi promosi
- email broadcast lain

### Aturan beta yang direkomendasikan

#### 1. Signup tetap dibuka, tapi dibatasi

- rate limit per IP
- rate limit per email
- tahan retry berulang dalam waktu singkat

Tujuan:

- mengurangi signup abuse
- menjaga kuota email
- tetap memberi ruang untuk pendaftaran user nyata

#### 2. Reset password diberi cooldown

Rekomendasi awal:

- `1 kali per akun per 24 jam`

Alternatif yang masih aman:

- `maks 3 kali per 24 jam`

Tujuan:

- mencegah abuse reset email
- menjaga kuota harian
- mengurangi spam ke inbox user

#### 3. Prioritaskan email kritis

Jika suatu hari kuota email mendekati batas:

- tetap prioritaskan verifikasi akun
- reset password tetap prioritas tinggi
- email non-kritis ditunda atau dimatikan dulu

#### 4. Queue belum wajib

Untuk beta awal:

- verifikasi email dan reset password sebaiknya dikirim langsung
- belum perlu queue kompleks

Queue baru masuk akal nanti untuk:

- welcome email
- digest
- update produk
- blast non-kritis

### Batas praktis Resend Free untuk beta

Asumsi resmi:

- `3.000 email / bulan`
- `100 email / hari`

Implikasinya:

- kalau dalam satu hari ada lebih dari 100 email verifikasi/reset yang harus dikirim, free tier bisa mentok
- untuk beta kecil ini masih realistis
- kalau mulai sering mepet limit, upgrade ke Pro lebih sehat daripada memaksa workaround aneh

### Trigger upgrade dari Resend Free ke Pro

Naik ke Resend Pro direkomendasikan jika salah satu kondisi ini mulai terjadi:

- beberapa hari sudah mendekati `100 email / hari`
- signup harian mulai padat dan email verifikasi jadi bottleneck
- reset password makin sering dipakai
- beta mulai dibuka lebih luas ke publik
- kita sudah mulai mengaktifkan welcome email atau notifikasi tambahan

### Sikap operasional yang direkomendasikan

- gunakan `Resend Free` untuk development dan beta kecil
- monitor penggunaan harian secara manual
- begitu email auth mulai terasa penting untuk flow produk, pindah ke `Resend Pro`

Kesimpulan tahap beta:

- tidak perlu queue berat dulu
- lebih penting punya rate limit signup
- lebih penting punya cooldown reset password
- dan siap upgrade cepat ke Pro kalau volume nyata mulai naik

## DNS Plan

Catatan:

- nilai record final tetap mengikuti dashboard Zoho dan Resend saat setup nyata
- jangan menebak nilai MX/SPF/DKIM manual kalau dashboard provider sudah memberi record resmi

### A. DNS untuk Zoho Mail

Yang biasanya perlu disiapkan:

- `MX` untuk domain utama
- `TXT` SPF untuk domain utama
- `CNAME` atau `TXT` verifikasi domain
- `DKIM` jika Zoho memintanya

Tujuan:

- email ke `@<domain>` masuk ke Zoho
- domain utama punya identitas email yang valid

### B. DNS untuk Resend

Yang biasanya perlu disiapkan:

- verifikasi domain atau subdomain `send.<domain>`
- `TXT` SPF
- `DKIM`
- opsional `DMARC`

Tujuan:

- Resend boleh mengirim email atas nama `send.<domain>`
- deliverability lebih baik
- email transaksional tidak gampang masuk spam

### C. DMARC yang direkomendasikan

Tahap awal:

- mulai dari policy lunak untuk observasi

Contoh strategi:

1. awal: `p=none`
2. setelah semua lolos dan stabil: `p=quarantine`
3. nanti kalau sudah matang: `p=reject`

Jangan langsung agresif kalau belum yakin semua sender valid.

## DNS Checklist Saat Domain Sudah Dibeli

1. Putuskan registrar/domain provider
2. Tentukan domain utama, misalnya `paapan.com`
3. Siapkan subdomain pengirim, misalnya `send.paapan.com`
4. Aktifkan Zoho Mail untuk domain utama
5. Tambahkan semua record Zoho sampai status verified
6. Buat mailbox manusia:
   - `hello@`
   - `support@`
   - `founder@` atau yang dibutuhkan
7. Aktifkan Resend untuk `send.<domain>`
8. Tambahkan record Resend sampai verified
9. Uji kirim email dari Resend ke Gmail dan Outlook
10. Uji email masuk ke Zoho dari Gmail
11. Tambahkan DMARC
12. Simpan screenshot atau catatan final DNS

## Rencana Implementasi di App

### Phase 1: Foundation

- beli domain
- setup Zoho Mail
- setup Resend
- verifikasi DNS dua layanan
- tentukan alamat email final

### Phase 2: App integration

- install SDK Resend
- buat helper `sendTransactionalEmail()`
- buat template dasar:
  - verification
  - reset password
  - welcome
- sambungkan ke flow auth

### Phase 3: Operations

- uji deliverability
- uji bounce dan spam
- tambah footer legal
- tambah reply-to jika perlu
- pasang monitor kuota email harian
- pasang cooldown reset password
- pasang rate limit signup email/password

## Struktur Kode yang Direkomendasikan

Saat nanti dieksekusi, struktur yang disarankan:

```text
lib/email/
  resend.ts
  templates/
    verify-email.tsx
    reset-password.tsx
    welcome.tsx
  send.ts
```

### Prinsip implementasi

- semua email app dikirim lewat satu helper
- alamat pengirim jangan hardcode di banyak tempat
- subject dan template dipisah jelas
- jangan log token sensitif
- email kritis jangan tergantung queue panjang
- sediakan guard jika quota harian mepet

## Environment Variables yang Nanti Dibutuhkan

```env
RESEND_API_KEY=
EMAIL_FROM_APP=noreply@send.<domain>
EMAIL_FROM_AUTH=auth@send.<domain>
EMAIL_REPLY_TO=support@<domain>
SUPPORT_EMAIL=support@<domain>
HELLO_EMAIL=hello@<domain>
```

Opsional:

```env
EMAIL_DOMAIN=<domain>
EMAIL_SENDING_SUBDOMAIN=send.<domain>
```

## Risiko dan Cara Menghindarinya

### 1. Campur inbox dan app sending di domain yang sama

Risiko:

- reputasi email manusia dan email sistem bercampur

Solusi:

- pakai subdomain khusus untuk pengiriman app

### 2. SPF/DKIM salah

Risiko:

- email masuk spam
- verifikasi gagal

Solusi:

- ikuti record resmi dari dashboard provider
- cek lagi sebelum launch

### 3. DMARC terlalu agresif terlalu cepat

Risiko:

- email sah malah ditolak

Solusi:

- mulai dari `p=none`, naik bertahap

### 4. Satu alamat dipakai untuk semua fungsi

Risiko:

- sulit audit
- sulit debugging

Solusi:

- pisahkan `support`, `hello`, `auth`, `noreply`

## Keputusan yang Disarankan

Kalau domain sudah dibeli, saya sarankan keputusan final ini:

- Zoho Mail untuk inbox domain utama
- Resend untuk semua email aplikasi
- domain manusia di `@<domain>`
- pengirim aplikasi di `@send.<domain>`
- mulai dari 2 inbox manusia:
  - `hello@<domain>`
  - `support@<domain>`
- mulai dari 2 sender aplikasi:
  - `noreply@send.<domain>`
  - `auth@send.<domain>`

## Checklist Eksekusi Bersama

Saat kamu sudah beli domain, kita bisa eksekusi bersama urutan ini:

1. tentukan domain final
2. setup Zoho Mail
3. setup mailbox utama
4. setup Resend pada subdomain
5. isi env app
6. install SDK Resend
7. buat helper email
8. sambungkan verification dan reset password
9. uji email masuk dan keluar
10. pasang rate limit signup
11. pasang cooldown reset password
12. cek spam/deliverability

## Sumber Resmi

- Zoho Mail custom domain email: https://www.zoho.com/mail/custom-domain-email.html
- Zoho Mail admin subscription help: https://www.zoho.com/mail/help/adminconsole/subscription.html
- Resend pricing: https://resend.com/pricing
- Resend domains docs: https://resend.com/docs/dashboard/domains/introduction
