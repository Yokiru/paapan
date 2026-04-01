# Paapan Save Architecture v2

## Goal
Membangun fondasi penyimpanan canvas Paapan yang lebih aman, local-first, tahan tab switch, siap untuk realtime collaboration, dan tetap ringan untuk board besar.

## Why This Matters
Masalah utama hari ini:
- Perubahan di canvas bisa hilang saat tab pindah, refresh, atau cloud snapshot yang lebih lama menimpa state lokal.
- Save masih terlalu bergantung pada full snapshot dokumen.
- Viewport, sync, dan autosave masih saling terkait terlalu erat.
- Fondasi saat ini belum ideal untuk kolaborasi realtime.

## Product Principles
- Local-first: perubahan user harus aman di device dulu sebelum menunggu cloud.
- Never lose work: tab switch, blur, reconnect, dan network hiccup tidak boleh menghilangkan node.
- Cloud as sync layer, not immediate truth: cloud menyamakan state, bukan menimpa kerja lokal mentah.
- Incremental over full snapshot: kirim perubahan kecil, bukan seluruh dokumen terus-menerus.
- Collaboration-ready: presence, sync dokumen, dan conflict policy dipisah dengan jelas.
- Performance-sensitive: render, persistence, dan network update tidak saling membebani.

## Current Architecture Problems
### 1. Snapshot-based saving
Canvas saat ini menyimpan node, edge, frame, stroke, arrow, dan viewport sebagai satu snapshot besar.

Risiko:
- write payload besar
- debounced save bisa kalah balapan dengan refresh/focus sync
- stale snapshot bisa overwrite local state yang lebih baru

### 2. Focus or visibility refresh can overwrite local work
Saat tab kembali aktif, sistem bisa mengambil data cloud lalu meng-apply snapshot ke state lokal.

Risiko:
- jika local changes belum benar-benar ter-ack, remote row lama bisa menang
- user merasa node "hilang"

### 3. Viewport state terlalu dekat ke document state
Viewport dipakai untuk UX, tapi update-nya bisa ikut memicu jalur sinkronisasi lain.

Risiko:
- loop update
- viewport jump
- render dan save saling mempengaruhi

### 4. No real revision contract
Belum ada model revisi yang jelas antara local state, op yang belum terkirim, dan state cloud yang sudah authoritative.

## Target Architecture v2
Arsitektur dibagi menjadi 5 lapisan.

### 1. Local Document Store
Semua perubahan canvas masuk dulu ke local document store yang persisten di device.

Rekomendasi:
- IndexedDB untuk workspace documents
- Zustand tetap dipakai untuk UI/runtime state
- local document menjadi sumber aman saat tab blur, refresh, atau reconnect

Dokumen lokal menyimpan:
- nodes
- edges
- frames
- strokes
- arrows
- metadata workspace
- server revision terakhir yang sudah di-ack
- pending operations queue

### 2. Operation Queue
Setiap perubahan user diubah menjadi operation kecil.

Contoh:
- `node.create`
- `node.update.position`
- `node.update.content`
- `node.delete`
- `edge.create`
- `edge.delete`
- `frame.create`
- `frame.update`
- `stroke.add`
- `arrow.add`

Queue ini:
- masuk ke local store lebih dulu
- dikirim ke server secara batch
- tetap aman walau offline atau request gagal

### 3. Cloud Sync Engine
Server menerima operation batch dan menerapkan perubahan berdasarkan revision.

Prinsip:
- client mengirim `baseRevision`
- server memproses op dan menaikkan `serverRevision`
- server mengembalikan revision baru dan ack
- client hanya menandai op selesai setelah ack berhasil

Cloud tidak lagi dianggap snapshot terakhir yang langsung boleh overwrite local state.

### 4. Snapshot Checkpoints
Snapshot penuh tetap ada, tapi hanya sebagai checkpoint.

Tujuan:
- load dokumen lebih cepat
- recovery lebih sederhana
- menghindari replay op yang terlalu panjang

Strategi:
- setiap N operation atau setelah idle period, server membuat snapshot baru
- dokumen dibangun dari snapshot terakhir + op setelahnya

### 5. Presence and Collaboration Layer
Kolaborasi realtime dipisah dari document persistence.

Presence channel berisi:
- cursor
- viewport
- selection
- online presence

Document sync channel berisi:
- operation batch
- revision ack
- remote changes

Ini penting supaya presence yang sangat sering berubah tidak membebani penyimpanan dokumen.

