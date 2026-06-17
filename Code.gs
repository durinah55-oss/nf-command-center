/**
 * ============================================================
 * NF COMMAND CENTER — BACKEND (Google Apps Script)
 * ============================================================
 * Tempel kode ini di: Sheet > Extensions > Apps Script.
 * Lalu Deploy > New deployment > Web app.
 *
 * Fungsi: jembatan aman antara web app (React) dan Google Sheet.
 *   - Baca: tasks, kpi, reports, stock, users, mp/reseller (sheet Resi)
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
  owner:    { nama: "Owner",          lihatUang: true,  menu: ["dashboard","task","cs","ads","produk","media","mp"] },
  keuangan: { nama: "Admin Keuangan", lihatUang: true,  menu: ["dashboard","task","cs","ads","produk","media","mp"] },
  cs:       { nama: "CS",             lihatUang: false, menu: ["dashboard","task","cs"] },
  ads:      { nama: "Ads / Iklan",    lihatUang: false, menu: ["dashboard","task","ads"] },
  produksi: { nama: "Produksi & Packing", lihatUang: false, menu: ["dashboard","task","produk"] },
  mp:       { nama: "Marketplace",    lihatUang: false, menu: ["dashboard","mp"] },
};

/* ===========
   MP & RESELLER — sheet Resi terpisah (Tahap 1: baca saja)
   =========== */
const RESI_SHEET_ID = "13dxQv1rnoIKbdgNoKpFQ9YsIPNICvkc8aWcuqnDkLgQ";
const RESI_MONTHS = ["Januari","Februar","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function getResiTabNames() {
  const d = new Date();
  return {
    mp: RESI_MONTHS[d.getMonth()] + " " + d.getFullYear(),
    reseller: RESI_MONTHS[d.getMonth()] + " (Reseller)",
  };
}

function mpAllowed_(role) {
  return ["owner", "keuangan", "mp"].indexOf(String(role)) >= 0;
}

function formatResiDate_(v) {
  if (v instanceof Date) {
    const dd = ("0" + v.getDate()).slice(-2);
    const mm = ("0" + (v.getMonth() + 1)).slice(-2);
    return dd + "/" + mm + "/" + String(v.getFullYear()).slice(-2);
  }
  return String(v || "");
}

function parseHarga_(v) {
  if (typeof v === "number" && !isNaN(v)) return v;
  return Number(String(v).replace(/[^0-9.-]/g, "")) || 0;
}

function readResiOrders_(tabName) {
  const ss = SpreadsheetApp.openById(RESI_SHEET_ID);
  const sh = ss.getSheetByName(tabName);
  if (!sh) return { orders: [], missing: true };
  const data = sh.getDataRange().getValues();
  const orders = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const invoice = String(row[2] || "").trim();
    const nama = String(row[3] || "").trim();
    if (!invoice && !nama) continue;
    orders.push({
      row: r + 1,
      tanggal: formatResiDate_(row[1]),
      invoice: invoice,
      nama: nama,
      noResi: String(row[4] || ""),
      kota: String(row[5] || ""),
      service: String(row[8] || ""),
      jumlah: row[9] || "",
      barang: String(row[10] || ""),
      lokasi: String(row[11] || ""),
      harga: parseHarga_(row[12]),
      pic: String(row[15] || ""),
    });
  }
  return { orders: orders, missing: false };
}

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

    if (action === "mp_list") {
      const role = p.role;
      if (!mpAllowed_(role)) return json({ ok: false, error: "Tidak punya akses MP/Reseller." });
      const izin = ROLES[role] || ROLES.cs;
      const channel = p.channel || "all";
      const tabs = getResiTabNames();
      let orders = [];
      const warnings = [];

      if (channel === "mp" || channel === "all") {
        const r = readResiOrders_(tabs.mp);
        if (r.missing) warnings.push("Tab tidak ditemukan: " + tabs.mp);
        else orders = orders.concat(r.orders.map(o => ({ ...o, channel: "mp" })));
      }
      if (channel === "reseller" || channel === "all") {
        const r = readResiOrders_(tabs.reseller);
        if (r.missing) warnings.push("Tab tidak ditemukan: " + tabs.reseller);
        else orders = orders.concat(r.orders.map(o => ({ ...o, channel: "reseller" })));
      }

      const countMp = orders.filter(o => o.channel === "mp").length;
      const countReseller = orders.filter(o => o.channel === "reseller").length;
      let summary = {
        tabs: tabs,
        countMp: countMp,
        countReseller: countReseller,
        total: orders.length,
        omzetMp: orders.filter(o => o.channel === "mp").reduce((s, o) => s + o.harga, 0),
        omzetReseller: orders.filter(o => o.channel === "reseller").reduce((s, o) => s + o.harga, 0),
      };

      if (!izin.lihatUang) {
        orders = orders.map(o => ({ ...o, harga: null }));
        summary = { ...summary, omzetMp: null, omzetReseller: null };
      }

      return json({ ok: true, orders, summary, warnings });
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
