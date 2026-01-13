# Paapan Open Beta Plan (Stealth Mode)

> **Versi:** 2.3  
> **Status:** Beta Testing (No Public Pricing)  
> **Fokus:** Mencari Bug & Feedback User

---

## 📋 Ringkasan

| Item | Value |
|------|-------|
| Welcome Bonus | 25 kredit (sekali) |
| Daily Reset | 5 kredit/hari |
| Harga | Coming Soon |
| Contact | WhatsApp Admin |

---

## 🎯 1. Tampilan Pricing (Frontend)

| Paket | Kredit | Harga | Tombol |
|-------|--------|-------|--------|
| Basic | 275 | Coming Soon | Hubungi Kami |
| Plus | 700 | Coming Soon | Beritahu Saya |
| Pro | 1500 | Coming Soon | Hubungi Kami |

**Pesan di UI:**
> "Selama masa Open Beta, sistem pembayaran belum aktif. Hubungi kami untuk mendapatkan kuota tambahan atau akses khusus."

---

## 🔄 2. Alur Pengguna (User Flow)

### A. Onboarding (Gratis)
1. User Daftar → Dapat **25 Credits** (Welcome Bonus)
2. User pakai fitur → Kredit berkurang (backend tracking aktif)
3. Daily Reset: Saldo di-reset jadi **5 kredit** tiap tengah malam

### B. Soft Wall (Saat Kredit Habis)
Saat saldo = 0, tampilkan modal:

```
┌─────────────────────────────────────────┐
│          Kuota Beta Habis? ⚡           │
├─────────────────────────────────────────┤
│  Terima kasih sudah mencoba Paapan!     │
│  Fitur Top-Up sedang kami siapkan.      │
│                                         │
│  Butuh kuota lebih? Hubungi Admin:      │
│                                         │
│   [ 💬 Hubungi via WhatsApp ]           │
│                                         │
│  Atau dapatkan kredit gratis:           │
│   [ 📝 Isi Survey (10 kredit) ]         │
└─────────────────────────────────────────┘
```

### C. Respons WhatsApp Admin

**User:** "Halo Admin, kuota saya habis nih. Mau tambah dong."

**Respons:**
- **Opsi 1 (Feedback):** "Halo! Boleh banget. Gimana pengalaman pakainya? Ada error gak? Kalau kasih feedback, saya isiin 100 kredit gratis ya."
- **Opsi 2 (Donasi):** "Halo! Sistem bayar belum ready, tapi kalau mau support server, boleh transfer seikhlasnya, nanti saya isiin paket Basic."

---

## 💻 3. Implementasi Teknis

### Yang AKTIF di Backend:
- ✅ Sistem kredit (tracking usage)
- ✅ Daily Reset (5 kredit/hari)
- ✅ Welcome Bonus (25 kredit)
- ✅ Power user detection (siapa cepat habis)

### Yang DI-DISABLE di Frontend:
- ❌ Tombol "Beli" (diganti "Hubungi Kami")
- ❌ Payment gateway
- ❌ Harga (diganti "Coming Soon")

---

## 📊 4. Metrik yang Dipantau

| Metrik | Tujuan |
|--------|--------|
| Daily Active Users | Engagement |
| Credits consumed/user | Usage pattern |
| Users hitting soft wall | Demand signal |
| WhatsApp inquiries | Conversion interest |
| Bug reports | Quality |

---

## ⏰ 5. Timeline

| Fase | Durasi | Fokus |
|------|--------|-------|
| Soft Launch | 2 minggu | Bug hunting, core flow |
| Community Beta | 1 bulan | Feedback collection |
| Pricing Test | 2 minggu | A/B test harga |
| Public Launch | - | Payment aktif |