## Save Lifecycle
### Single-player flow
1. User mengubah canvas.
2. Perubahan langsung diterapkan ke local runtime state.
3. Operation ditulis ke IndexedDB queue.
4. UI langsung terasa tersimpan, tanpa menunggu network.
5. Sync worker mengirim batch op ke server.
6. Server mengembalikan revision baru.
7. Queue di-local ditandai acked.
8. Periodically, server membuat snapshot checkpoint.

### Reconnect flow
1. Client buka workspace.
2. Load snapshot lokal terbaru dulu.
3. Tampilkan board secepat mungkin.
4. Kirim pending local ops yang belum ack.
5. Ambil remote ops yang revision-nya lebih baru.
6. Merge sesuai revision policy.
7. Update local store dan UI.

### Tab switch or visibility change
Tab blur tidak boleh memicu full overwrite dari cloud.

Aturan:
- blur hanya flush queue jika perlu
- focus hanya fetch delta ops sejak revision terakhir
- jangan apply full snapshot cloud jika local queue belum kosong

## Conflict Policy
### Phase 1: single-user safe sync
Target awal bukan full collab, tapi no-data-loss.

Aturan:
- local pending ops selalu dipertahankan
- remote snapshot lama tidak boleh overwrite local queue
- hanya delta di atas revision yang sudah ack yang boleh masuk

### Phase 2: lightweight multi-user collaboration
Untuk collab awal, gunakan revisioned operation model dengan last-write-wins terbatas pada field tertentu.

Aman untuk awal jika dibatasi pada:
- node movement
- text changes sederhana
- edge create/delete
- frame create/update

### Phase 3: advanced collab
Jika nanti collab makin kompleks, evaluasi:
- OT
- CRDT
- atau hybrid op log + merge policy

Tidak perlu langsung masuk ke CRDT penuh pada v2 pertama.

## Performance Strategy
- UI render dari local store, bukan menunggu response cloud.
- Network sync dibatch per 300-1000 ms.
- Snapshot penuh tidak dikirim setiap perubahan kecil.
- Presence channel dipisah dari document channel.
- Viewport tidak ikut memicu save dokumen utama.
- Serialization dilakukan pada worker path jika payload mulai besar.
- Large board load memakai checkpoint + delta, bukan replay dari nol terus-menerus.

## Data Model Proposal
### Local workspace document
- workspaceId
- snapshot
- serverRevision
- pendingOps[]
- lastSyncedAt
- localUpdatedAt

### Cloud tables (conceptual)
#### `workspaces`
- id
- user_id
- title
- latest_snapshot
- latest_snapshot_revision
- updated_at

#### `workspace_ops`
- id
- workspace_id
- base_revision
- new_revision
- actor_id
- op_batch
- created_at

#### `workspace_presence`
- workspace_id
- actor_id
- cursor
- viewport
- selection
- updated_at

Catatan:
Untuk tahap awal, presence bahkan tidak perlu disimpan permanen. Bisa cukup di channel realtime.

## Rollout Plan
### Phase A: No-data-loss foundation
- Tambahkan IndexedDB workspace cache
- Tambahkan pending ops queue
- Pisahkan viewport state dari save dokumen
- Hentikan blind full overwrite dari refresh/focus sync

### Phase B: Incremental cloud sync
- Tambahkan server revision
- Ganti autosave snapshot menjadi op batch + checkpoint
- Tambahkan ack and retry policy

### Phase C: Collaboration-ready backend
- Presence channel
- Remote op subscription
- Delta apply

### Phase D: True collaboration
- Remote cursors
- Presence avatars
- Concurrent editing policy

## Success Metrics
- Tidak ada lagi laporan node hilang setelah tab switch.
- Reconnect tidak menimpa kerja lokal.
- Autosave latency terasa instan di UI.
- Payload network rata-rata turun signifikan dibanding snapshot penuh.
- Board besar tetap responsif.
- Fondasi siap dipakai untuk collab tanpa rewrite total.

## Risks
- Menambah kompleksitas sinkronisasi dibanding snapshot sederhana.
- Perlu migrasi bertahap dari model save lama.
- Perlu disiplin pemisahan antara UI state, document state, dan presence state.

## Recommendation
Jangan lanjut menambal full snapshot save yang sekarang sebagai fondasi jangka panjang.

Pilihan terbaik untuk Paapan adalah:
- local-first document model
- incremental op queue
- revisioned cloud sync
- checkpoint snapshot
- presence channel terpisah

Dengan ini, Paapan bisa menyelesaikan masalah kehilangan perubahan sekarang dan sekaligus punya landasan nyata untuk fitur collaboration nanti.

## Suggested Next Step
Buat implementation plan v2 bertahap dengan target awal:
1. IndexedDB local document cache
2. pending operations queue
3. revision contract server
4. stop full overwrite on focus refresh
5. checkpoint snapshot strategy
