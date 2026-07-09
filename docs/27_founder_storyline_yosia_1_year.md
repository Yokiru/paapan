# Storyline Founder: Yosia dan Perjalanan 1 Tahun Paapan

> Versi: 2026-07-09
> Format: narasi realistis untuk founder story, pitch ringan, konten journey, dan bahan about/press.
> Tone: jujur, membumi, tidak berlebihan.

## 1. Premis Cerita

Paapan lahir dari kebutuhan sederhana: banyak orang punya ide, catatan, ayat, riset, pelajaran, dan rencana, tapi semua itu sering tercecer di chat, dokumen, screenshot, dan kepala sendiri.

Yosia membangun Paapan bukan sebagai "AI super app" yang menjanjikan semuanya. Ia mulai dari satu ide yang lebih kecil dan jelas:

> Bagaimana kalau orang bisa berpikir di atas papan visual, lalu AI membantu merapikan, merangkum, dan mengembangkan ide itu tanpa menghilangkan kendali manusia?

Paapan menjadi ruang kerja visual: user bisa menaruh node, menghubungkan gagasan, menambahkan teks atau gambar, lalu meminta AI membantu dari konteks yang sudah mereka susun.

Cerita 1 tahun Paapan bukan cerita startup yang langsung viral besar. Ini cerita tentang founder solo/small team yang belajar menjaga produk tetap hidup, hemat, aman, dan pelan-pelan menemukan orang yang benar-benar butuh.

## 2. Karakter Utama

### Yosia

Yosia adalah founder yang membangun Paapan dengan gaya sangat praktis:

- dekat dengan produk;
- teliti soal biaya AI dan server;
- tidak ingin user kena error saat mencoba;
- lebih percaya validasi kecil yang nyata daripada rencana besar yang belum terbukti;
- belajar bisnis sambil tetap menjaga kualitas teknis.

Kekuatan Yosia:

- cepat mengeksekusi;
- mau memeriksa detail kecil;
- peduli keamanan dan biaya;
- kuat di rasa produk: ingin Paapan terasa berguna, bukan sekadar demo AI.

Tantangan Yosia:

- harus membagi fokus antara produk, teknis, biaya, marketing, support, dan release;
- harus belajar kapan memakai free tier dan kapan upgrade;
- harus berani menjual tanpa menunggu produk sempurna;
- harus menjaga agar AI credit tidak membuat bisnis rugi.

## 3. Narasi Besar 12 Bulan

### Bab 1 - Bulan 1: Paapan mulai terlihat

Di bulan pertama, Paapan belum terlihat seperti bisnis. Ia lebih mirip eksperimen yang mulai menemukan bentuk.

Yosia menghabiskan banyak waktu bukan untuk membuat fitur ramai, tapi memastikan fondasi tidak rapuh:

- login dan reset password jalan;
- board bisa disimpan;
- node bisa dibuat dan dihubungkan;
- AI bisa menjawab dari konteks;
- credit berkurang sesuai model;
- feedback user bisa masuk;
- admin page bisa dipakai memantau hal dasar.

Ada banyak momen kecil yang tidak terlihat dari luar. Misalnya ketika satu tombol terlihat sederhana, tapi di belakangnya ada pertanyaan:

- apakah user cukup kredit?
- model AI mana yang dipakai?
- apakah context node terlalu panjang?
- apakah request ini bisa membuat biaya membengkak?
- apakah error-nya bisa dipahami user?

Bulan pertama bukan tentang growth. Bulan pertama tentang membuat Paapan tidak malu saat dibuka orang lain.

Target realistis:

- 100-150 registered user awal;
- 30-50 user aktif mencoba board;
- 3-5 user benar-benar memberi feedback bermakna;
- belum profit.

Konflik utama:

> Produk sudah bisa dicoba, tapi Yosia sadar bahwa "bisa dipakai" belum sama dengan "orang mau kembali setiap minggu".

### Bab 2 - Bulan 2: User pertama mulai menguji batas produk

Beberapa user mulai memakai Paapan dengan cara yang tidak selalu sesuai bayangan awal.

