/**
 * ============================================================
 * NF COMMAND CENTER — BACKEND (Google Apps Script)
 * ============================================================
 * Tempel kode ini di: Sheet > Extensions > Apps Script.
 * Lalu Deploy > New deployment > Web app.
 *
 * Fungsi: jembatan aman antara web app (React) dan Google Sheet.
 *   - Baca: tasks, kpi, reports, stock, users, mp/reseller (sheet Resi)
 *   - Tulis: centang task, simpan poin, edit PIC/catatan MP (sheet Resi)
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
const API_TOKEN = "nf-7f3a9k2p-rumah-nf3";

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
   MP & RESELLER — sheet Resi terpisah (Tahap 3: baca + edit PIC/catatan)
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

function normalizeResiDate_(s) {
  const parts = String(s).trim().split("/");
  if (parts.length !== 3) return String(s).trim();
  const yy = parts[2].length === 4 ? String(parts[2]).slice(-2) : parts[2];
  return ("0" + parts[0]).slice(-2) + "/" + ("0" + parts[1]).slice(-2) + "/" + yy;
}

function todayResi_() {
  return normalizeResiDate_(formatResiDate_(new Date()));
}

function parseHarga_(v) {
  if (typeof v === "number" && !isNaN(v)) return v;
  return Number(String(v).replace(/[^0-9.-]/g, "")) || 0;
}

function getResiColMap_(sh) {
  const lastCol = Math.max(sh.getLastColumn(), 18);
  const heads = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim().toUpperCase();
  });
  function idx(name, fallback) {
    const i = heads.indexOf(name.toUpperCase());
    return i >= 0 ? i : fallback;
  }
  return {
    invoice: idx("INVOICE", 2),
    pic: idx("PIC", 15),
    catatan: idx("CATATAN", 17),
  };
}

function readResiOrders_(tabName) {
  const ss = SpreadsheetApp.openById(RESI_SHEET_ID);
  const sh = ss.getSheetByName(tabName);
  if (!sh) return { orders: [], missing: true };
  const cols = getResiColMap_(sh);
  const data = sh.getDataRange().getValues();
  const orders = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const invoice = String(row[cols.invoice] || "").trim();
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
      pic: String(row[cols.pic] || ""),
      catatan: String(row[cols.catatan] || ""),
    });
  }
  return { orders: orders, missing: false };
}

function updateMpOrder_(body) {
  if (!mpAllowed_(body.role)) return { ok: false, error: "Tidak punya akses MP/Reseller." };
  const channel = String(body.channel || "");
  if (channel !== "mp" && channel !== "reseller") {
    return { ok: false, error: "Channel harus mp atau reseller." };
  }
  const invoice = String(body.invoice || "").trim();
  if (!invoice) return { ok: false, error: "Invoice wajib diisi." };
  const hasPic = body.pic !== undefined && body.pic !== null;
  const hasCatatan = body.catatan !== undefined && body.catatan !== null;
  if (!hasPic && !hasCatatan) return { ok: false, error: "Isi PIC atau catatan untuk disimpan." };

  const tabs = getResiTabNames();
  const tabName = channel === "mp" ? tabs.mp : tabs.reseller;
  const ss = SpreadsheetApp.openById(RESI_SHEET_ID);
  const sh = ss.getSheetByName(tabName);
  if (!sh) return { ok: false, error: "Tab tidak ditemukan: " + tabName };

  const cols = getResiColMap_(sh);
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][cols.invoice] || "").trim() !== invoice) continue;
    if (hasPic) sh.getRange(r + 1, cols.pic + 1).setValue(String(body.pic));
    if (hasCatatan) {
      if (String(sh.getRange(1, cols.catatan + 1).getValue()).trim() === "") {
        sh.getRange(1, cols.catatan + 1).setValue("CATATAN");
      }
      sh.getRange(r + 1, cols.catatan + 1).setValue(String(body.catatan));
    }
    return {
      ok: true,
      invoice: invoice,
      channel: channel,
      pic: hasPic ? String(body.pic) : undefined,
      catatan: hasCatatan ? String(body.catatan) : undefined,
    };
  }
  return { ok: false, error: "Invoice tidak ditemukan di tab " + tabName };
}

function buildMpSummary_(role) {
  if (!mpAllowed_(role)) return null;
  const izin = ROLES[role] || ROLES.cs;
  const tabs = getResiTabNames();
  const warnings = [];
  const mpR = readResiOrders_(tabs.mp);
  const reR = readResiOrders_(tabs.reseller);
  if (mpR.missing) warnings.push("Tab tidak ditemukan: " + tabs.mp);
  if (reR.missing) warnings.push("Tab tidak ditemukan: " + tabs.reseller);
  const mpOrders = mpR.orders || [];
  const reOrders = reR.orders || [];
  const today = todayResi_();
  const hariIni = mpOrders.filter(function(o) { return normalizeResiDate_(o.tanggal) === today; }).length
    + reOrders.filter(function(o) { return normalizeResiDate_(o.tanggal) === today; }).length;
  const omzetMp = mpOrders.reduce(function(s, o) { return s + o.harga; }, 0);
  const omzetReseller = reOrders.reduce(function(s, o) { return s + o.harga; }, 0);
  const summary = {
    tabs: tabs,
    total: mpOrders.length + reOrders.length,
    countMp: mpOrders.length,
    countReseller: reOrders.length,
    hariIni: hariIni,
    omzetMp: izin.lihatUang ? omzetMp : null,
    omzetReseller: izin.lihatUang ? omzetReseller : null,
    omzetTotal: izin.lihatUang ? omzetMp + omzetReseller : null,
  };
  if (warnings.length) summary.warnings = warnings;
  return summary;
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
      const mpSummary = buildMpSummary_(role);
      return json({ ok: true, kpi, mpSummary });
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

      const summary = buildMpSummary_(role) || {
        tabs: tabs, total: orders.length, countMp: 0, countReseller: 0, hariIni: 0,
        omzetMp: null, omzetReseller: null, omzetTotal: null,
      };
      summary.total = orders.length;
      summary.countMp = orders.filter(o => o.channel === "mp").length;
      summary.countReseller = orders.filter(o => o.channel === "reseller").length;
      if (warnings.length) summary.warnings = warnings;

      if (!izin.lihatUang) {
        orders = orders.map(o => ({ ...o, harga: null }));
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

    if (body.action === "mp_update") {
      return json(updateMpOrder_(body));
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
