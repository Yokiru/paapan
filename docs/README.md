# Dokumentasi Paapan

Folder ini berisi dokumentasi bisnis, produk, keamanan, dan release untuk project Paapan.

## Daftar File

| No | File | Deskripsi |
|----|------|-----------|
| 01 | [01_gemini_api_strategy.md](./01_gemini_api_strategy.md) | Strategi penggunaan Gemini API, rate limits, pricing |
| 02 | [02_credit_pricing_model.md](./02_credit_pricing_model.md) | Model pricing berbasis credit |
| 03 | [03_business_simulation.md](./03_business_simulation.md) | Proyeksi bisnis 12 bulan |
| 04 | [04_product_roadmap.md](./04_product_roadmap.md) | Roadmap pengembangan produk |
| 05 | [05_open_beta_plan.md](./05_open_beta_plan.md) | Strategi Open Beta (stealth mode) |
| 06 | [06_byok_feature_plan.md](./06_byok_feature_plan.md) | BYOK (Bring Your Own Key) feature plan |
| 17 | [17_release_readiness_checklist.md](./17_release_readiness_checklist.md) | Checklist langkah demi langkah menuju release |
| 18 | [18_deploy_operational_checklist.md](./18_deploy_operational_checklist.md) | Runbook deploy, env, migration, cron, dan smoke test |
| 19 | [19_env_route_mapping.md](./19_env_route_mapping.md) | Peta environment variable per route dan modul |
| 20 | [20_env_production_checklist.md](./20_env_production_checklist.md) | Checklist final pengisian env untuk production |
| 21 | [21_sql_migration_execution_order.md](./21_sql_migration_execution_order.md) | Urutan aman eksekusi SQL migration production |
| 22 | [22_sql_code_audit.md](./22_sql_code_audit.md) | Audit kecocokan SQL migration dengan kode yang memakainya |
| 23 | [23_production_smoke_test_matrix.md](./23_production_smoke_test_matrix.md) | Matrix smoke test preview/production untuk release |
| 24 | [24_owner_action_list.md](./24_owner_action_list.md) | Daftar hal external yang harus dilakukan owner di luar repo |

## Quick Summary

**Current Release Mode:** Open Beta
- Free: 25 welcome credits + 5 credits/hari
- Paid plans: belum dibuka untuk checkout otomatis
- Extra quota / special access: manual via tim Paapan

**Current Monetization Posture:**
- UI pricing publik mengarah ke `Coming Soon` / contact flow
- Payment gateway belum aktif di aplikasi
- BYOK dan flow beta tetap jadi jalur eksplorasi utama

**Current Priority:**
- Verifikasi env production dan SQL production
- Pasang cron internal untuk finalisasi account deletion
- Jalankan smoke test Open Beta sesudah deploy

---

*Last updated: 2026-07-02*
