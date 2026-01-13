# Strategi Gemini API untuk Paapan

## 📊 Rate Limits Gemini API

| Model | RPM | TPM | RPD |
|-------|-----|-----|-----|
| gemini-2.0-flash-lite | 4K | 4.29M | Unlimited |
| gemini-2.5-flash-lite | 4K | 4M | Unlimited |
| gemini-2.5-flash | 1K | 1M | 10K |
| gemini-2.5-pro | 150 | - | 10K |

## 💰 Harga API (Per 1 Juta Token)

| Model | Input | Output |
|-------|-------|--------|
| gemini-2.0-flash-lite | $0.10 | $0.40 |
| gemini-2.5-flash | $0.15 | $0.60 |
| gemini-2.5-pro | $1.25 | $10.00 |

## 🎯 Model Selection Strategy

| Use Case | Model | Alasan |
|----------|-------|--------|
| Simple chat | gemini-2.0-flash-lite | Termurah |
| Standard reasoning | gemini-2.5-flash | Balance |
| Complex analysis | gemini-2.5-pro | Best quality |

## 🛡️ Anti-Abuse Protection

### Rate Limiting Internal
```typescript
const LIMITS = {
  free: { requestsPerMinute: 3, maxTokensPerRequest: 500 },
  paid: { requestsPerMinute: 10, maxTokensPerRequest: 2000 }
};
```

### Token Counting (Wajib!)
- Hitung token SEBELUM kirim ke API
- Reject jika melebihi limit tier

### Circuit Breaker
- Daily budget cap: $50
- Auto-switch ke cached responses jika exceeded

## 🚨 Jebakan yang Harus Dihindari

1. ❌ Unlimited requests → User spam
2. ❌ Tidak track token → Biaya meledak
3. ❌ Satu model untuk semua → Buang uang
4. ❌ Free tier terlalu generous → User tidak upgrade
