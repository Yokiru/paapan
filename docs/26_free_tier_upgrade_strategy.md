# Strategi Free Tier dan Trigger Upgrade Paapan

> Versi: 2026-07-09
> Tujuan: memanfaatkan free tier sampai batas sehat, lalu upgrade hanya saat perlu.
> Prinsip: hemat boleh, tapi jangan mengorbankan login, data user, deliverability email, atau privasi prompt AI.

Dokumen ini melengkapi:

- `docs/25_indonesia_12_month_business_simulation.md`
- `docs/08_email_plan.md`
- `docs/19_env_route_mapping.md`

## 1. Ringkasan Keputusan

Strategi paling hemat yang masih aman:

1. Supabase tetap Free selama DB, storage, egress, auth MAU, dan reliability masih aman.
2. Jangan pakai email bawaan Supabase untuk public beta/production. Pakai custom SMTP sejak user publik mulai daftar.
3. Untuk outbound email awal, pakai Resend Free atau Cloudflare Email Service sesuai kebutuhan teknis.
4. Untuk inbound email, Cloudflare Email Routing bisa jadi opsi nol biaya; Zoho tetap lebih nyaman jika butuh mailbox manusia yang rapi.
5. Gemini Free boleh untuk internal testing, demo, dan QA. Untuk user production, pakai paid Gemini atau BYOK karena aspek privasi dan batas produksi.
6. Vercel Hobby hanya cocok untuk non-commercial/open beta kecil. Saat payment/komersial aktif, rencanakan Vercel Pro.

## 2. Sumber Resmi yang Dicek

| Area | Sumber |
|---|---|
| Supabase billing/quota | https://supabase.com/docs/guides/platform/billing-on-supabase |
| Supabase Auth custom SMTP | https://supabase.com/docs/guides/auth/auth-smtp |
| Supabase Auth rate limits | https://supabase.com/docs/guides/auth/rate-limits |
| Gemini API pricing | https://ai.google.dev/gemini-api/docs/pricing |
| Vercel pricing | https://vercel.com/docs/pricing |
| Resend pricing | https://resend.com/pricing |
| Cloudflare Email Service pricing | https://developers.cloudflare.com/email-service/platform/pricing/ |
| Cloudflare Email Service limits | https://developers.cloudflare.com/email-service/platform/limits/ |

## 3. Free Tier yang Bisa Dimanfaatkan

### Supabase Free

Quota penting dari dokumen Supabase:

| Resource | Free quota | Trigger perhatian |
|---|---:|---|
| Projects | 2 free projects | Jangan boros project untuk staging yang tidak perlu. |
| Egress | 5 GB/bln | Warning di 4 GB. |
| Database size | 500 MB/project | Warning di 350-400 MB. |
| Monthly Active Users | 50.000 MAU | Aman untuk tahun pertama simulasi realistis. |
| Storage size | 1 GB | Warning di 700-800 MB. |
| Edge Function invocations | 500.000/bln | Saat server logic pindah ke Edge Functions. |
| Realtime messages | 2 juta/bln | Relevan nanti kalau collaboration realtime aktif. |
| Realtime peak connections | 200 | Relevan nanti kalau live collaboration aktif. |

Saran penggunaan:

- Tetap di Supabase Free selama paid user masih kecil, storage gambar terkontrol, dan tidak butuh reliability premium.
- Upgrade ke Supabase Pro jika salah satu limit mendekati 80%, atau ketika produk sudah paid public dan downtime/pausing tidak bisa ditoleransi.
- Jangan upload gambar besar tanpa kompresi karena storage 1 GB adalah limit yang paling mungkin lebih cepat kena.

Trigger upgrade Supabase Pro:

| Trigger | Kenapa |
|---|---|
| DB > 400 MB | Sudah dekat 500 MB Free. |
| Storage > 800 MB | Sudah dekat 1 GB Free. |
| Egress > 4 GB/bln | Sudah dekat 5 GB Free. |
| Realtime peak > 150 koneksi | Dekat limit 200. |
| Paid users > 100 dan data user mulai penting | Reliability lebih penting daripada hemat Rp495 ribu. |
| Butuh backup/recovery/operasi lebih serius | Free tier bukan tempat long-term production yang kritis. |

### Supabase Auth Email