Ada yang membuat board untuk materi belajar. Ada yang memasukkan teks panjang lalu meminta AI merangkum. Ada yang mencoba menghubungkan banyak node dan bertanya dari node sebelumnya. Ada juga yang hanya menekan AI beberapa kali lalu pergi.

Dari sini Yosia melihat hal penting:

- AI tidak cukup hanya menjawab;
- AI harus memahami konteks visual;
- credit harus adil;
- jawaban panjang harus tetap dihitung;
- user Indonesia sensitif terhadap harga, tapi mau bayar jika manfaatnya terasa konkret.

Bulan ini Yosia mulai lebih serius melihat biaya. Ia tidak hanya bertanya "berapa banyak user?", tapi:

- berapa biaya AI per user aktif?
- model mana yang paling sering dipakai?
- apakah Free terlalu murah hati?
- apakah Pro terlalu berisiko?
- apakah BYOK bisa jadi jalan sehat untuk heavy user?

Target realistis:

- total registered sekitar 300;
- 80-100 free MAU;
- 5-10 paid/manual interest;
- mulai ada orang bertanya paket atau akses tambahan.

Konflik utama:

> User suka AI yang pintar, tapi AI pintar lebih mahal. Yosia harus menjaga produk terasa kuat tanpa membuat biaya liar.

### Bab 3 - Bulan 3: Open beta mulai punya ritme

Paapan mulai masuk fase yang lebih serius: bukan sekadar app lokal atau demo.

Yosia mulai menyusun checklist release:

- environment production;
- Supabase SQL;
- cron internal;
- smoke test;
- email feedback;
- admin route;
- AI credit test;
- model fallback;
- dokumentasi operasional.

Di luar produk, Yosia mulai belajar bahwa startup kecil tidak hanya butuh fitur. Ia butuh ritme.

Ritme itu sederhana:

- setiap minggu ada user baru;
- setiap bug dicatat;
- setiap biaya dicek;
- setiap feedback dibaca;
- setiap perubahan penting diuji sebelum push.

Bulan ini juga mulai terasa bahwa dokumentasi bukan formalitas. Dokumentasi menjadi cara agar Paapan tidak tergantung pada ingatan Yosia saja.

Target realistis:

- total registered sekitar 500-600;
- 150-180 free MAU;
- 15-20 paid/manual interest;
- mulai ada smoke test production rutin.

Konflik utama:

> Semakin banyak hal mulai jalan, semakin besar risiko satu perubahan kecil merusak bagian lain. Yosia harus belajar bergerak cepat tanpa ceroboh.

### Bab 4 - Bulan 4: Realita marketing muncul

Setelah produk mulai stabil, pertanyaan paling sulit muncul:

> Kalau Paapan sudah bisa dipakai, bagaimana orang tahu bahwa Paapan ada?

Yosia mulai mencoba jalur realistis untuk pasar Indonesia:

- DM creator edukasi kecil;
- posting contoh penggunaan;
- menunjukkan board sebelum-sesudah;
- membuat use case untuk mahasiswa, guru, dan content creator;
- meminta feedback, bukan langsung memaksa jualan.

Hasilnya tidak langsung besar. Banyak DM tidak dibalas. Ada yang tertarik tapi tidak sempat mencoba. Ada yang mencoba sekali lalu hilang.

Tapi beberapa orang mulai memberi sinyal:

- "Ini cocok buat rangkum materi."
- "Bisa buat ide konten."
- "Kalau bisa export rapi, menarik."
- "Kalau AI-nya bisa baca node sebelumnya, ini berguna."

Bulan ini Paapan mulai belajar bahasa pasar. Bukan lagi bahasa fitur.

Target realistis:

- total registered sekitar 900;
- 250-300 free MAU;
- 25-35 paid user/manual paid interest;
- revenue mulai ada tapi belum menutup semua biaya jika marketing jalan.

Konflik utama:

> Produk yang menurut founder jelas, belum tentu langsung jelas bagi user. Yosia harus menjelaskan manfaat dalam 10 detik pertama.

