# NF Command Center — Panduan Sambung ke Google Sheet (LIVE, baca + tulis)

Ikuti urut. Sekali set, app langsung baca/tulis ke sheet.

---

## BAGIAN A — Siapkan Google Sheet

1. Buat Google Sheet baru, beri nama bebas (mis. "NF Command Center DB").
2. Buat **6 tab** dengan nama PERSIS seperti di bawah (huruf kecil semua),
   dan baris pertama tiap tab adalah JUDUL KOLOM (persis).

### Tab `users`
| id | nama | role | password |
|----|------|------|----------|
| owner | Sam (Owner) | owner | nf123 |
| keuangan | Bintang | keuangan | nf123 |
| cs | Tim CS | cs | nf123 |
| ads | Pengiklan | ads | nf123 |
| produksi | Mahmud & Ayip | produksi | nf123 |

> role harus salah satu dari: owner, keuangan, cs, ads, produksi

### Tab `tasks`
| id | text | divisi | prog | pts | done |
|----|------|--------|------|-----|------|
| 1 | Balas chat pelanggan | cs | 12/15 | 30 | FALSE |
| 2 | Buat konten produk terbaru | content | 2/3 | 40 | FALSE |
| 3 | Optimasi iklan Katilayu | ads | 1/1 | 25 | TRUE |
| 4 | Cek pesanan baru marketplace | marketplace | 18/20 | 20 | FALSE |
| 5 | Produksi umpan Magic Strike | produksi | 65/120 | 50 | FALSE |
| 6 | Packing & siap kirim | packing | 23/30 | 35 | FALSE |

> Kolom `done` isi TRUE / FALSE. Saat dicentang di app, sel ini berubah otomatis.

### Tab `kpi`
| id | label | value | delta | up | uang | icon |
|----|-------|-------|-------|----|----|------|
| leads | Leads | 128 | +12% | TRUE | FALSE | users |
| closing | Closing | 32 | +8% | TRUE | FALSE | target |
| roas | ROAS | 4.12 | +0.72 | TRUE | TRUE | tup |
| cpwa | CPWA | 8.430 | -5% | TRUE | TRUE | coins |
| omzet | Omzet Hari Ini | Rp 6,4jt | +9% | TRUE | TRUE | coins |
| stok | Stok Menipis | 7 | perlu cek | FALSE | FALSE | box |

> `uang = TRUE` artinya hanya owner & keuangan yang bisa lihat baris ini.
> `icon` pilih dari: users, target, tup, coins, box

### Tab `reports`
| divisi | label | nilai | uang |
|--------|-------|-------|------|
| cs | Chat masuk | 210 | FALSE |
| cs | Dibalas | 198 | FALSE |
| cs | Rata-rata respon | 4 mnt | FALSE |
| cs | Rating layanan | 4.8 / 5 | FALSE |
| ads | Spend hari ini | Rp 1.080.000 | TRUE |
| ads | ROAS | 4.12 | TRUE |
| ads | CPWA | Rp 8.430 | TRUE |
| ads | Leads dari iklan | 92 | FALSE |
| media | Konten dibuat | 2 / 3 | FALSE |
| media | Jadwal posting | 3 terjadwal | FALSE |

### Tab `stock`
| name | qty | min |
|------|-----|-----|
| Katilayu | 1250 | 300 |
| Magic Strike | 980 | 300 |
| Jitu Ampuh | 760 | 300 |
| Umpan Wangi | 240 | 300 |
| NF Bait Mix | 120 | 300 |

### Tab `meta`
| key | value |
|-----|-------|
| poinDasar | 2450 |

---

## BAGIAN B — Pasang backend (Apps Script)

1. Di Sheet: menu **Extensions → Apps Script**.
2. Hapus isi default, **tempel seluruh isi `Code.gs`**.
3. Di baris atas, ganti token:
   ```
   const API_TOKEN = "GANTI_DENGAN_TOKEN_RAHASIA_PANJANG_123";
   ```
   Ganti dengan teks acak panjang buatanmu (mis. "nf-7f3a9k2p-rumah-nf3").
   Catat token ini — nanti dipakai di app.
4. Klik **Deploy → New deployment**.
5. Pilih tipe: **Web app**.
6. Setelan:
   - Description: NF Command Center API
   - Execute as: **Me** (akun kamu)
   - Who has access: **Anyone**  ← penting agar app bisa memanggil
7. Klik **Deploy**, izinkan akses saat diminta (login Google kamu).
8. Salin **Web app URL** (bentuknya `https://script.google.com/macros/s/AKf.../exec`).
   Catat URL ini.

> Catatan keamanan: "Anyone" artinya siapa pun yang TAHU URL + TOKEN bisa
> mengakses. Token-lah yang menjaga. Jangan sebar URL+token ke publik.
> Untuk data uang sungguhan yang sensitif, nanti bisa naik ke Supabase
> dengan login per-orang. Mode ini cocok untuk tim internal kecil.

---

## BAGIAN C — Sambungkan ke App

Buka file app React (`nf-command-center-sheets.jsx`), di bagian atas isi dua baris:

```js
const SHEET_API_URL = "TEMPEL_WEB_APP_URL_DI_SINI";
const SHEET_TOKEN   = "TEMPEL_TOKEN_YANG_SAMA";
```

Selesai. App akan:
- **Login** → cek ke tab `users`
- **Dashboard / Laporan** → baca tab `kpi`, `reports`, dengan filter role
- **Task** → baca tab `tasks`; saat dicentang, sel `done` di sheet ikut berubah
- **Stok** → baca tab `stock`

---

## Cara menguji cepat

1. Buka Web app URL kamu di browser, tambahkan di belakangnya:
   ```
   ?token=TOKEN_KAMU&action=tasks
   ```
   Kalau muncul JSON berisi daftar task → backend jalan.
2. Jalankan app, login `owner` / `nf123`.
3. Centang sebuah task di app → cek tab `tasks` di sheet, kolom `done`
   pada baris itu berubah jadi TRUE. Berhasil = baca + tulis sudah hidup.

---

## Kalau ada masalah

| Gejala | Penyebab umum | Solusi |
|--------|---------------|--------|
| "Token salah" | Token app ≠ token script | Samakan persis dua-duanya |
| Data kosong | Nama tab / kolom beda | Cek ejaan tab & judul kolom (huruf kecil) |
| Login gagal terus | role salah ketik | role harus: owner/keuangan/cs/ads/produksi |
| Gagal akses URL | Access bukan "Anyone" | Deploy ulang, set Who has access = Anyone |
| Ubah kode tapi tak berubah | deployment lama | Deploy → Manage deployments → Edit → New version |
