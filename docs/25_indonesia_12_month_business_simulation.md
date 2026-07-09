# Simulasi Bisnis Paapan 12 Bulan - Pasar Indonesia

> Versi: 2026-07-09
> Horizon: Juli 2026 sampai Juni 2027
> Fokus: realistis untuk Open Beta menuju paid launch Indonesia
> Basis kurs model: Rp18.000/USD, dengan buffer operasional 10% menjadi Rp19.800/USD untuk biaya USD.

Dokumen ini adalah simulasi kerja, bukan janji hasil. Angka harus di-update tiap bulan dari data nyata: signup, activation, AI usage, conversion, churn, dan biaya token aktual.

## 1. Ringkasan Keputusan

Paapan masih aman secara margin jika pemakaian AI tetap dibatasi oleh credit system saat ini. Risiko terbesar bukan biaya hosting, tetapi:

- user Pro yang memakai model Pro untuk konteks panjang terus-menerus;
- fitur web search/URL scraping jika tidak diberi harga credit yang cukup;
- payment fee yang terlalu besar untuk transaksi kecil jika memakai metode seperti VA fixed fee;
- conversion Indonesia yang biasanya lambat jika belum ada bukti manfaat harian.

Rekomendasi utama:

1. Tetap buka Plus sebagai paket utama Indonesia: Rp29.000/bulan, 300 credit.
2. Pertahankan API Pro/BYOK: Rp49.000/bulan, karena hampir tidak punya biaya AI server.
3. Jangan promosikan Pro Rp79.000 terlalu murah sebagai "unlimited". Tulis jelas: 1.500 credit/bulan dan fair-use.
4. Naikkan biaya credit untuk web search menjadi minimal 15-20 credit jika nanti penggunaan besar.
5. Tambahkan budget cap internal AI per user dan per hari sebelum paid launch penuh.

## 2. Sistem Plan dan Credit Saat Ini

Sumber utama: `lib/creditCosts.ts` dan `lib/aiModels.ts`.

| Plan | Harga | Credit | Model | Limit produk utama | Catatan bisnis |
|---|---:|---:|---|---|---|
| Free | Rp0 | 5 credit/hari + 25 welcome bonus | Flash Lite | 3 workspace, 50 node/workspace, 5 image node | Cocok untuk akuisisi, tapi harus dipantau abuse. |
| Plus | Rp29.000/bln | 300 credit/bln + 50 bonus | Flash Lite + Flash | 10 workspace, 300 node/workspace, export, URL scraping | Paket utama untuk mahasiswa/kreator. |
| API Pro | Rp49.000/bln | 0 credit sistem | BYOK semua model | Workspace unlimited, cloud sync, export | Margin terbaik karena user bawa API key sendiri. |
| Pro | Rp79.000/bln | 1.500 credit/bln + 200 bonus | Flash Lite + Flash + Pro | Unlimited workspace/node, JSON export, support | Perlu guardrail karena akses model Pro. |

Credit action saat ini:

| Aksi | Credit | Model |
|---|---:|---|
| Chat simple | 1 | gemini-2.5-flash-lite |
| Chat standard | 3 | gemini-2.5-flash |
| Chat advanced | 10 | gemini-2.5-pro |
| Image analysis | 5 | gemini-2.5-flash |
| Long response surcharge | +1 / +2 / +4 | Berdasarkan panjang input + context |
| Web search | minimal 10 total credit | Risiko perlu dinaikkan jika search berbayar aktif |
| URL scrape tanpa web search | minimal 7 total credit | Aman jika fetch dan token context dibatasi |

## 3. Asumsi Harga API dan Infrastruktur

Sumber eksternal yang perlu dicek ulang saat launch:

- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Vercel pricing: https://vercel.com/pricing
- Supabase pricing: https://supabase.com/pricing
- Midtrans pricing: https://midtrans.com/pricing
- Free-tier upgrade strategy: `docs/26_free_tier_upgrade_strategy.md`

Asumsi kurs:

| Item | Nilai |
|---|---:|
| Kurs dasar model | Rp18.000/USD |
| Buffer kurs dan pajak/overhead USD | 10% |
| Kurs operasional untuk planning | Rp19.800/USD |