### Bab 5 - Bulan 5: Hampir break-even

Bulan kelima terasa seperti fase paling rawan.

Paapan sudah lebih rapi, tapi belum benar-benar nyaman. Ada biaya. Ada ekspektasi. Ada backlog. Ada daftar hal yang "nanti harus dibuat".

Di sisi lain, tanda-tanda sehat mulai muncul:

- ada user yang kembali;
- ada yang membuat lebih dari satu board;
- ada yang memakai AI untuk teks panjang;
- ada yang bertanya soal paket;
- ada yang memberi feedback bukan karena diminta, tapi karena mulai peduli.

Yosia mulai lebih disiplin pada angka:

- AI cost/revenue harus dijaga;
- Free tier harus dibatasi;
- Supabase Free dimanfaatkan sampai batas sehat;
- email bawaan Supabase tidak dipakai untuk public user;
- Resend/Cloudflare/Zoho dipilih berdasarkan fungsi, bukan gengsi;
- Vercel/Supabase upgrade hanya dilakukan saat memang perlu.

Target realistis:

- total registered sekitar 1.400;
- 400-450 free MAU;
- 40-50 paid user;
- net hampir break-even jika free tier dimanfaatkan.

Konflik utama:

> Yosia harus menahan keinginan upgrade semua layanan terlalu cepat. Hemat itu penting, tapi jangan sampai hemat membuat user kehilangan kepercayaan.

### Bab 6 - Bulan 6: Break-even kecil pertama

Bulan keenam adalah titik psikologis penting.

Paapan belum besar. Tapi untuk pertama kalinya, angka mulai menunjukkan bahwa produk ini bisa hidup.

Revenue kecil mulai menutup biaya dasar. Tidak semua bulan pasti mulus, tapi Paapan tidak lagi terasa seperti lubang biaya murni.

Yosia mulai melihat tiga kelompok user:

1. Free user yang hanya eksplorasi.
2. Plus user yang butuh AI dan export untuk tugas/kerja.
3. API Pro/BYOK user yang paham AI dan lebih cocok membawa key sendiri.

Insight penting bulan ini:

> Paket terbaik bukan selalu paket paling mahal. Paket terbaik adalah yang paling sesuai perilaku user dan paling sehat untuk margin.

Plus menjadi paket utama. API Pro menjadi paket strategis. Pro tetap ada, tapi dijaga dengan fair-use.

Target realistis:

- total registered sekitar 2.000;
- 600-650 free MAU;
- 60-75 paid user;
- net positif kecil;
- mulai ada rasa percaya diri untuk lanjut.

Konflik utama:

> Break-even bukan akhir. Break-even hanya memberi napas untuk belajar lebih lama.

### Bab 7 - Bulan 7: Paapan mulai memilih fokus

Setelah setengah tahun, godaan terbesar adalah membuat terlalu banyak fitur.

Ada banyak ide:

- collaboration realtime;
- template board;
- team workspace;
- payment otomatis;
- referral;
- integrasi Notion;
- AI image lebih kuat;
- mobile experience;
- public gallery.

Tapi Yosia mulai sadar: fitur baru bukan selalu jawaban.

Yang lebih penting:

- user paham apa manfaat Paapan;
- board tidak hilang;
- AI credit adil;
- onboarding mudah;
- contoh penggunaan jelas;
- pricing tidak membingungkan;
- support cepat.

Bulan ini Paapan mulai memilih use case utama:

- rangkum materi panjang;
- pecah ide menjadi node;
- susun outline konten;
- brainstorming visual;
- belajar dengan hubungan antar konsep;
- export/share hasil.

Target realistis:

- total registered sekitar 2.800;
- 850-900 free MAU;
- 90-100 paid user;
- mulai ada konten edukasi rutin.

Konflik utama:

> Founder harus berani berkata "belum sekarang" pada fitur bagus yang belum penting.

### Bab 8 - Bulan 8: User mulai membawa cerita mereka sendiri

Di bulan kedelapan, Paapan mulai punya cerita dari user.

