# Public Beta Soft Launch Runbook

Last updated: 2026-07-09

## Tujuan

Runbook ini dipakai untuk membuka Paapan ke publik secara bertahap tanpa langsung scale besar. Targetnya bukan "launch heboh", tetapi validasi user nyata, biaya AI, feedback, dan stabilitas production.

## Status Saat Ini

Paapan siap untuk **Public Open Beta terbatas**.

Belum direkomendasikan untuk:

- paid launch penuh;
- iklan besar-besaran;
- klaim AI unlimited;
- membuka Pro/web search ke banyak user tanpa monitoring biaya.

## Mode Release

| Area | Keputusan |
|---|---|
| Release mode | Open Beta |
| Payment | Belum checkout otomatis |
| Paid access | Manual via WhatsApp/email |
| Target awal | 20-50 user publik pertama |
| Scale berikutnya | Naik bertahap setelah 24-72 jam stabil |

## Yang Sudah Siap

Status ini berdasarkan kombinasi verifikasi repo, lint/build, dan laporan test production dari owner.

| Area | Status | Catatan |
|---|---|---|
| Production deploy | Ready | Production sudah jalan dan owner sudah test. |
| Env Vercel | Ready by owner | Env production sudah diisi di Vercel. |
| SQL migration | Ready by owner | Migration penting sudah dijalankan. |
| Cron | Ready | `vercel.json` sudah menjadwalkan `/api/internal/account/finalize-deletions`. |
| Feedback | Ready by owner | Feedback form berhasil dites. |
| AI credit | Ready by owner | Flash Lite, Flash, Pro, response panjang, connected node sudah dites. |
| Admin | Ready by owner | Admin login dan page admin berhasil dites. |
| Share board | Ready by owner | Share board berhasil dites. |
| Build | Ready | `npm run build` sebelumnya pass. |
| Lint | Ready | `npm run lint` pass pada 2026-07-09. |

## Soft Launch 72 Jam

### Jam 0-6

- Buka ke circle kecil: 5-10 orang yang mudah dihubungi.
- Minta mereka mencoba 3 hal:
  - buat board;
  - generate AI;
  - share board.
- Pantau:
  - Vercel logs;
  - Supabase auth/users;
  - feedback masuk;
  - AI error;
  - credit berkurang wajar.

### Jam 6-24

- Naikkan ke 20-50 user.
- Jangan boost iklan dulu.
- Catat pertanyaan yang berulang.
- Jika ada error AI atau save/share, tahan promosi.
- Jika lancar, mulai posting 1 konten founder journey atau demo singkat.

### Jam 24-72

- Buka ke 50-150 user total jika error rate rendah.
- Mulai kumpulkan testimoni ringan.
- Prioritaskan 3 metrik:
  - berapa user berhasil membuat board;
  - berapa user memakai AI;
  - berapa user kembali / membuat board kedua.

## Monitoring Harian Minggu Pertama

| Metrik | Target aman |
|---|---:|
| AI error rate | <2-5% |
| Feedback critical bug | 0 blocker |
| Vercel function error | tidak berulang di route utama |
| Supabase storage | <70% free quota |
| Supabase DB size | <70% free quota |
| Email auth/reset issue | tidak memblokir login/reset |
| AI cost harian | tetap di bawah budget internal |
| Credit deduction | sesuai ekspektasi model |

## Stop / Pause Criteria

Tahan promosi jika salah satu terjadi:

- user tidak bisa login/register;
- board tidak tersimpan;
- AI generate sering gagal;
- credit terpotong tidak sesuai;
- share board membuka data yang tidak seharusnya;
- admin/feedback tidak bisa dipakai untuk support;
- biaya AI harian naik tidak wajar.

## Pesan Public Beta yang Aman

Gunakan wording seperti:

> Paapan sedang Open Beta. Kamu bisa mencoba papan visual dengan AI untuk merangkum, menyusun ide, dan menghubungkan catatan. Beberapa fitur masih disiapkan bertahap, jadi feedback sangat membantu.

Hindari wording:

- "AI unlimited";
- "semua fitur final";
- "payment otomatis sudah aktif";
- "cocok untuk semua kebutuhan";
- "data selalu 100% private" tanpa penjelasan vendor/BYOK.

## Checklist Sebelum Share Link Publik

- [x] Production deploy aktif
- [x] Env production sudah diisi by owner
- [x] SQL migration sudah dijalankan by owner
- [x] Cron Vercel aktif di `vercel.json`
- [x] Feedback sudah dites by owner
- [x] AI credit utama sudah dites by owner
- [x] Admin login sudah dites by owner
- [x] Share board sudah dites by owner
- [x] `npm run lint` pass
- [x] Jalankan `npm run build` final setelah update docs
- [ ] Commit/push docs readiness terbaru

## Next Action Setelah Launch

1. Pantau 24 jam pertama.
2. Kumpulkan 10 feedback user nyata.
3. Buat daftar 5 friction paling sering.
4. Tentukan apakah perlu fix cepat sebelum user batch berikutnya.
5. Setelah stabil, naikkan exposure bertahap lewat konten demo dan founder journey.