Biaya tetap bulanan yang dipakai dalam simulasi:

| Item | Asumsi | Biaya/bln |
|---|---|---:|
| Vercel | Pro sekitar $20/bln + buffer | Rp396.000 |
| Supabase | Pro sekitar $25/bln + buffer | Rp495.000 |
| Domain | Rp250.000/tahun dibagi 12 | Rp21.000 |
| Email/SMTP/misc infra | Buffer Zoho/logging/small tools | Rp88.000 |
| Total infra dasar | Dibulatkan | Rp1.100.000 |

Catatan hemat setelah riset free tier 2026:

- Jika Supabase Free masih cukup, infra paid beta awal bisa ditekan ke sekitar Rp467.000/bln: Vercel Pro + domain + misc kecil, Supabase Free, Resend Free.
- Jika Supabase mulai perlu Pro, infra naik ke sekitar Rp962.000/bln.
- Detail trigger upgrade ada di `docs/26_free_tier_upgrade_strategy.md`.

Biaya marketing:

| Fase | Bulan | Budget/bln | Alasan |
|---|---|---:|---|
| Validasi | 1-3 | Rp600.000 | Outreach creator, boost kecil, giveaway kecil. |
| Launch awal | 4-6 | Rp1.000.000 | Konten rutin + micro creator lebih konsisten. |
| Growth | 7-12 | Rp1.500.000 | Mulai scaling kanal yang terbukti. |

Biaya lain-lain:

| Fase | Biaya/bln | Isi |
|---|---:|---|
| Bulan 1-6 | Rp150.000 | Support, tools kecil, buffer refund. |
| Bulan 7-12 | Rp250.000 | Support naik, admin ops, konten/assets. |

Payment fee:

| Metode | Saran |
|---|---|
| QRIS/e-wallet | Cocok untuk harga Rp29.000-Rp79.000. |
| VA fixed fee | Hindari untuk paket murah jika fee fixed besar. |
| Model simulasi | 1,5% dari revenue. |

## 4. Asumsi Behavior Pasar Indonesia

Target awal:

- mahasiswa, pelajar, guru, content learner;
- creator edukasi dan produktivitas;
- solo worker yang butuh mind map, board, AI summary, dan export;
- developer/AI hobbyist untuk API Pro/BYOK.

Behavior realistis:

| Perilaku | Asumsi |
|---|---:|
| Signup dari konten/outreach awal | 120-360 user/bln di bulan 1-4 |
| Signup setelah konten terbukti | 480-1.800 user/bln di bulan 5-12 |
| Free monthly active dari total registered | sekitar 32% |
| Paid conversion awal | 3,0%-4,0% dari signup baru |
| Paid conversion setelah trust naik | 4,5%-5,5% dari signup baru |
| Churn Plus | 12%/bulan |
| Churn API Pro | 7%/bulan |
| Churn Pro | 9%/bulan |
| Mix paid awal | 70% Plus, 20% API Pro, 10% Pro |
| Mix paid setelah bulan 7 | 65% Plus, 20% API Pro, 15% Pro |

Catatan: conversion 8%-10% terlalu optimistis untuk Indonesia kecuali Paapan sudah punya kanal creator yang kuat, testimoni jelas, dan checkout sangat mudah.

## 5. Asumsi Biaya AI Per User

Biaya AI bukan dihitung dari jumlah klik saja. Node yang saling terhubung membuat teks sebelumnya masuk sebagai input context, jadi biaya input token tetap dibaca oleh AI.

Estimasi biaya API rata-rata:

| Segment | Usage realistis | Estimasi biaya AI/user/bln |
|---|---|---:|
| Free MAU | 10-15 simple request, sebagian context pendek | Rp130 |
| Plus | 300 credit tersedia, rata-rata 45%-55% terpakai | Rp1.450 |
| API Pro | Pakai API key sendiri | Rp0 |
| Pro | 1.500 credit tersedia, rata-rata 35%-45% terpakai, ada Pro model | Rp14.500 |

Stress test margin:

| Kasus | Dampak |
|---|---|
| Plus memakai semua 300 credit untuk Flash normal | Masih aman, biaya kira-kira beberapa ribu rupiah per user. |
| Pro memakai semua 1.500 credit untuk Pro model | Margin bisa turun tajam, tapi masih bisa aman jika prompt/context dibatasi. |
| Pro memakai context panjang terus-menerus | Risiko utama. Perlu surcharge berbasis token/context, bukan hanya panjang output. |
| Web search berbayar sering dipakai | Risiko kedua. Credit 10 bisa terlalu murah jika biaya grounding/search naik. |

## 6. Simulasi 12 Bulan - Skenario Realistis

Rumus ringkas:

- Revenue = Plus x Rp29.000 + API Pro x Rp49.000 + Pro x Rp79.000.
- Payment fee = 1,5% revenue.
- AI cost = Free MAU x Rp130 + Plus x Rp1.450 + Pro x Rp14.500.
- Total cost = payment fee + AI cost + infra + marketing + misc.
- Net = revenue - total cost.

| Bulan | Registered total | Free MAU | Plus | API Pro | Pro | Paid total | Revenue | AI cost | Total cost | Net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Jul 2026 | 120 | 40 | 3 | 1 | 0 | 4 | Rp136.000 | Rp9.550 | Rp1.861.590 | -Rp1.725.590 |
| Aug 2026 | 300 | 95 | 6 | 2 | 1 | 9 | Rp351.000 | Rp35.550 | Rp1.890.815 | -Rp1.539.815 |
| Sep 2026 | 560 | 177 | 12 | 4 | 2 | 18 | Rp702.000 | Rp69.410 | Rp1.929.940 | -Rp1.227.940 |
| Oct 2026 | 920 | 290 | 20 | 7 | 3 | 30 | Rp1.160.000 | Rp110.200 | Rp2.377.600 | -Rp1.217.600 |
| Nov 2026 | 1.400 | 441 | 31 | 10 | 5 | 46 | Rp1.784.000 | Rp174.780 | Rp2.451.540 | -Rp667.540 |
| Dec 2026 | 2.020 | 636 | 47 | 15 | 7 | 69 | Rp2.651.000 | Rp252.330 | Rp2.542.095 | Rp108.905 |
| Jan 2027 | 2.820 | 888 | 65 | 21 | 12 | 98 | Rp3.862.000 | Rp383.690 | Rp3.291.620 | Rp570.380 |
| Feb 2027 | 3.820 | 1.202 | 90 | 30 | 18 | 138 | Rp5.502.000 | Rp547.760 | Rp3.480.290 | Rp2.021.710 |
| Mar 2027 | 5.020 | 1.579 | 118 | 40 | 25 | 183 | Rp7.357.000 | Rp738.870 | Rp3.699.225 | Rp3.657.775 |
| Apr 2027 | 6.420 | 2.019 | 149 | 51 | 33 | 233 | Rp9.427.000 | Rp957.020 | Rp3.948.425 | Rp5.478.575 |
| May 2027 | 8.020 | 2.522 | 188 | 65 | 43 | 296 | Rp12.034.000 | Rp1.223.960 | Rp4.254.470 | Rp7.779.530 |
| Jun 2027 | 9.820 | 3.088 | 230 | 80 | 54 | 364 | Rp14.856.000 | Rp1.517.940 | Rp4.590.780 | Rp10.265.220 |

Kesimpulan dari skenario realistis:

| Metrik | Hasil |
|---|---:|
| Break-even bulanan | sekitar bulan 6 |
| Paid user akhir tahun | 364 |
| MRR akhir tahun | Rp14.856.000 |
| Net bulanan akhir tahun | Rp10.265.220 |
| AI cost terhadap revenue akhir tahun | sekitar 10,2% |
| Total cost terhadap revenue akhir tahun | sekitar 30,9% |

## 7. Skenario Sensitivitas

| Skenario | Kondisi | Bulan 12 MRR | Bulan 12 net | Catatan |
|---|---|---:|---:|---|
| Konservatif | Conversion 2%-3,5%, churn lebih tinggi, marketing organik lambat | Rp6-8 juta | Rp1-3 juta | Tetap hidup, tapi growth lambat. |
| Realistis | Angka tabel utama | Rp14,9 juta | Rp10,3 juta | Bisa jadi bisnis kecil yang sehat. |
| Agresif | 1-2 konten viral, conversion 6%-8%, churn turun | Rp25-35 juta | Rp17-26 juta | Perlu support dan anti-abuse lebih kuat. |