Ada mahasiswa yang memakai Paapan untuk merangkum bahan kuliah. Ada kreator yang menyusun ide konten mingguan. Ada orang yang menggunakan board untuk memahami bacaan panjang. Ada yang memakai AI untuk menyederhanakan teks yang sebelumnya terasa berat.

Cerita-cerita ini lebih kuat daripada daftar fitur.

Yosia mulai mengubah cara promosi:

Daripada berkata:

> "Paapan punya AI node, share board, export, dan model selection."

Ia mulai berkata:

> "Masukkan materi panjang, pecah jadi bagian kecil, hubungkan ide, lalu minta AI bantu merangkum dari konteksmu."

Ini lebih mudah dipahami.

Target realistis:

- total registered sekitar 3.800;
- 1.100-1.250 free MAU;
- 130-145 paid user;
- mulai ada repeat usage yang jelas.

Konflik utama:

> Paapan harus menjual outcome, bukan fitur.

### Bab 9 - Bulan 9: Operasional mulai terasa seperti bisnis

Di bulan kesembilan, Paapan mulai terlihat seperti bisnis kecil yang hidup.

Belum besar, tapi sudah punya pola:

- user masuk dari konten/outreach;
- sebagian mencoba AI;
- sebagian membuat board;
- sebagian kembali;
- sebagian bertanya paket;
- sebagian churn.

Churn mulai menjadi pelajaran. Tidak semua user berhenti karena produk buruk. Sebagian hanya tidak butuh bulan itu. Sebagian mahasiswa aktif saat musim tugas, lalu menghilang saat libur.

Yosia mulai memikirkan lifecycle:

- bagaimana membuat user kembali?
- apakah template bisa membantu?
- apakah reminder email perlu?
- apakah annual plan cocok?
- apakah credit top-up lebih cocok daripada subscription untuk sebagian user?

Target realistis:

- total registered sekitar 5.000;
- 1.500-1.600 free MAU;
- 175-190 paid user;
- net bulanan mulai terasa berarti.

Konflik utama:

> Mendapat user sulit. Membuat user kembali lebih sulit lagi.

### Bab 10 - Bulan 10: Upgrade yang benar-benar perlu

Di bulan kesepuluh, beberapa free tier mulai dipantau lebih serius.

Yosia tidak upgrade karena panik. Ia upgrade karena data menunjukkan waktunya.

Misalnya:

- storage gambar mulai mendekati batas;
- database membesar;
- paid user melewati batas psikologis;
- reliability mulai lebih penting;
- support user bayar tidak boleh terganggu.

Di titik ini, upgrade Supabase Pro atau layanan lain bukan lagi terasa seperti biaya. Itu terasa seperti asuransi operasional.

Yosia juga mulai lebih tegas pada AI usage:

- context panjang diberi surcharge;
- web search tidak boleh terlalu murah;
- Pro model dipantau;
- BYOK didorong untuk heavy user;
- admin melihat cost per user.

Target realistis:

- total registered sekitar 6.400;
- 2.000 free MAU;
- 225-240 paid user;
- infra mulai naik, tapi revenue sudah mampu menanggung.

Konflik utama:

> Upgrade terbaik bukan yang paling cepat, tapi yang datang tepat ketika risiko mulai lebih mahal daripada biaya langganan.

### Bab 11 - Bulan 11: Paapan mulai punya identitas

Di bulan kesebelas, Paapan tidak lagi hanya disebut "canvas AI".

Paapan mulai punya identitas:

> papan berpikir visual untuk belajar, merangkum, dan menyusun ide dengan bantuan AI.

Yosia mulai lebih jelas dalam komunikasi:

- untuk mahasiswa: pahami materi lebih cepat;
- untuk kreator: susun ide konten dari riset panjang;
- untuk guru/mentor: jelaskan topik kompleks secara visual;
- untuk worker: ubah catatan berantakan jadi struktur.

Bulan ini Paapan mulai melihat peluang berikutnya:

- template board;
- paket edukasi;
- komunitas pengguna;
- annual plan;
- team kecil;
- integrasi ekspor yang lebih rapi.