Jangan mengandalkan email bawaan Supabase untuk public beta/production.

Alasannya dari docs Supabase:

- default SMTP Supabase bukan untuk production;
- tanpa custom SMTP, email hanya dikirim ke alamat yang ada di team project;
- limit default saat ini sekitar 2 email/jam;
- Supabase menyarankan custom SMTP untuk use case production.

Keputusan:

| Tahap | Email auth |
|---|---|
| Local/dev | Boleh pakai Supabase default email untuk akun team saja. |
| Closed beta dengan user luar | Wajib custom SMTP. |
| Public beta/production | Wajib custom SMTP + rate limit + cooldown. |

### Resend Free

Quota Resend Free dari pricing page:

| Resource | Free quota |
|---|---:|
| Email per bulan | 3.000 |
| Daily limit | 100/hari |
| Custom domain | 1 |
| Data retention | 30 hari |
| Inbound emails | Ada di fitur sending/receiving |

Saran:

- Cocok untuk auth email awal: signup confirmation, reset password, invite kecil.
- Matikan welcome email dan broadcast sampai kita yakin kuota cukup.
- Upgrade ke Resend Pro ketika beberapa hari berturut-turut mendekati 80 email/hari, atau signup spike membuat verifikasi gagal.

Estimasi kapasitas Resend Free:

| Aktivitas | Konsumsi email |
|---|---:|
| 1 signup email/password | 1 email |
| Reset password | 1 email |
| Security notification | 1 email |
| Welcome email | 1 email tambahan, sebaiknya off dulu |

Dengan 3.000 email/bln dan 100/hari, batas aman operasional adalah sekitar:

- 70 signup/hari jika reset/security masih ada;
- 2.100 signup/bln jika ingin buffer reset/support;
- 3.000 signup/bln hanya jika hampir tidak ada email lain.

### Cloudflare Email Service

Cloudflare Email Service bisa dipakai sebagai opsi hemat:

| Fungsi | Free/Paid |
|---|---|
| Inbound Email Routing | Unlimited di Workers Free dan Paid |
| Outbound ke verified destination address | Free dan tidak masuk quota |
| Outbound ke arbitrary recipients | Butuh Workers Paid |
| Workers Paid outbound quota | 3.000 email/bln termasuk, lalu $0.35/1.000 |

Kapan Cloudflare lebih cocok:

- Inbound support sederhana: `hello@`, `support@` forward ke Gmail/Zoho pribadi.
- Feedback notification ke alamat internal yang sudah verified.
- Alternatif hemat jika belum butuh UI mailbox seperti Zoho.

Kapan Resend lebih cocok:

- Auth email dan transactional email ke semua user.
- Butuh SDK/email logs yang lebih nyaman.
- Butuh deliverability produk email yang memang fokus.

### Vercel

Vercel Hobby punya kuota gratis yang cukup besar untuk eksperimen, tetapi untuk bisnis/paid product kita harus hati-hati dengan aturan plan.

Quota yang relevan dari docs Vercel:

| Resource Hobby | Included |
|---|---:|
| Function invocations | 1 juta/bln |
| Active CPU | 4 jam |
| Provisioned memory | 360 GB-hours |
| Image transformations | 5.000/bln |
| Web Analytics events | 50.000/bln |
| Speed Insights events | 10.000/bln |

Keputusan praktis:

- Open beta non-commercial kecil: Hobby bisa dipakai.
- Saat payment aktif/komersial: rencanakan Vercel Pro sekitar $20/bln.
- Jangan tunggu sampai app down karena limit jika sudah ada user bayar.

### Gemini AI

Gemini API menyediakan Free dan Paid tier. Dari pricing page:

- Free tier punya input/output free untuk model tertentu, tetapi konten dapat digunakan untuk meningkatkan produk Google.
- Paid tier punya limit lebih tinggi untuk production dan konten tidak digunakan untuk improvement.
- Google Search grounding punya free allowance tertentu, lalu berbayar.
- URL context free sebagai tool, tetapi token URL tetap dihitung sebagai input tokens sesuai model.

Keputusan:

| Tahap | Gemini strategy |
|---|---|
| Local/dev/internal QA | Boleh pakai Gemini Free. |
| Public user production | Pakai paid Gemini atau BYOK. |
| Heavy users | Dorong API Pro/BYOK. |
| Web search | Batasi ketat, karena setelah free allowance biayanya bisa besar. |

Catatan penting:

- Jangan memakai Gemini Free untuk prompt user yang sensitif.
- Jangan menjual AI production berbasis free tier tanpa memahami konsekuensi data/privacy dan limit.
- BYOK adalah cara terbaik menghemat AI cost tanpa menurunkan fairness.

## 4. Strategi Operasional Hemat per Fase

### Fase 0 - Dev dan QA internal

Target biaya: hampir Rp0/bln di luar domain.

| Area | Pilihan |
|---|---|
| Hosting | Vercel preview/Hobby |
| DB | Supabase Free |
| Auth email | Supabase default hanya untuk akun team |
| App email | Tidak perlu aktif |
| AI | Gemini Free untuk internal, BYOK untuk test berat |
| Inbound email | Cloudflare Email Routing atau email pribadi |

Upgrade belum perlu.

### Fase 1 - Closed beta publik kecil

Target biaya: Rp21.000-Rp100.000/bln, tergantung domain/email.

| Area | Pilihan |
|---|---|
| Hosting | Vercel Hobby jika belum komersial |
| DB | Supabase Free |
| Auth email | Resend Free custom SMTP |
| Feedback email | Zoho SMTP yang sudah ada atau Cloudflare ke verified address |
| AI | Paid Gemini kecil atau BYOK; Free hanya untuk internal |
| Inbound email | Cloudflare Email Routing free atau Zoho mailbox |

Trigger upgrade:

- email >80/hari;
- storage >700 MB;
- AI cost >Rp50.000/hari;
- mulai ada user bayar.

### Fase 2 - Paid beta awal

Target biaya hemat: sekitar Rp467.000/bln + AI + marketing.

| Area | Pilihan |
|---|---|
| Hosting | Vercel Pro |
| DB | Supabase Free selama masih di bawah 80% quota |
| Auth email | Resend Free jika <80 email/hari |
| Inbound email | Cloudflare Email Routing free atau Zoho |
| AI | Paid Gemini + BYOK untuk heavy user |
| Payment | QRIS/e-wallet, hindari fixed fee mahal |

Biaya tetap hemat:

| Item | Estimasi |
|---|---:|
| Vercel Pro | Rp396.000 |
| Supabase Free | Rp0 |
| Resend Free | Rp0 |
| Domain prorata | Rp21.000 |
| Email/inbox/misc buffer | Rp50.000 |
| Total | Rp467.000/bln |

### Fase 3 - Production lebih serius

Target biaya: sekitar Rp962.000-Rp1.061.000/bln + AI + marketing.

| Area | Pilihan |
|---|---|
| Hosting | Vercel Pro |
| DB | Supabase Pro |
| Auth email | Resend Free/Pro sesuai volume |
| Optional email sending | Cloudflare Workers Paid jika dipakai |
| AI | Paid Gemini + BYOK |

Biaya tetap setelah Supabase upgrade:

| Item | Estimasi |
|---|---:|
| Vercel Pro | Rp396.000 |
| Supabase Pro | Rp495.000 |
| Resend Free | Rp0 |
| Domain prorata | Rp21.000 |
| Misc buffer | Rp50.000 |
| Total | Rp962.000/bln |

Jika memakai Cloudflare Workers Paid untuk outbound email, tambah sekitar $5/bln atau sekitar Rp99.000 dengan kurs planning Rp19.800/USD.

## 5. Dampak ke Simulasi 12 Bulan

Simulasi sebelumnya memakai infra dasar Rp1.100.000/bln. Jika free tier dimanfaatkan:

- Bulan 1-9: infra bisa ditekan ke sekitar Rp467.000/bln.
- Bulan 10-12: asumsi mulai upgrade Supabase Pro, infra sekitar Rp962.000/bln.

Efek ke net income:

| Bulan | Revenue | Total cost lama | Total cost hemat | Net hemat |
|---|---:|---:|---:|---:|
| Jul 2026 | Rp136.000 | Rp1.861.590 | Rp1.228.590 | -Rp1.092.590 |
| Aug 2026 | Rp351.000 | Rp1.890.815 | Rp1.257.815 | -Rp906.815 |
| Sep 2026 | Rp702.000 | Rp1.929.940 | Rp1.296.940 | -Rp594.940 |
| Oct 2026 | Rp1.160.000 | Rp2.377.600 | Rp1.744.600 | -Rp584.600 |
| Nov 2026 | Rp1.784.000 | Rp2.451.540 | Rp1.818.540 | -Rp34.540 |
| Dec 2026 | Rp2.651.000 | Rp2.542.095 | Rp1.909.095 | Rp741.905 |
| Jan 2027 | Rp3.862.000 | Rp3.291.620 | Rp2.658.620 | Rp1.203.380 |
| Feb 2027 | Rp5.502.000 | Rp3.480.290 | Rp2.847.290 | Rp2.654.710 |
| Mar 2027 | Rp7.357.000 | Rp3.699.225 | Rp3.066.225 | Rp4.290.775 |
| Apr 2027 | Rp9.427.000 | Rp3.948.425 | Rp3.810.425 | Rp5.616.575 |
| May 2027 | Rp12.034.000 | Rp4.254.470 | Rp4.116.470 | Rp7.917.530 |
| Jun 2027 | Rp14.856.000 | Rp4.590.780 | Rp4.452.780 | Rp10.403.220 |

Kesimpulan:

- Break-even bergeser dari sekitar bulan 6 menjadi sekitar bulan 5-6.
- Hemat terbesar datang dari menunda Supabase Pro selama quota Free masih cukup.
- Tapi jangan menghemat di email auth jika user publik sudah daftar, karena login/reset adalah core trust.

## 6. Upgrade Decision Matrix

| Layanan | Tetap free jika | Upgrade jika |
|---|---|---|
| Supabase | DB <400 MB, storage <800 MB, egress <4 GB, MAU jauh <50k | mendekati 80% quota, paid users >100, butuh reliability lebih baik |
| Supabase built-in email | hanya test akun team | selalu upgrade ke custom SMTP untuk user publik |
| Resend | <80 email/hari dan <2.400 email/bln | mendekati 100/hari, butuh no daily limit, butuh lebih banyak domain |
| Cloudflare Email Routing | inbound/forwarding sederhana | butuh mailbox UI, search, human support workflow |
| Cloudflare Email Sending | kirim ke verified address internal saja | butuh kirim ke arbitrary recipients lewat Cloudflare, berarti Workers Paid |
| Vercel | non-commercial beta kecil | payment/komersial aktif, traffic penting, butuh support/scale |
| Gemini Free | internal/dev/test | prompt user production, butuh privacy, higher limits, model/tool production |

## 7. Implementasi Praktis yang Disarankan

Urutan paling hemat dan aman:

1. Tetap pakai Supabase Free sampai storage/DB mendekati 80% atau paid users >100.
2. Untuk auth email, jangan tunggu: pasang custom SMTP sebelum user publik email/password.
3. Jika ingin nol biaya email dulu, gunakan Resend Free dan matikan welcome/broadcast.
4. Gunakan Cloudflare Email Routing untuk inbound `hello@` dan `support@` jika ingin menghindari biaya mailbox awal.
5. Pertahankan Zoho jika kamu nyaman dengan inbox manusia dan SMTP feedback yang sudah berjalan.
6. Pakai paid Gemini untuk production user, tetapi dorong BYOK/API Pro untuk heavy users.
7. Buat admin metric mingguan:
   - Supabase DB size;
   - Supabase storage size;
   - Supabase egress;
   - Supabase MAU;
   - email sent/day;
   - email sent/month;
   - AI cost/day;
   - AI cost/user/month.

## 8. Keputusan Final Saat Ini

Untuk Paapan sekarang:

- Supabase Pro belum wajib jika usage nyata masih kecil dan belum ada kebutuhan reliability premium.
- Custom SMTP tetap wajib untuk user publik, karena Supabase default email bukan production.
- Resend Free cukup untuk beta realistis jika hanya auth/reset dan tidak ada broadcast.
- Cloudflare Email Routing layak dipakai untuk inbound gratis.
- Vercel Pro sebaiknya aktif saat monetisasi/payment aktif.
- Gemini Free jangan dijadikan basis production; gunakan paid key + BYOK.
