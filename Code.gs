/**
 * ============================================================
 * NF COMMAND CENTER — BACKEND (Google Apps Script)
 * ============================================================
 * Tempel kode ini di: Sheet > Extensions > Apps Script.
 * Lalu Deploy > New deployment > Web app.
 *
 * Fungsi: jembatan aman antara web app (React) dan Google Sheet.
 *   - Baca: tasks, kpi, reports, stock, users
 *   - Tulis: centang task, simpan poin
 *   - Login & role dijaga DI SINI (bukan di frontend)
 *
 * Struktur Sheet yang dibutuhkan (lihat panduan_setup.md):
 *   Tab "users"   : id | nama | role | password
 *   Tab "tasks"   : id | text | divisi | prog | pts | done
 *   Tab "kpi"     : id | label | value | delta | up | uang | icon
 *   Tab "reports" : divisi | label | nilai | uang
 *   Tab "stock"   : name | qty | min
 *   Tab "meta"    : key | value   (mis. poinDasar | 2450)
 * ============================================================
 */

// Token sederhana supaya tidak sembarang orang panggil API ini.
// Ganti dengan teks acak panjang milikmu sendiri.
const API_TOKEN = "GANTI_DENGAN_TOKEN_RAHASIA_PANJANG_123";

// Daftar hak akses per role (sama seperti versi demo, tapi sekarang di server)
const ROLES = {
  owner:    { nama: "Owner",          lihatUang: true,  menu: ["dashboard","task","cs","ads","produk","media"] },
  keuangan: { nama: "Admin Keuangan", lihatUang: true,  menu: ["dashboard","task","cs","ads","produk","media"] },
  cs:       { nama: "CS",             lihatUang: false, menu: ["dashboard","task","cs"] },
  ads:      { nama: "Ads / Iklan",    lihatUang: false, menu: ["dashboard","task","ads"] },
  produksi: { nama: "Produksi & Packing", lihatUang: false, menu: ["dashboard","task","produk"] },
};

// ---------- Util baca tab jadi array objek ----------
function readTab(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const head = data[0].map(String);
  return data.slice(1).map(row => {
    const o = {};
    head.forEach((h, i) => (o[h] = row[i]));
    return o;
  });
}

function getMeta(key, fallback) {
  const rows = readTab("meta");
  const m = rows.find(r => String(r.key) === key);
  return m ? m.value : fallback;
}

// ---------- GET: untuk membaca data ----------
function doGet(e) {
  try {
    const p = e.parameter;
    if (p.token !== API_TOKEN) return json({ ok: false, error: "Token salah" });

    const action = p.action;

    if (action === "login") {
      const users = readTab("users");
      const u = users.find(x => String(x.id).toLowerCase() === String(p.id).toLowerCase());
      if (!u || String(u.password) !== String(p.password)) {
        return json({ ok: false, error: "ID atau password salah." });
      }
      const izin = ROLES[u.role] || ROLES.cs;
      return json({ ok: true, user: { id: u.id, nama: u.nama, role: u.role, izin } });
    }

    if (action === "dashboard") {
      const role = p.role;
      const izin = ROLES[role] || ROLES.cs;
      let kpi = readTab("kpi").map(k => ({
        id: k.id, label: k.label, value: k.value, delta: k.delta,
        up: String(k.up).toUpperCase() === "TRUE",
        uang: String(k.uang).toUpperCase() === "TRUE",
        icon: k.icon,
      }));
      // Penjagaan: baris uang hanya untuk role yang boleh
      if (!izin.lihatUang) kpi = kpi.filter(k => !k.uang);
      return json({ ok: true, kpi });
    }

    if (action === "tasks") {
      const tasks = readTab("tasks").map(t => ({
        id: Number(t.id), text: t.text, divisi: t.divisi, prog: t.prog,
        pts: Number(t.pts), done: String(t.done).toUpperCase() === "TRUE",
      }));
      const poinDasar = Number(getMeta("poinDasar", 0));
      return json({ ok: true, tasks, poinDasar });
    }

    if (action === "report") {
      const role = p.role, divisi = p.divisi;
      const izin = ROLES[role] || ROLES.cs;
      let rows = readTab("reports").filter(r => r.divisi === divisi);
      if (!izin.lihatUang) rows = rows.filter(r => String(r.uang).toUpperCase() !== "TRUE");
      return json({ ok: true, rows: rows.map(r => [r.label, r.nilai]) });
    }

    if (action === "stock") {
      const stock = readTab("stock").map(s => ({
        name: s.name, qty: Number(s.qty), min: Number(s.min),
      }));
      return json({ ok: true, stock });
    }

    return json({ ok: false, error: "Action tidak dikenal" });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ---------- POST: untuk menulis balik ke sheet ----------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (body.token !== API_TOKEN) return json({ ok: false, error: "Token salah" });

    if (body.action === "toggleTask") {
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("tasks");
      const data = sh.getDataRange().getValues();
      const head = data[0].map(String);
      const idCol = head.indexOf("id");
      const doneCol = head.indexOf("done");
      for (let r = 1; r < data.length; r++) {
        if (Number(data[r][idCol]) === Number(body.id)) {
          const cur = String(data[r][doneCol]).toUpperCase() === "TRUE";
          sh.getRange(r + 1, doneCol + 1).setValue(!cur); // tulis balik
          return json({ ok: true, id: body.id, done: !cur });
        }
      }
      return json({ ok: false, error: "Task tidak ditemukan" });
    }

    return json({ ok: false, error: "Action tidak dikenal" });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