Tapi Yosia tetap menjaga prinsip:

> Jangan membangun fitur growth sebelum core experience cukup kuat.

Target realistis:

- total registered sekitar 8.000;
- 2.500 free MAU;
- 280-300 paid user;
- MRR mulai mendekati level yang bisa membiayai eksperimen growth.

Konflik utama:

> Saat produk mulai punya peluang, fokus justru semakin penting.

### Bab 12 - Bulan 12: Tahun pertama yang tidak sempurna, tapi nyata

Setahun setelah Paapan mulai dibuka, hasilnya tidak seperti cerita startup yang tiba-tiba menjadi unicorn.

Hasilnya lebih sederhana, tapi lebih nyata:

- hampir 10.000 registered user;
- sekitar 3.000 free monthly active user;
- sekitar 350-370 paid user;
- MRR sekitar Rp14-15 juta;
- net bulanan sekitar Rp10 juta dalam skenario realistis hemat;
- produk punya arah;
- biaya AI lebih terkendali;
- user mulai memahami manfaat Paapan;
- Yosia punya data, bukan hanya perasaan.

Yang paling berubah bukan hanya Paapan. Yosia juga berubah.

Di awal, ia bertanya:

> "Apakah aplikasi ini bisa jalan?"

Setelah satu tahun, pertanyaannya menjadi:

> "Bagaimana membuat orang yang tepat merasakan manfaat Paapan setiap minggu, tanpa membuat bisnis ini rapuh?"

Itu pertanyaan founder yang lebih matang.

## 4. Timeline Singkat 1 Tahun

| Bulan | Fase | Fokus | Momen penting |
|---|---|---|---|
| 1 | Foundation | Stabilitas core app | Paapan bisa dicoba user luar. |
| 2 | Early usage | AI credit dan context | User mulai menguji prompt panjang. |
| 3 | Release hardening | Env, SQL, cron, smoke test | Produk lebih siap production. |
| 4 | Marketing reality | Creator outreach | Belajar menjual outcome. |
| 5 | Cost discipline | Free tier dan pricing | Hampir break-even. |
| 6 | First break-even | Paket Plus/API Pro/Pro | Net positif kecil. |
| 7 | Focus | Use case utama | Menolak fitur yang belum penting. |
| 8 | User stories | Konten berbasis outcome | Cerita user mulai muncul. |
| 9 | Operations | Churn dan retention | Bisnis kecil mulai punya ritme. |
| 10 | Upgrade timing | Supabase/infra/AI guardrail | Upgrade hanya saat perlu. |
| 11 | Identity | Positioning | Paapan punya kalimat produk yang jelas. |
| 12 | Year-one proof | Data dan repeatability | MRR realistis Rp14-15 juta. |

## 5. Versi Pendek untuk About / Pitch

Paapan dibangun oleh Yosia sebagai papan berpikir visual untuk orang yang ingin memahami dan menyusun ide dengan lebih jelas.

Awalnya Paapan hanya eksperimen: canvas, node, dan AI sederhana. Tapi dari penggunaan awal, Yosia melihat pola yang kuat. Banyak orang tidak kekurangan informasi; mereka kekurangan ruang untuk menghubungkan informasi itu.

Selama tahun pertama, Paapan berkembang pelan tapi nyata. Fokusnya bukan mengejar hype AI, melainkan membuat AI berguna di dalam konteks kerja user: teks yang mereka tulis, node yang mereka hubungkan, dan board yang mereka bangun sendiri.

Perjalanan itu tidak selalu rapi. Yosia harus menjaga biaya AI, memilih kapan memakai free tier dan kapan upgrade, memperbaiki bug production, menata email dan database, serta belajar memasarkan produk ke pasar Indonesia yang sensitif harga tapi menghargai manfaat konkret.

Setelah satu tahun, Paapan menemukan arah: menjadi papan visual untuk belajar, merangkum, brainstorming, dan menyusun ide dengan bantuan AI yang tetap hemat dan terkendali.

## 6. Versi Sangat Pendek untuk Konten

