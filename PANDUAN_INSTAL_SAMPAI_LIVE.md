# NF Command Center — Panduan Instal Sampai LIVE (Vercel)

Tujuan akhir: app bisa dibuka tim lewat URL seperti
`https://nf-command-center.vercel.app`, tersambung Google Sheet, dengan
tombol AI yang berfungsi.

Estimasi waktu pertama kali: ~45 menit. Ikuti urut, jangan loncat.

---

## PETA BESAR (3 lapisan yang harus hidup)

```
1. DATA      → Google Sheet + Apps Script   (panduan_setup.md)
2. APP       → kode React (folder ini)       → di-host di Vercel
3. AI        → API key Anthropic             → disimpan di Vercel
```

Lapisan 1 sudah dibahas di `panduan_setup.md`. Pastikan itu BERES dulu
(Web app URL + token sudah kamu punya). Dokumen ini fokus lapisan 2 & 3.

---

## TAHAP 0 — Yang harus sudah ada

- [ ] Node.js terpasang (cek: buka terminal, ketik `node -v` → muncul versi)
      Kalau belum: unduh di nodejs.org (pilih LTS), install, tutup-buka terminal.
- [ ] Akun GitHub (github.com) — gratis
- [ ] Akun Vercel (vercel.com) — daftar pakai GitHub, gratis
- [ ] Web app URL + token dari Apps Script (lapisan 1)
- [ ] API key Anthropic (console.anthropic.com → API Keys → Create Key)
      *Simpan baik-baik, hanya muncul sekali.*

---

## TAHAP 1 — Siapkan kode di komputer

1. Buat folder kosong, mis. `nf-command-center`.
2. Masukkan semua file dari paket ini ke dalamnya, dengan struktur PERSIS:

```
nf-command-center/
├── index.html
├── package.json
├── vite.config.js
├── api/
│   └── advice.js
└── src/
    ├── main.jsx
    └── App.jsx
```

3. Buka folder itu di terminal. (Windows: klik kanan folder → "Open in Terminal".
   Mac: di Terminal ketik `cd ` lalu seret foldernya, Enter.)

4. Isi sambungan ke Sheet. Buka `src/App.jsx`, cari baris paling atas:
   ```js
   const SHEET_API_URL = "TEMPEL_WEB_APP_URL_DI_SINI";
   const SHEET_TOKEN   = "TEMPEL_TOKEN_YANG_SAMA";
   ```
   Ganti dengan URL & token milikmu. Simpan.

5. (Opsional) Atur ambang bisnis NF di blok `const NF = {...}` tepat di bawahnya
   — ROAS sehat, titik reorder per produk, dll. Sesuaikan dengan caramu kerja.

---

## TAHAP 2 — Coba jalan di komputer dulu (sebelum live)

Di terminal (dalam folder tadi), jalankan dua perintah:

```bash
npm install
npm run dev
```

- `npm install` mengunduh komponen yang dibutuhkan (sekali saja, agak lama).
- `npm run dev` menyalakan app di komputer. Muncul alamat seperti
  `http://localhost:5173`. Buka di browser.

Uji:
- [ ] Login `owner` / `nf123` (dari tab users di sheet) → masuk
- [ ] Angka KPI muncul (artinya sheet tersambung)
- [ ] Centang task → cek sheet, kolom done berubah
- [ ] Login `cs` → kartu ROAS/CPWA hilang (role jalan)
- [ ] Panel "🤖 Saran" muncul dengan poin otomatis

> Catatan: di mode `npm run dev`, tombol "Minta saran AI" BELUM jalan
> (butuh /api/advice yang baru hidup di Vercel). Itu normal. Lanjut.

Hentikan dengan Ctrl+C di terminal kalau sudah puas.

---

## TAHAP 3 — Naikkan ke GitHub

1. Buat repository baru di github.com (tombol "New"), beri nama
   `nf-command-center`, set Private, jangan centang apa-apa, Create.
2. GitHub menampilkan perintah. Di terminal (dalam folder app), jalankan
   (ganti URL sesuai repo-mu):

```bash
git init
git add .
git commit -m "NF Command Center v1"
git branch -M main
git remote add origin https://github.com/USERNAME/nf-command-center.git
git push -u origin main
```

> Kalau diminta login, ikuti. Kalau `git` belum ada, install Git dari git-scm.com.

Refresh halaman repo GitHub — semua file harus muncul.

---

## TAHAP 4 — Deploy ke Vercel (jadi LIVE)

1. Buka vercel.com, login pakai GitHub.
2. Klik **Add New → Project**.
3. Pilih repo `nf-command-center` → **Import**.
4. Vercel otomatis mengenali Vite. Biarkan setelan default:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **JANGAN klik Deploy dulu.** Buka **Environment Variables**, tambahkan:
   - Name: `ANTHROPIC_API_KEY`
   - Value: (tempel API key Anthropic-mu)
   - Klik Add.
6. Sekarang klik **Deploy**. Tunggu ~1–2 menit.
7. Muncul URL live, mis. `https://nf-command-center.vercel.app`. Buka.

Uji di URL live:
- [ ] Login & KPI muncul
- [ ] Centang task tersimpan ke sheet
- [ ] Tombol "Minta saran AI" → keluar saran dari Claude (sekarang jalan!)

**Selesai. App-mu LIVE.** Bagikan URL ke tim.

---

## Cara update app nanti

Setiap kali kamu ubah kode di komputer:
```bash
git add .
git commit -m "perubahan apa"
git push
```
Vercel otomatis deploy ulang dalam ~1 menit. Tidak perlu apa-apa lagi.

---

## Masalah umum & solusi

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| KPI kosong di live | URL/token sheet salah | Cek `src/App.jsx`, push ulang |
| "ANTHROPIC_API_KEY belum diset" | Env var lupa | Vercel → Settings → Environment Variables → tambah → Redeploy |
| Tombol AI error di live | Key salah/limit habis | Cek key di console.anthropic.com |
| Login gagal | role/sheet salah | Cek tab users di sheet |
| Build gagal di Vercel | file struktur salah | Pastikan susunan folder persis Tahap 1 |
| Centang task tak tersimpan | Apps Script access bukan Anyone | Deploy ulang Apps Script (panduan_setup.md) |

---

## Keamanan & biaya (baca sebelum sebar luas)

- **API key aman**: disimpan di Vercel (server), tidak ikut ke browser.
  Karena itu AI dipanggil lewat /api/advice, bukan langsung dari frontend.
- **Biaya AI**: tiap klik "Minta saran AI" memakai sedikit kuota API Anthropic
  (berbayar sesuai pemakaian, kecil). Saran otomatis (titik berwarna) GRATIS,
  tidak pakai API. Untuk hemat, andalkan saran otomatis; pakai tombol AI
  saat butuh analisa lebih dalam.
- **Akses sheet**: level "tim internal" (URL+token). Jangan sebar token.
- Untuk data uang sangat sensitif dengan banyak pengguna luar, pertimbangkan
  naik ke Supabase (login per-orang). Itu langkah lanjutan, bukan sekarang.