## 8. Guardrail Agar Tidak Rugi dari AI Credit

Wajib sebelum paid launch:

1. Simpan token input/output aktual dari Gemini untuk setiap request.
2. Tambahkan `estimated_idr_cost` di log AI event, bukan hanya credit.
3. Buat daily AI spend cap global, misalnya Rp50.000/hari saat beta berbayar awal.
4. Buat monthly AI spend cap per user:
   - Plus: soft cap Rp8.000 biaya AI/bulan.
   - Pro: soft cap Rp35.000 biaya AI/bulan.
   - Setelah soft cap, turunkan default model atau minta BYOK.
5. Jangan izinkan context node tanpa batas. Batasi context yang dikirim:
   - Free: 4.000-6.000 karakter context.
   - Plus: 12.000-20.000 karakter context.
   - Pro: 40.000-80.000 karakter context, dengan surcharge.
6. Naikkan surcharge panjang dari karakter ke token jika memungkinkan.
7. Web search:
   - Free: off atau sangat terbatas.
   - Plus: minimal 15 credit.
   - Pro: minimal 20 credit untuk query kompleks.
8. Tampilkan estimasi credit sebelum generate jika context panjang.

## 9. Rekomendasi Pricing

Pricing saat ini cukup baik untuk Indonesia:

| Plan | Status | Saran |
|---|---|---|
| Free | Tetap | Cocok untuk distribusi, jangan tambah daily credit. |
| Plus Rp29.000 | Tetap jadi hero plan | Harga psikologis bagus untuk mahasiswa/kreator. |
| API Pro Rp49.000 | Pertahankan | Margin terbaik, cocok untuk user teknis. |
| Pro Rp79.000 | Pertahankan sementara | Jangan naik dulu, tapi perketat fair-use dan Pro model. |

Saran eksperimen setelah 30-60 hari:

| Eksperimen | Kenapa |
|---|---|
| Annual Plus Rp249.000/tahun | Cashflow naik, harga terasa hemat. |
| Student Plus Rp19.000/bln terbatas | Akuisisi kampus, tapi credit harus lebih kecil. |
| Credit top-up kecil Rp15.000 | Cocok untuk user yang tidak mau subscription. |
| Team plan Rp149.000-Rp299.000 | Untuk guru, kelas kecil, komunitas belajar. |

## 10. KPI yang Harus Dipantau Tiap Minggu

| KPI | Target sehat |
|---|---:|
| Signup to activated board | >35% |
| Activated to AI first use | >45% |
| Free to paid conversion | 3%-5% awal |
| Plus churn | <12%/bulan |
| Pro churn | <9%/bulan |
| AI cost / revenue | <15% |
| Payment fee / revenue | <2% |
| Support issue per 100 paid user | <8 |
| Error rate AI generate | <2% |

## 11. Saran Tambahan

Urutan paling aman untuk 90 hari:

1. Jangan buru-buru scale iklan. Validasi dulu organic loop dan creator loop.
2. Rilis paid manual/WA dulu jika payment belum siap, tapi catat semua transaksi.
3. Jadikan Plus sebagai default rekomendasi, bukan Pro.
4. Dorong API Pro untuk user heavy AI, karena risiko biaya pindah ke API key user.
5. Pasang admin dashboard biaya AI per user sebelum Pro dipromosikan luas.
6. Buat template board edukasi Indonesia: rangkum materi, skripsi, kelas, riset, content plan.
7. Buat 10 contoh video pendek yang menunjukkan hasil konkret, bukan hanya fitur.
8. Review ulang harga setelah ada minimal 100 paid user atau 60 hari data paid.

## 12. Keputusan Praktis

Untuk sekarang, Paapan bisa lanjut dengan struktur ini:

- Free tetap murah hati tapi dibatasi.
- Plus menjadi mesin revenue utama.
- API Pro menjadi paket margin terbaik.
- Pro tetap ada, tapi dipasang fair-use AI cost guardrail.

Jika semua guardrail AI aktif, risiko rugi dari credit relatif terkendali. Jika guardrail belum aktif, jangan scale Pro dan web search terlalu cepat.
