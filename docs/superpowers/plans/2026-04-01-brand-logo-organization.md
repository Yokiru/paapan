# Brand Logo Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rapikan aset logo Paapan ke struktur brand yang jelas lalu terapkan varian yang tepat ke app shell, halaman auth, dan metadata web.

**Architecture:** Simpan tiga varian logo di bawah `public/brand` dengan nama yang konsisten, lalu ubah referensi UI agar lockup (`icon + wordmark`) jadi logo utama website, icon-only jadi favicon/app icon, dan typography-only dipakai hanya untuk area sempit yang butuh wordmark murni.

**Tech Stack:** Next.js App Router, public static assets, Metadata API, React components

---

### Task 1: Rapikan Struktur Aset Brand

**Files:**
- Create: `public/brand/icon/paapan-mark.svg`
- Create: `public/brand/icon/paapan-mark.png`
- Create: `public/brand/lockup/paapan-lockup.svg`
- Create: `public/brand/lockup/paapan-lockup.png`
- Create: `public/brand/wordmark/paapan-wordmark.svg`
- Create: `public/brand/wordmark/paapan-wordmark.png`

- [ ] Pindahkan aset existing ke struktur `public/brand`
- [ ] Gunakan nama file yang deskriptif dan stabil
- [ ] Biarkan aset lama dihapus setelah referensi baru aman

### Task 2: Terapkan ke Metadata dan Shell Utama

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/ui/Sidebar.tsx`
- Modify: `components/auth/AuthLayout.tsx`

- [ ] Set metadata icon ke varian `paapan-mark`
- [ ] Ganti header sidebar dari teks polos menjadi lockup logo
- [ ] Ganti ikon petir auth card menjadi brand mark Paapan

### Task 3: Verifikasi dan Bersihkan Aset Lama

**Files:**
- Modify: `public/`

- [ ] Pastikan tidak ada referensi UI yang masih mengarah ke nama file lama
- [ ] Hapus aset logo lama dari root `public` jika semua referensi sudah pindah
- [ ] Jalankan build untuk memastikan static asset path valid
