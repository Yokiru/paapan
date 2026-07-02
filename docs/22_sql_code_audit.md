# Paapan SQL vs Code Audit

Last updated: 2026-07-02

## Tujuan

Dokumen ini mencocokkan SQL migration yang ada dengan kode yang memakainya, supaya sebelum deploy kita tahu mana yang benar-benar wajib, mana yang punya fallback, dan mana yang berisiko diam-diam degradasi.

## Ringkasan Cepat

Hasil audit repo saat ini:

- Tidak terlihat mismatch fatal yang langsung membuat kode mustahil jalan
- Ada beberapa migration yang kalau belum dijalankan tidak selalu bikin crash, tetapi membuat fitur penting turun kualitas atau observability kosong
- Migration paling sensitif untuk produksi adalah `deduct_credits`, `check_rate_limit`, dan workspace sharing schema

## Status Per Migration

### 1. `docs/07_ai_events_tracking.sql`

Dipakai oleh:

- `lib/aiTelemetry.ts`
- `app/api/admin/ai/route.ts`
- `app/api/admin/system/route.ts`
- `app/admin/ai/page.tsx`
- `app/admin/system/page.tsx`
- `lib/accountDeletion.ts`

Status audit:

- Kode insert ke `ai_events` lewat `persistAIEvent(...)`
- Jika tabel belum ada, kode tidak crash keras; event hanya tidak tersimpan
- Admin AI/System tetap bisa hidup, tetapi metrik bisa kosong atau misleading

Kesimpulan:

- Migration ini wajib untuk observability dan admin metrics
- Bukan blocker langsung untuk user flow utama, tetapi blocker untuk monitoring yang sehat

Risiko kalau belum dijalankan:

- AI request tetap bisa jalan
- Dashboard admin AI/system kehilangan data
- Cleanup account deletion tidak bisa menghapus row `ai_events` karena tabel tidak ada

### 2. `docs/12_feedback_submissions.sql`

Dipakai oleh:

- `app/api/feedback/route.ts`

Status audit:

- Route feedback mencoba insert ke `feedback_submissions`
- Kalau tabel belum ada, route menangkap error dan mencoba fallback lain
- Di non-production ada fallback local log
- Di production, jika DB dan email sama-sama gagal, feedback akan dianggap gagal

Kesimpulan:

- Migration ini wajib untuk feedback yang bisa diandalkan
- Ada graceful fallback, tapi bukan alasan aman untuk melewatkannya di production

Risiko kalau belum dijalankan:

- Feedback bisa terlihat "aktif" sebagian tapi tidak tersimpan di DB
- Triage support jadi sulit

### 3. `docs/16_rate_limit_storage.sql`

Dipakai oleh:

- `lib/rateLimit.ts`
- `app/api/generate/route.ts`
- `app/api/feedback/route.ts`
- route lain yang memakai `checkPersistentRateLimit(...)`

Status audit:

- Kalau RPC `check_rate_limit` belum ada, helper fallback ke in-memory limiter
- Artinya app tidak langsung rusak
- Tetapi di serverless / multi-instance, limit jadi tidak persisten dan tidak terkoordinasi

Kesimpulan:

- Migration ini wajib untuk security posture production
- Tanpanya app masih jalan, tetapi proteksi abuse jauh lebih lemah

Risiko kalau belum dijalankan:

- Rate limit bisa tembus antar instance / cold start
- Abuse protection tidak konsisten

### 4. `docs/security/2026-03-23-credit-reset-server-authoritative.sql`

Dipakai oleh:

- `app/api/generate/route.ts`
- `lib/supabaseCredits.ts`

Status audit:

- Kode memanggil RPC `deduct_credits`
- Ini bukan sekadar enhancement; ini bagian inti flow potong kredit
- Jika function tidak ada atau tidak sinkron dengan schema credit, flow AI berisiko gagal atau salah hitung

Kesimpulan:

- Migration ini termasuk wajib untuk monetization / credit integrity
- Ini salah satu migration paling penting sebelum Open Beta yang melibatkan AI credits

Risiko kalau belum dijalankan:

- Potong kredit gagal
- User bisa lihat perilaku kredit tidak konsisten
- Generate route berisiko error saat debit kredit

### 5. `docs/security/2026-06-03-workspace-sharing-mvp.sql`

Dipakai oleh:

- `app/api/boards/[workspaceId]/share/route.ts`
- `app/api/public/board/[token]/route.ts`
- `app/api/public/board-by-id/[workspaceId]/route.ts`
- `store/useWorkspaceStore.ts`
- `lib/supabase.ts`

Status audit:

- Kode membaca dan menulis `share_visibility`, `share_token_nonce`, `allow_public_duplicate`, `shared_at`, `share_updated_at`
- Tanpa kolom-kolom itu, sharing route akan gagal

Kesimpulan:

- Migration ini wajib untuk fitur sharing publik
- Ini blocker langsung untuk flow share board

Risiko kalau belum dijalankan:

- Enable share gagal
- Public board endpoint gagal baca state sharing

## Temuan Penting

### Temuan 1: Beberapa migration punya fallback, tapi fallback bukan status sehat production

Contoh:

- `ai_events` hilang -> request AI tetap bisa hidup, tapi observability mati
- `check_rate_limit` hilang -> rate limit fallback ke memory, tapi produksi jadi lemah
- `feedback_submissions` hilang -> feedback bisa degradasi ke email-only atau gagal total

Makna operasional:

- "app masih jalan" tidak sama dengan "production siap"

### Temuan 2: `deduct_credits` adalah dependency keras untuk flow AI berbayar / credit-aware

Generate route memanggil RPC ini secara langsung. Jadi migration credit bukan opsional untuk flow AI yang benar.

### Temuan 3: Workspace sharing schema adalah dependency keras untuk fitur share

Tidak ada fallback berarti untuk kolom sharing. Kalau migration sharing belum ada, fitur share board praktis belum siap rilis.

### Temuan 4: Secret signing share sebaiknya eksplisit

`lib/workspaceSharing.ts` masih fallback ke `SUPABASE_SERVICE_ROLE_KEY` bila `PAAPAN_SHARE_SECRET` dan `SHARE_LINK_SECRET` kosong.

Makna:

- app tetap bisa jalan
- tetapi secara hygiene security, production lebih baik punya `PAAPAN_SHARE_SECRET` sendiri

## Prioritas Wajib Sebelum Release

Urutan wajib minimal:

1. `deduct_credits`
2. workspace sharing schema
3. persistent rate limit
4. feedback submissions
5. ai_events

Kalau target Open Beta butuh:

- AI generate
- credit integrity
- share board
- feedback support
- abuse protection

maka kelima migration itu sebaiknya dianggap wajib semua.

## Kesimpulan Akhir

Audit repo tidak menemukan mismatch fatal baru, tetapi menemukan beberapa area di mana kode sengaja fallback saat migration belum ada. Untuk local dev ini bagus. Untuk production, fallback itu jangan dianggap cukup.

Production sehat berarti:

- migration jalan
- env benar
- smoke test lolos
- fallback tidak lagi menjadi tumpuan utama

## Referensi

- `docs/18_deploy_operational_checklist.md`
- `docs/21_sql_migration_execution_order.md`
