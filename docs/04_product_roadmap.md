# Paapan Product Roadmap

Last updated: 2026-07-02

## Status Sekarang

Paapan sekarang ada di fase `Open Beta Release Hardening`.

Maknanya:

- core product utama sudah ada
- build dan lint sudah bersih
- fokus utama bukan lagi bikin banyak fitur baru
- fokus utama sekarang adalah readiness production, operasional, dan quality gate

## Fase 1. Foundation

Status: `Done`

- [x] Canvas workspace berbasis React Flow
- [x] AI generate berbasis Gemini
- [x] Text node
- [x] Mind node
- [x] Image node
- [x] Arrow layer
- [x] Frame / grouping dasar
- [x] Sidebar dan workspace switching
- [x] Save / reload workspace
- [x] Share board publik
- [x] Export board
- [x] Auth dasar
- [x] Forgot / reset password
- [x] Admin pages dasar
- [x] Feedback flow dasar

## Fase 2. Open Beta Readiness

Status: `In Progress`

### Sudah selesai

- [x] Pricing dan subscription copy diselaraskan ke mode `Open Beta`
- [x] Build produksi lolos
- [x] Lint repo lolos bersih
- [x] CI minimal `lint + build` ditambahkan
- [x] Dokumentasi release, deploy, env, SQL, dan smoke test sudah ada

### Masih harus diselesaikan

- [ ] Isi env production yang benar
- [ ] Jalankan SQL migration production
- [ ] Pasang cron internal untuk finalisasi account deletion
- [ ] Tentukan preview / branch flow final sebelum release
- [ ] Jalankan smoke test preview
- [ ] Jalankan smoke test production

## Fase 3. Open Beta Operation

Status: `Next`

- [ ] Monitor feedback user beta
- [ ] Pantau AI events dan error rate
- [ ] Pantau rate limiting dan abuse pattern
- [ ] Rapikan admin workflow support
- [ ] Putuskan perubahan pricing berdasarkan demand signal

## Fase 4. Paid Launch

Status: `Later`

- [ ] Payment gateway aktif
- [ ] Checkout flow yang benar-benar live
- [ ] Billing lifecycle yang jelas
- [ ] Purchase history / invoice basics
- [ ] Upgrade / downgrade flow yang final

## Fase 5. Growth

Status: `Later`

- [ ] Team workspaces
- [ ] Collaboration yang lebih kaya
- [ ] Integrasi Notion / Docs
- [ ] API / developer surface
- [ ] Referral / distribution loop

## Prioritas Praktis Minggu Ini

1. Selesaikan semua item external production setup.
2. Deploy ke preview.
3. Jalankan smoke test penuh.
4. Fix jika ada temuan.
5. Baru promote ke production.

## Bukan Prioritas Sekarang

Agar fokus tidak pecah, ini sebaiknya tidak didahulukan sebelum `Open Beta` rapi:

- payment gateway penuh
- fitur growth baru
- integrasi eksternal baru
- redesign besar yang tidak memblokir release

## Referensi

- `docs/17_release_readiness_checklist.md`
- `docs/18_deploy_operational_checklist.md`
- `docs/23_production_smoke_test_matrix.md`
