# Paapan Security Audit

Last updated: 2026-06-22

## Status Legend

| Status | Meaning |
| --- | --- |
| `[ ]` | Belum dikerjakan |
| `[~]` | Sedang dikerjakan / perlu verifikasi ulang |
| `[x]` | Selesai dan sudah diverifikasi |

## Priority Legend

| Priority | Meaning |
| --- | --- |
| `P1` | Harus dibereskan sebelum launch serius |
| `P2` | Penting untuk produksi, bisa setelah P1 |
| `P3` | Maintenance / hardening tambahan |

## Audit Checklist

| Status | Priority | Area | Finding | Notes / Next Step |
| --- | --- | --- | --- | --- |
| `[x]` | `P1` | Dependencies | `npm audit` sebelumnya menemukan 12 vulnerabilities: 6 high, 5 moderate, 1 low. | Fixed 2026-06-19: upgraded `next`/`eslint-config-next` to `16.2.9`, `nodemailer` to `9.0.1`, `@supabase/supabase-js` to `2.108.2`, and pinned `postcss` to `8.5.15` via override. `npm audit --audit-level=moderate` now returns 0 vulnerabilities and `npm run build` passes. |
| `[x]` | `P1` | External fetch / SSRF | URL fetch di generate/scrape sebelumnya hanya blok hostname/IP literal. Belum cek DNS-resolved private IP, redirect target, timeout, dan response size. | Fixed 2026-06-22: added shared `lib/safeFetch.ts` with protocol/credential/hostname/IP/DNS checks, manual redirect validation, timeout, content-type allowlist, and response size limits. Applied to `app/api/generate/route.ts` and `app/api/scrape/route.ts`. `npm run build` passes. |
| `[x]` | `P2` | Rate limit | Rate limit sebelumnya masih in-memory sehingga reset di serverless/cold start. | Fixed 2026-06-22: added Supabase-backed `check_rate_limit` RPC in `docs/16_rate_limit_storage.sql` and `checkPersistentRateLimit` fallback in `lib/rateLimit.ts`. Applied to AI generate, scrape, image upload, public board, and share settings routes. SQL migration has been run in Supabase. `npm run build` passes. |
| `[x]` | `P2` | Feedback API | `app/api/feedback/route.ts` sebelumnya belum punya rate limit dan bisa dipakai spam email/DB insert. | Fixed 2026-06-22: added persistent rate limit per client fingerprint and per authenticated user using `checkPersistentRateLimit`. UI already surfaces the simple server message when limited. `npm run build` passes. |
| `[x]` | `P2` | Upload image | Upload sudah auth + owner check + MIME + size + quota, tetapi bucket public berarti URL gambar memang publik. | Accepted for current launch phase 2026-06-22: keep public image URLs for simpler canvas rendering, export, and shared-board viewing. Add/keep privacy wording that uploaded/shared-board images may be accessible through asset links. Revisit private bucket/signed URLs when Paapan handles more sensitive customer data. |
| `[x]` | `P3` | Supabase auth helper | `@supabase/auth-helpers-nextjs` deprecated. | Selesai 2026-06-22: migrasi ke `@supabase/ssr`, tambah helper server di `lib/supabaseServer.ts`, hapus package deprecated. Verifikasi: `npm run build` pass, `npm audit --audit-level=moderate` 0 vulnerability. |
| `[x]` | `P3` | Admin access | Admin API memakai Supabase token + allowlist email hardcoded. Aman sederhana, tapi belum flexible. | Selesai 2026-06-22: `lib/admin.ts` sekarang membaca `ADMIN_EMAIL_ALLOWLIST` dari env, dipisah koma, dengan fallback email admin lama agar akses produksi tidak putus. Verifikasi: `npm run build` pass, `npm audit --audit-level=moderate` 0 vulnerability. |
| `[x]` | `P3` | Public share polling | Share state public sudah no-store dan view-only, tetapi realtime revoke/duplicate bergantung pada client polling. | Selesai 2026-06-22: polling public board dibuat lebih ringan (`2500ms`), tetap sync langsung saat focus/visible, dan request lama dibatalkan agar tidak overlap. Revoke/duplicate tetap responsif tanpa menabrak rate limit umum. Verifikasi: `npm run build` pass, `npm audit --audit-level=moderate` 0 vulnerability. |

## Checked And Currently Acceptable

| Status | Area | Notes |
| --- | --- | --- |
| `[x]` | Share owner check | `app/api/boards/[workspaceId]/share/route.ts` memverifikasi bearer token dan `user_id` pemilik board sebelum mengubah share settings. |
| `[x]` | Public board access | Public route hanya mengembalikan board jika `share_visibility = link_view`; PATCH public ditolak dengan 403. |
| `[x]` | Public image metadata | Public board payload menghapus `storagePath` dan `storageBucket` dari image nodes. |
| `[x]` | Markdown render | AI response memakai `ReactMarkdown` dengan `skipHtml` dan URL transform/sanitizer. |
| `[x]` | Text link sanitizer | Rich text link hanya mengizinkan relative path, hash, `http`, `https`, dan `mailto`. |
| `[x]` | Admin API auth | Admin API menolak request tanpa token, token invalid, dan email di luar allowlist. |

## Verification Commands

Run after fixes:

```powershell
npm audit --audit-level=moderate
npm run build
npm run lint
```

Persistent rate limit migration:

```powershell
# Run docs/16_rate_limit_storage.sql in Supabase SQL editor.
```

Optional targeted checks:

```powershell
rg -n "dangerouslySetInnerHTML|innerHTML|service_role|SUPABASE_SERVICE_ROLE_KEY|fetch\\(|checkRateLimit" app lib components store -S
```

## Notes

- Jangan commit secret atau isi `.env.local`.
- Untuk admin, set `ADMIN_EMAIL_ALLOWLIST=email1@example.com,email2@example.com` di Vercel jika ingin mengubah/menambah admin tanpa deploy perubahan kode.
- Kalau upgrade dependency mengubah `package-lock.json`, jalankan build sebelum push.
- Untuk launch public, prioritas terbaik: dependency patch, safe fetch/SSRF hardening, lalu feedback/rate-limit hardening.
- `npm run lint` saat ini masih gagal karena lint debt lama/aturan React dan TypeScript yang lebih ketat setelah upgrade, bukan karena vulnerability dependency. Track sebagai cleanup terpisah sebelum CI lint diwajibkan.
