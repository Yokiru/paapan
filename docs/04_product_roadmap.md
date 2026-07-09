# Paapan Product Roadmap

Last updated: 2026-07-09

## Status Sekarang

Paapan sekarang ada di fase `Public Open Beta Soft Launch`.

Maknanya:

- core product utama sudah ada
- build dan lint sudah bersih
- fokus utama bukan lagi bikin banyak fitur baru
- fokus utama sekarang adalah soft launch bertahap, monitoring, dan feedback user nyata

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

Status: `Done for soft launch`

### Sudah selesai

- [x] Pricing dan subscription copy diselaraskan ke mode `Open Beta`
- [x] Build produksi lolos
- [x] Lint repo lolos bersih
- [x] CI minimal `lint + build` ditambahkan
- [x] Dokumentasi release, deploy, env, SQL, dan smoke test sudah ada
- [x] Env production sudah diisi di Vercel oleh owner
- [x] SQL migration penting sudah dijalankan oleh owner
- [x] Cron Vercel untuk finalisasi account deletion sudah aktif
- [x] Smoke test production utama sudah berhasil menurut laporan owner

### Masih harus diselesaikan

- [ ] Pantau production 24-72 jam pertama saat soft launch
- [ ] Catat feedback user beta dan error yang muncul
- [ ] Putuskan kapan menaikkan exposure dari 20-50 user ke batch berikutnya

## Fase 3. Open Beta Operation

Status: `In Progress`

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

1. Commit/push dokumen readiness terbaru.
2. Jalankan `npm run lint` dan `npm run build` final.
3. Buka public beta terbatas ke 20-50 user pertama.
4. Pantau logs, AI errors, feedback, credit usage, dan signup/login.
5. Fix cepat jika ada blocker sebelum scale exposure.

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
- `docs/28_public_beta_soft_launch_runbook.md`
