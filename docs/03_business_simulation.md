# Simulasi Bisnis Paapan — Tahun Pertama (Skenario Realistis)

> **Versi:** 4.0 (Maret 2026)  
> **Model:** 3-Tier Subscription (Free / Plus / Pro)  
> **Go-to-Market:** Midtrans Day 1 + Outreach Creator Edukasi  
> **Kurs:** 1 USD = Rp 16.000

---

## 📋 1. Setup Awal & Infrastruktur

### Biaya Tetap (Fixed Costs)

| Item | Provider | Plan | Biaya/bln (IDR) |
|------|----------|------|-----------------|
| Hosting | Vercel | Pro | Rp 320.000 |
| Database | Supabase | Pro | Rp 400.000 |
| Domain | .com | - | Rp 16.000 |
| Payment Gateway| Midtrans | MDR | ~1.5% - 2% per tx |
| **Total Fix** | | | **Rp 736.000** |

> *Catatan: Supabase langsung pakai Pro ($25) karena payment sudah aktif dari hari pertama.*

### Biaya API (Variable Costs)

Rata-rata cost API: **Rp 200–500 per user aktif per bulan** (mayoritas pakai Flash-Lite).

---

## � 2. Strategi Go-to-Market (Marketing)

### Budget Konsisten: Rp 500.000 / Bulan

Ini bukan untuk Facebook/Google Ads (budget ini terlalu kecil untuk CPC efektif). Strategi ini fokus pada **Micro-Influencer & Creator Edukasi IG/TikTok**:

1. **Direct Outreach (Hustle Mode):**
   - DM 5-10 creator edukasi (kampus, produktivitas, design) **setiap hari**.
   - Tawarkan akun **Pro gratis 6 bulan** asalkan mereka mau mencoba dan me-review jujur di IG Story/Reels.
   - *Conversion:* Dari 150 DM sebulan, ekspektasi 5-10 creator mau bikin konten organik.

2. **Alokasi Budget Rp 500K:**
   - Rp 300K: Boost post (Meta Ads) untuk konten reel yang performanya secara organik bagus.
   - Rp 200K: Giveaway kecil-kecilan (misal saldo e-wallet untuk follower creator yang daftar Paapan).

3. **Keunggulan Payment Day 1 (Midtrans):**
   - Tidak ada *friction* saat transfer. Begitu follower creator tertarik, mereka bisa langusng bayar pakai QRIS/GoPay. Impulse buying tinggi.

---

## 📉 3. Asumsi Konversi & Growth (Skenario Realistis)

| Parameter | Nilai Konservatif/Realistis |
|-----------|-----------------------------|
| **Starting Users** | 30 organik dari network sendiri |
| **New Users / bln** | +50 s.d +100 dari konten creator |
| **Conversion Rate** | **5% (Bulan 1-4) → 8% (Bulan 5+)** |
| **Churn Rate** | 10% / bulan (Banyak yang coba sebulan lalu berhenti) |
| **Tier Distribution** | 80% Plus (Rp 29K), 20% Pro (Rp 79K) |
| **ARPU (Rata-rata)** | ~Rp 39.000 per paying user |

---

## 📊 4. Simulasi 12 Bulan — Realistis

Kita akan proyeksikan bulan ke bulan dengan asumsi growth linier dari hasil outreach konten kreator.