Setahun pertama Paapan bukan cerita viral instan.

Ini cerita Yosia membangun produk pelan-pelan: memastikan board tidak hilang, AI tidak membuat biaya bocor, user bisa login, feedback masuk, credit adil, dan fitur benar-benar membantu orang berpikir.

Dari puluhan user awal, Paapan belajar bahwa banyak orang tidak butuh AI yang sekadar menjawab. Mereka butuh ruang visual untuk menyusun pikiran, lalu AI yang memahami konteks itu.

Itulah arah Paapan: papan berpikir visual untuk belajar, merangkum, dan mengembangkan ide.

## 7. Konflik Realistis yang Bisa Diangkat dalam Storytelling

Gunakan konflik ini untuk konten founder journey:

1. Produk bisa jalan, tapi belum tentu orang paham manfaatnya.
2. AI membuat produk terasa canggih, tapi juga bisa membuat biaya bocor.
3. Free tier membantu hemat, tapi tidak semua free tier layak untuk production.
4. User Indonesia suka harga murah, tapi tetap mau bayar jika manfaatnya langsung terasa.
5. Founder ingin membuat banyak fitur, tapi produk butuh fokus.
6. Growth bukan hanya tambah user; growth juga berarti user kembali.
7. Upgrade layanan bukan gengsi, tapi keputusan risiko.
8. Dokumentasi terasa membosankan sampai suatu hari menyelamatkan release.

## 8. Angle Konten 12 Post

| Post | Hook |
|---|---|
| 1 | "Aku membuat Paapan karena catatan dan ide sering tercecer." |
| 2 | "AI yang menjawab saja tidak cukup. AI harus paham konteks berpikirmu." |
| 3 | "Hal tersulit bukan bikin fitur AI, tapi menjaga biayanya tetap sehat." |
| 4 | "Kenapa Paapan pakai credit, bukan unlimited AI?" |
| 5 | "Free tier itu berguna, tapi tidak semua aman untuk production." |
| 6 | "Bulan pertama Paapan: bukan growth, tapi membuat app tidak malu dibuka orang." |
| 7 | "User pertama mengajari kami bahwa board visual lebih penting daripada chat biasa." |
| 8 | "Kami hampir salah: menjual fitur, bukan manfaat." |
| 9 | "Kenapa Plus jadi paket utama Paapan?" |
| 10 | "BYOK: cara membuat AI tetap powerful tanpa membakar biaya." |
| 11 | "Setahun Paapan: kecil, belum sempurna, tapi nyata." |
| 12 | "Arah Paapan berikutnya: membantu orang berpikir lebih jelas." |

## 9. Catatan Kejujuran Brand

Hal yang sebaiknya tidak diklaim:

- jangan bilang Paapan sudah besar jika datanya belum begitu;
- jangan bilang profitable besar jika masih tahap awal;
- jangan bilang AI unlimited;
- jangan bilang semua data selalu private jika belum menjelaskan vendor AI dan BYOK;
- jangan bilang cocok untuk semua orang.

Hal yang aman diklaim:

- Paapan sedang dibangun untuk membantu orang menyusun ide secara visual;
- AI dipakai sebagai asisten konteks, bukan pengganti pikiran user;
- sistem credit dibuat agar penggunaan lebih adil dan biaya lebih terkendali;
- founder membangun dengan pendekatan hemat, teliti, dan bertahap;
- Paapan fokus dulu pada pasar Indonesia dan use case belajar/kreator/solo worker.

## 10. Penutup Naratif

Pada akhirnya, cerita Paapan bukan tentang Yosia yang langsung menemukan jawaban.

Cerita Paapan adalah tentang Yosia yang terus memperbaiki pertanyaannya.

Dari:

> "Bagaimana membuat AI di canvas?"

Menjadi:

> "Bagaimana membantu orang berpikir lebih jelas, dengan AI yang berguna, biaya yang sehat, dan produk yang bisa dipercaya?"

Pertanyaan kedua itulah yang membuat Paapan punya peluang untuk bertahan lebih lama dari sekadar tren AI.
