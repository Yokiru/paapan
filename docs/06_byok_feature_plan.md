# BYOK (Bring Your Own Key) Feature Plan

> **Status:** Planned  
> **Priority:** Medium  
> **Target:** Post-Beta Launch

---

## 📋 Ringkasan

Fitur BYOK memungkinkan user menggunakan API key AI mereka sendiri (Gemini, OpenAI, dll) untuk menghilangkan batasan kredit dan mendapatkan kontrol penuh atas usage.

---

## 🎯 Value Proposition

| Untuk User | Untuk Paapan |
|------------|--------------|
| Unlimited AI usage | Zero API cost |
| No credit limits | Reduced server load |
| Data privacy (direct to provider) | Premium feature upsell |
| Use preferred AI model | Attracts power users |

---

## 💰 Monetization Options

### Opsi 1: BYOK sebagai Premium Feature
| Plan | Harga | BYOK Access |
|------|-------|-------------|
| Free | Rp 0 | ❌ |
| Credits | Pay per use | ❌ |
| **Pro BYOK** | Rp 29K/bulan | ✅ |

### Opsi 2: BYOK Gratis (Recommended for Growth)
- BYOK gratis untuk semua user
- Monetize dari fitur lain (analytics, collaboration, export, dll)

### Opsi 3: Hybrid Model
- Default: Pakai credits Paapan
- Optional: Switch ke own API key (gratis)
- Premium: Advanced features (model selection, custom prompts, dll)

---

## 🔧 Technical Implementation

### 1. UI Components
```
Settings → AI → API Key
┌─────────────────────────────────────────┐
│ 🔑 API Key Anda                         │
│ ┌─────────────────────────────────────┐ │
│ │ ●●●●●●●●●●●●●●●●●●●●●●●           │ │
│ └─────────────────────────────────────┘ │
│ [Simpan] [Test Connection]              │
│                                         │
│ Provider: [Gemini ▼]                    │
│ Model: [gemini-2.0-flash ▼]            │
└─────────────────────────────────────────┘
```

### 2. Storage Options
| Option | Pros | Cons |
|--------|------|------|
| localStorage | Simple, no server | Not secure, device-bound |
| Supabase (encrypted) | Secure, synced | Requires backend |
| User's browser vault | Very secure | Complex UX |

**Recommendation:** Supabase dengan encryption untuk production.

### 3. API Flow
```
User Request
    ↓
Check: hasOwnApiKey?
    ├─ YES → Use user's API key directly
    │        └─ No credit deduction
    │
    └─ NO → Use Paapan's API key
             └─ Deduct credits
```

### 4. Supported Providers (Future)
- [x] Google Gemini (primary)
- [ ] OpenAI GPT-4
- [ ] Anthropic Claude
- [ ] Local LLMs (Ollama)

---

## 📋 Implementation Checklist

### Phase 1: Basic BYOK
- [ ] Add API key input in AI Settings modal
- [ ] Store API key securely (encrypted in Supabase)
- [ ] Update AI call logic to check for user key
- [ ] Skip credit deduction when using own key
- [ ] Add "Test Connection" button

### Phase 2: Enhanced Features
- [ ] Model selection (flash, pro, etc)
- [ ] Provider selection (Gemini, OpenAI)
- [ ] Usage tracking (even with own key)
- [ ] Rate limit warnings

### Phase 3: Security & Polish
- [ ] API key encryption at rest
- [ ] Key rotation reminders
- [ ] Audit log for API usage
- [ ] Clear key on logout option

---

## ⚠️ Considerations

### Security
- API keys harus di-encrypt sebelum disimpan
- Jangan pernah log API key
- Clear key saat user logout (optional)

### UX
- Jelaskan benefit BYOK ke user
- Provide link ke cara dapat API key
- Show usage stats even with own key

### Support
- User yang pakai own key = less support burden
- Tapi perlu dokumentasi "cara dapat API key"

---

## 📅 Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 1-2 days | Supabase auth ready |
| Phase 2 | 2-3 days | Phase 1 complete |
| Phase 3 | 1-2 days | Phase 2 complete |

**Total:** ~1 minggu development time

---

## 🔗 Related Docs
- [02_credit_pricing_model.md](./02_credit_pricing_model.md)
- [01_gemini_api_strategy.md](./01_gemini_api_strategy.md)