| Bln | Total Free | New Paying | Churn (10%) | Total Paying | Revenue | Fix Cost | API Cost | Marketing | **NET INCOME** |
|-----|------------|------------|-------------|--------------|---------|----------|----------|-----------|----------------|
| **1** | 100 | 5 | 0 | 5 | Rp 195.000 | Rp 736K | Rp 15K | Rp 500K | **-Rp 1.056.000** |
| **2** | 180 | 9 | -1 | 13 | Rp 507.000 | Rp 736K | Rp 30K | Rp 500K | **-Rp 759.000** |
| **3** | 250 | 13 | -1 | 25 | Rp 975.000 | Rp 736K | Rp 50K | Rp 500K | **-Rp 311.000** |
| **4** | 350 | 18 | -3 | 40 | Rp 1.560.000 | Rp 736K | Rp 80K | Rp 500K | **Rp 244.000** 🟢 |
| **5** | 450 | 36* | -4 | 72 | Rp 2.808.000 | Rp 736K | Rp 120K | Rp 500K | **Rp 1.452.000** |
| **6** | 560 | 45 | -7 | 110 | Rp 4.290.000 | Rp 736K | Rp 160K | Rp 500K | **Rp 2.894.000** |
| **7** | 680 | 54 | -11 | 153 | Rp 5.967.000 | Rp 736K | Rp 220K | Rp 500K | **Rp 4.511.000** |
| **8** | 820 | 66 | -15 | 204 | Rp 7.956.000 | Rp 736K | Rp 280K | Rp 500K | **Rp 6.440.000** |
| **9** | 980 | 78 | -20 | 262 | Rp 10.218.000 | Rp 736K | Rp 350K | Rp 500K | **Rp 8.632.000** |
| **10**| 1.150 | 92 | -26 | 328 | Rp 12.792.000 | Rp 736K | Rp 450K | Rp 500K | **Rp 11.106.000** |
| **11**| 1.350 | 108 | -33 | 403 | Rp 15.717.000 | Rp 736K | Rp 550K | Rp 500K | **Rp 13.931.000** |
| **12**| 1.580 | 126 | -40 | 489 | Rp 19.071.000 | Rp 736K | Rp 680K | Rp 500K | **Rp 17.155.000** |

*(Catatan: Bulan 5 diasumsikan conversion rate membaik (dari 5% ke 8%) karena product matang dan testimoni creator sudah banyak)*

---

## 🎯 5. Ringkasan & Milestone 1 Tahun (Realistis)

| Metrik | Hasil (Bulan 12) |
|--------|------------------|
| Total Users (Free + Paid) | ~2.000 |
| Total Paying Users | 489 |
| Conversion Rate Realistis | ~8-10% |
| MRR Akhir | **Rp 19.071.000** |
| **Net Income Akhir** | **Rp 17.155.000** / bulan |

### Milestone Penting:
1. **Bulan 4: Break-even!** Revenue akhirnya menutup biaya server, API, dan budget marketing Rp 500K.
2. **Bulan 9: Target Rp 8 Juta Tercapai!** Dengan konsistensi outreach tiap hari, di bulan 9 net income sudah di atas 8 juta.

---

## 💡 6. Faktor Penentu Keberhasilan (Kunci)

Dalam skenario realistis ini, **faktor penentu sukses bukan teknologi, tapi konsistensi marketing.**

1. **Efek Bola Salju Content Creator:**
   Di bulan 1-3 mungkin hasilnya sedikit. Tapi algoritma IG/TikTok bekerja seperti bola salju. Satu VT dari kreator edukasi yang fyp (bisa dapat 100k views) bisa membawa 200 user baru dalam sehari. Midtrans yang siap sejak hari ke-1 akan menyapu bersih konversi ini.
2. **Disiplin DM 10 Kreator/Hari:**
   Total 300 DM per bulan. Walau yang merespons cuma 5%, itu sudah cukup untuk menjaga *growth engine* Paapan.
3. **Mengapa Churn Diasumsikan 10%?**
   Target mahasiswa sering langganan hanya pas musim ujian/skripsi. Mereka akan *churn* pas libur. Ini wajar. Pastikan harga Rp 29K cukup murah agar mereka malas cancel walau sedang tidak terlalu dipakai.
4. **Resiko Budget Sempit (Rp 500K)**
   Tidak bisa berharap banyak pada Meta Ads. Gunakan uang itu murni untuk "pelumas" kerja keras organik (boost post bagus, kasi saldo OVO ke follower untuk engagement).
