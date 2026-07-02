# Paapan

Paapan adalah workspace visual berbasis AI untuk menyusun ide, konten, dan board kolaboratif di atas canvas.

Status repo saat ini:

- Mode produk: `Open Beta`
- `npm run lint`: lolos bersih
- `npm run build`: lolos
- Payment otomatis: belum aktif
- CTA paket tambahan: contact flow manual

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase
- Zustand
- React Flow

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Environment Variables

Minimal env yang perlu untuk production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `ZOHO_SMTP_HOST`
- `ZOHO_SMTP_PORT`
- `ZOHO_SMTP_USER`
- `ZOHO_SMTP_PASS`
- `FEEDBACK_INBOX`
- `ADMIN_EMAIL_ALLOWLIST`
- `CRON_SECRET`

Lihat detail operasional di:

- [docs/17_release_readiness_checklist.md](./docs/17_release_readiness_checklist.md)
- [docs/18_deploy_operational_checklist.md](./docs/18_deploy_operational_checklist.md)
- [docs/README.md](./docs/README.md)

## Release Notes

Beberapa keputusan release penting saat ini:

- Build produksi tidak lagi tergantung fetch font eksternal
- Messaging pricing sudah diarahkan ke `Open Beta`
- CI minimal untuk `lint` dan `build` ada di `.github/workflows/ci.yml`

## Operational Notes

- Endpoint internal account deletion finalization:
  `POST /api/internal/account/finalize-deletions`
- Endpoint itu butuh header `x-cron-secret` dengan nilai `CRON_SECRET`
- SQL production dan env production masih harus diverifikasi saat deploy
