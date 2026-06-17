import React, { useState, useEffect, useCallback } from "react";
import {
  Home, MessageSquare, Megaphone, Camera, ShoppingCart, Beaker, Package,
  TrendingUp, TrendingDown, Star, Trophy, Sun, Check, ChevronRight,
  Target, Box, Users, LogOut, Lock, User, Shield, Eye, EyeOff,
  Coins, RefreshCw, Wifi, WifiOff, Loader, Sparkles,
} from "lucide-react";

/* ============================================================
   KONFIGURASI — ISI DUA BARIS INI (lihat panduan_setup.md)
   ============================================================ */
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbw9nALTIaBINXGwhE_x9lh_HR3cSxZps85H15J7qoFl3PSif4fyXFFRMwJtLDun2Q4/exec";
const SHEET_TOKEN   = "nf-7f3a9k2p-rumah-nf3";

/* ============================================================
   AMBANG BISNIS NF — atur angka di sini sesuai caramu kerja
   Saran otomatis (rule-based) memakai nilai-nilai ini.
   ============================================================ */
const NF = {
  roasSehat: 3.0,      // ROAS >= ini = sehat (boleh skala budget)
  roasMin: 2.0,        // ROAS < ini = iklan rugi, matikan/perbaiki
  cpwaMax: 10000,      // CPWA di atas ini = mahal, perlu perhatian (rupiah)
  konversiTarget: 20,  // target % leads -> closing
  // Aturan reorder per produk: kalau stok < reorderPoint, saran restock sejumlah qty
  reorder: {
    "Katilayu":     { titik: 400, jumlah: 1000 },
    "Magic Strike": { titik: 400, jumlah: 1000 },
    "Jitu Ampuh":   { titik: 350, jumlah: 800 },
    "Umpan Wangi":  { titik: 300, jumlah: 600 },
    "NF Bait Mix":  { titik: 300, jumlah: 600 },
  },
  reorderDefault: { titik: 300, jumlah: 500 }, // untuk produk yang belum diatur
};

/* ============================================================
   LAPISAN "BACKEND" (api) — sekarang memanggil Google Sheet
   Bandingkan dgn versi demo: nama fungsi sama, isinya beda.
   UI tetap tidak berubah karena hanya kenal api.*
   ============================================================ */

// GET helper
async function apiGet(params) {
  const url = new URL(SHEET_API_URL);
  url.searchParams.set("token", SHEET_TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}
// POST helper (Apps Script: pakai text/plain agar tidak kena preflight CORS)
async function apiPost(payload) {
  const res = await fetch(SHEET_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: SHEET_TOKEN, ...payload }),
  });
  return res.json();
}

let SESSION = null;
const api = {
  async login(id, password) {
    const r = await apiGet({ action: "login", id, password });
    if (r.ok) SESSION = r.user;
    return r;
  },
  logout() { SESSION = null; },
  me() { return SESSION; },

  async getDashboard() {
    const r = await apiGet({ action: "dashboard", role: SESSION.role });
    return { kpi: r.ok ? r.kpi : [], divisions: DIVISIONS };
  },
  async getTasks() {
    const r = await apiGet({ action: "tasks" });
    return r.ok ? { tasks: r.tasks, poinDasar: r.poinDasar } : { tasks: [], poinDasar: 0 };
  },
  async toggleTask(id) {
    return apiPost({ action: "toggleTask", id });
  },
  async getReport(divisi) {
    const r = await apiGet({ action: "report", role: SESSION.role, divisi });
    return r.ok ? r.rows : [];
  },
  async getStock() {
    const r = await apiGet({ action: "stock" });
    return r.ok ? r.stock : [];
  },
  async getMpList(channel = "all") {
    const r = await apiGet({ action: "mp_list", role: SESSION.role, channel });
    return r.ok ? r : { orders: [], summary: null, warnings: [r.error || "Gagal memuat"] };
  },
};

/* ============================================================
   DATA TAMPILAN STATIS (bukan dari sheet) — peta divisi, dll
   ============================================================ */
const C = {
  ink: "#1f2a24", parchment: "#f4ead2", parchmentEdge: "#e3d3aa",
  wood: "#7a5230", woodDark: "#5a3a20", grass: "#5a8f3c", grassDeep: "#3f6e2a",
  nfBlue: "#1c3f7a", nfBlueLite: "#2f5fa8", gold: "#d9a528", goldDeep: "#a87814", chili: "#c0392b",
};
const ICONMAP = { users: Users, target: Target, tup: TrendingUp, coins: Coins, box: Box };
const DIVISIONS = [
  { id: "cs", name: "CS", sub: "Customer Service", icon: MessageSquare, color: "#3b6ea5", label: "Balas chat", done: 12, total: 15 },
  { id: "ads", name: "ADS", sub: "Iklan", icon: Megaphone, color: "#8e5bb5", label: "ROAS hari ini", metric: "4.12", trend: "up" },
  { id: "content", name: "CONTENT", sub: "Konten", icon: Camera, color: "#4f8f4a", label: "Buat konten", done: 2, total: 3 },
  { id: "marketplace", name: "MARKETPLACE", sub: "Pesanan", icon: ShoppingCart, color: "#cf7a2c", label: "Pesanan baru", metric: "18" },
  { id: "produksi", name: "PRODUKSI", sub: "Umpan", icon: Beaker, color: "#3b6ea5", label: "Produksi hari ini", done: 65, total: 120 },
  { id: "packing", name: "PACKING", sub: "Siap kirim", icon: Package, color: "#c79a2c", label: "Siap kirim", metric: "23" },
];
const ALL_NAV = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "task", label: "Task Center", icon: Check },
  { id: "cs", label: "Laporan CS", icon: MessageSquare },
  { id: "ads", label: "Laporan Iklan", icon: Megaphone },
  { id: "produk", label: "Produk & Stok", icon: Package },
  { id: "media", label: "Media", icon: Camera },
  { id: "mp", label: "MP & Reseller", icon: ShoppingCart },
];
const TAGCOLOR = { cs: "#3b6ea5", ads: "#8e5bb5", content: "#4f8f4a", marketplace: "#cf7a2c", produksi: "#3b6ea5", packing: "#c79a2c" };
const FONT = `'Trebuchet MS','Segoe UI',system-ui,sans-serif`;

// Logo NF Nusa Fishing (ikon putih, base64) — dipakai di header & login
const NF_LOGO = "data:image/png;base64,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";
function NFLogo({ size = 28, box }) {
  // box: kalau diisi, logo ditaruh dalam kotak biru NF (untuk header/login)
  const img = <img src={NF_LOGO} alt="NF" width={size} height={size} style={{ objectFit: "contain", display: "block" }} />;
  if (!box) return img;
  return (
    <div style={{ width: box, height: box, borderRadius: box * 0.28, background: C.nfBlue, display: "grid", placeItems: "center", border: `3px solid ${C.parchment}`, boxShadow: "0 3px 0 rgba(0,0,0,.3)" }}>
      {React.cloneElement(img, { width: box * 0.62, height: box * 0.62 })}
    </div>
  );
}
const configured = SHEET_API_URL.startsWith("http");

/* ============================================================
   KOMPONEN DASAR
   ============================================================ */
function WoodMeter({ value, max = 100, h = 14 }) {
  const pct = Math.min(100, Math.round((value / max) * 100)) || 0;
  return (
    <div style={{ background: C.woodDark, borderRadius: 99, padding: 3, boxShadow: "inset 0 1px 3px rgba(0,0,0,.4)" }}>
      <div style={{ height: h, borderRadius: 99, background: C.parchmentEdge, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${C.gold},${C.goldDeep})`, borderRadius: 99, transition: "width .5s ease" }} />
      </div>
    </div>
  );
}
function Panel({ children, style, pad = 16 }) {
  return <div style={{ background: C.parchment, border: `3px solid ${C.wood}`, borderRadius: 16, padding: pad, boxShadow: "0 4px 0 rgba(90,58,32,.35), inset 0 0 0 2px rgba(255,255,255,.25)", ...style }}>{children}</div>;
}
function SectionTitle({ children }) { return <div style={{ fontWeight: 800, fontSize: 14.5 }}>{children}</div>; }
function Spinner({ label }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", color: C.wood, fontSize: 13, fontWeight: 700, padding: 14 }}>
      <Loader size={16} className="nf-spin" /> {label || "Memuat dari sheet…"}
      <style>{`.nf-spin{animation:nfspin 1s linear infinite}@keyframes nfspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ============================================================
   LOGIN
   ============================================================ */
function Login({ onLogin }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!configured) { setErr("Belum disetel: isi SHEET_API_URL & SHEET_TOKEN di kode."); return; }
    setBusy(true); setErr("");
    try {
      const res = await api.login(id, pw);
      if (res.ok) onLogin(res.user);
      else setErr(res.error || "Gagal login.");
    } catch {
      setErr("Tidak bisa menghubungi sheet. Cek URL & koneksi.");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", fontFamily: FONT, display: "grid", placeItems: "center", padding: 20,
      background: `radial-gradient(circle at 30% 0%, #6fa84d 0%, ${C.grass} 35%, ${C.grassDeep} 100%)` }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ margin: "0 auto 10px", width: 64, display: "grid", placeItems: "center" }}>
            <NFLogo box={64} />
          </div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 22, textShadow: "0 2px 0 rgba(0,0,0,.35)" }}>NF <span style={{ color: C.gold }}>Command Center</span></div>
          <div style={{ color: "rgba(255,255,255,.85)", fontSize: 12.5, display: "flex", gap: 5, justifyContent: "center", alignItems: "center", marginTop: 3 }}>
            {configured ? <><Wifi size={13} /> Tersambung Google Sheet</> : <><WifiOff size={13} /> Belum disetel</>}
          </div>
        </div>

        <Panel pad={20}>
          {!configured && (
            <div style={{ background: "#fff", border: `2px solid ${C.chili}`, borderRadius: 10, padding: 11, marginBottom: 12, fontSize: 11.5, color: C.chili, fontWeight: 600 }}>
              Isi dulu <b>SHEET_API_URL</b> dan <b>SHEET_TOKEN</b> di bagian atas kode, sesuai panduan setup.
            </div>
          )}
          <Field icon={<User size={16} color={C.wood} />} placeholder="ID (mis. owner)" value={id} onChange={setId} onEnter={submit} />
          <div style={{ height: 10 }} />
          <Field icon={<Lock size={16} color={C.wood} />} placeholder="Password" value={pw} onChange={setPw} onEnter={submit} type={show ? "text" : "password"}
            trailing={<button onClick={() => setShow(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>{show ? <EyeOff size={16} color={C.wood} /> : <Eye size={16} color={C.wood} />}</button>} />
          {err && <div style={{ color: C.chili, fontSize: 12, fontWeight: 700, marginTop: 8 }}>{err}</div>}
          <button onClick={submit} disabled={busy} style={{ marginTop: 14, width: "100%", padding: 12, borderRadius: 11, cursor: busy ? "wait" : "pointer", background: C.nfBlue, color: "#fff", border: "none", fontWeight: 800, fontSize: 14, boxShadow: `0 3px 0 ${C.woodDark}`, opacity: busy ? .7 : 1, display: "flex", justifyContent: "center", gap: 8 }}>
            {busy && <Loader size={16} className="nf-spin" />} {busy ? "Masuk…" : "Masuk"}
          </button>
          <style>{`.nf-spin{animation:nfspin 1s linear infinite}@keyframes nfspin{to{transform:rotate(360deg)}}`}</style>
        </Panel>
        <div style={{ textAlign: "center", color: "rgba(255,255,255,.8)", fontSize: 10.5, marginTop: 12 }}>
          Data hidup dari Google Sheet · login & role dijaga di Apps Script
        </div>
      </div>
    </div>
  );
}
function Field({ icon, placeholder, value, onChange, onEnter, type = "text", trailing }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `2px solid ${C.parchmentEdge}`, borderRadius: 11, padding: "10px 12px" }}>
      {icon}
      <input value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === "Enter" && onEnter()} placeholder={placeholder} type={type}
        style={{ flex: 1, border: "none", outline: "none", fontSize: 14, fontFamily: FONT, background: "transparent", color: C.ink }} />
      {trailing}
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [user, setUser] = useState(api.me());
  if (!user) return <Login onLogin={setUser} />;
  return <Shell user={user} onLogout={() => { api.logout(); setUser(null); }} />;
}

function Shell({ user, onLogout }) {
  const nav = ALL_NAV.filter(n => user.izin.menu.includes(n.id));
  const [page, setPage] = useState(nav[0].id);

  // state data dari sheet
  const [tasks, setTasks] = useState([]);
  const [poinDasar, setPoinDasar] = useState(0);
  const [kpi, setKpi] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDiv, setOpenDiv] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [d, t, s] = await Promise.all([api.getDashboard(), api.getTasks(), api.getStock()]);
    setKpi(d.kpi); setTasks(t.tasks); setPoinDasar(t.poinDasar); setStock(s);
    setLoading(false);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const earned = tasks.filter(t => t.done).reduce((s, t) => s + t.pts, 0);
  const totalPoin = poinDasar + earned;
  const doneCount = tasks.filter(t => t.done).length;
  const dailyTarget = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  // centang task → tulis balik ke sheet, lalu update tampilan
  const toggle = async (id) => {
    setSavingId(id);
    // optimistik: ubah dulu di layar biar responsif
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t));
    const r = await api.toggleTask(id);
    if (!r.ok) { // gagal → kembalikan
      setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t));
    }
    setSavingId(null);
  };

  return (
    <div style={{ minHeight: "100vh", fontFamily: FONT, color: C.ink, padding: 16,
      background: `radial-gradient(circle at 30% 0%, #6fa84d 0%, ${C.grass} 35%, ${C.grassDeep} 100%)` }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <NFLogo box={50} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 24, color: "#fff", lineHeight: 1, textShadow: "0 2px 0 rgba(0,0,0,.35)" }}>NF <span style={{ color: C.gold }}>Command Center</span></div>
              <div style={{ color: "rgba(255,255,255,.85)", fontSize: 12, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}><Shield size={13} /> {user.nama} · {user.izin.nama}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Panel pad={9} style={{ display: "flex", gap: 4 }}>
              <Stat icon={<Sun size={17} color={C.goldDeep} />} top="Hari Ini" bottom="16 Mei 2025" />
              <Sep /><Stat icon={<Star size={17} color={C.gold} fill={C.gold} />} top="Level" bottom="Lv. 12" />
              <Sep /><Stat icon={<Trophy size={17} color={C.goldDeep} />} top="Poin Tim" bottom={totalPoin.toLocaleString("id-ID")} accent />
            </Panel>
            <button onClick={loadAll} title="Muat ulang dari sheet" style={iconBtn}><RefreshCw size={18} color={C.nfBlue} className={loading ? "nf-spin" : ""} /></button>
            <button onClick={onLogout} title="Keluar" style={iconBtn}><LogOut size={18} color={C.chili} /></button>
          </div>
        </header>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {nav.map(n => {
            const Icon = n.icon; const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", padding: "8px 14px", borderRadius: 11, fontSize: 13.5, fontWeight: 700,
                border: `2px solid ${active ? C.gold : "rgba(255,255,255,.4)"}`, background: active ? C.parchment : "rgba(255,255,255,.12)", color: active ? C.ink : "#fff", boxShadow: active ? "0 3px 0 rgba(90,58,32,.4)" : "none" }}>
                <Icon size={16} /> {n.label}
              </button>
            );
          })}
        </nav>

        {/* Konten */}
        {page === "dashboard" && <Dashboard role={user.role} stock={stock} kpi={kpi} loading={loading} tasks={tasks} toggle={toggle} savingId={savingId} dailyTarget={dailyTarget} earned={earned} setOpenDiv={setOpenDiv} setPage={setPage} canTask={user.izin.menu.includes("task")} />}
        {page === "task" && <TaskCenter tasks={tasks} toggle={toggle} savingId={savingId} earned={earned} loading={loading} />}
        {page === "cs" && <ReportView divisi="cs" title="Laporan CS" accent="#3b6ea5" />}
        {page === "ads" && <ReportView divisi="ads" title="Laporan Iklan" accent="#8e5bb5" />}
        {page === "media" && <ReportView divisi="media" title="Media & Konten" accent="#4f8f4a" />}
        {page === "mp" && <MpResellerView lihatUang={user.izin.lihatUang} />}
        {page === "produk" && <ProdukStok />}

        <footer style={{ marginTop: 18, textAlign: "center", color: "#fff", background: C.nfBlue, border: `3px solid ${C.parchment}`, borderRadius: 14, padding: "12px 16px", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 0 rgba(0,0,0,.25)" }}>
          🎣 Kerja tim itu seperti memancing — fokus, sabar, dan hasilnya bikin bangga!
        </footer>
      </div>
      {openDiv && <DivisionModal div={openDiv} onClose={() => setOpenDiv(null)} />}
      <style>{`.nf-spin{animation:nfspin 1s linear infinite}@keyframes nfspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const iconBtn = { width: 44, height: 44, borderRadius: 12, cursor: "pointer", background: C.parchment, border: `3px solid ${C.wood}`, display: "grid", placeItems: "center", boxShadow: "0 3px 0 rgba(90,58,32,.35)" };
function Sep() { return <div style={{ width: 1, background: C.parchmentEdge, margin: "2px 6px" }} />; }
function Stat({ icon, top, bottom, accent }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 8px" }}>
      {icon}
      <div>
        <div style={{ fontSize: 10, color: C.wood, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>{top}</div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: accent ? C.goldDeep : C.ink }}>{bottom}</div>
      </div>
    </div>
  );
}

function Dashboard({ role, stock, kpi, loading, tasks, toggle, savingId, dailyTarget, earned, setOpenDiv, setPage, canTask }) {
  const linkBtn = { display: "flex", alignItems: "center", gap: 2, cursor: "pointer", background: "none", border: "none", color: C.nfBlueLite, fontWeight: 700, fontSize: 12 };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,.85fr)", gap: 16 }} className="nf-grid">
      <style>{`@media(max-width:880px){.nf-grid{grid-template-columns:1fr!important}.nf-divgrid{grid-template-columns:1fr 1fr!important}}`}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: C.nfBlueLite, display: "grid", placeItems: "center", flexShrink: 0 }}><Users size={24} color="#fff" /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Halo, Boss! 👋</div>
            <div style={{ fontSize: 12.5, color: C.wood, marginTop: 2 }}>Angka di bawah ini langsung dari Google Sheet kamu.</div>
          </div>
        </Panel>

        {loading ? <Panel><Spinner /></Panel> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10 }}>
            {kpi.map(k => {
              const Icon = ICONMAP[k.icon] || Box; const neg = k.id === "stok";
              return (
                <Panel key={k.id} pad={12} style={{ borderColor: neg ? C.chili : C.wood }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: C.wood, textTransform: "uppercase" }}>{k.label}</span>
                    <Icon size={15} color={neg ? C.chili : C.nfBlueLite} />
                  </div>
                  <div style={{ fontSize: 23, fontWeight: 800, marginTop: 4, color: neg ? C.chili : C.ink }}>{k.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: neg ? C.chili : C.grassDeep, display: "flex", alignItems: "center", gap: 3 }}>
                    {!neg && (k.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />)} {k.delta}
                  </div>
                </Panel>
              );
            })}
          </div>
        )}

        <Panel>
          <SectionTitle>🗺️ Peta Divisi — klik untuk detail</SectionTitle>
          <div className="nf-divgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
            {DIVISIONS.map(d => {
              const Icon = d.icon; const has = d.total != null;
              return (
                <button key={d.id} onClick={() => setOpenDiv(d)} style={{ cursor: "pointer", textAlign: "left", padding: 11, borderRadius: 13, background: "#fff", border: `2px solid ${d.color}`, boxShadow: `0 3px 0 ${d.color}55` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: d.color, display: "grid", placeItems: "center" }}><Icon size={17} color="#fff" /></div>
                    <div style={{ fontWeight: 800, fontSize: 12.5 }}>{d.name}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.wood, marginTop: 7 }}>{d.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: d.color, marginTop: 1 }}>{has ? `${d.done}/${d.total}` : d.metric}{d.trend === "up" && " ↑"}</div>
                  {has && <div style={{ marginTop: 6 }}><WoodMeter value={d.done} max={d.total} h={8} /></div>}
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <AdvicePanel role={role} ctx={{ kpi, tasks, stock }} />
        <Panel>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <SectionTitle>🎯 Target Harian</SectionTitle>
            <span style={{ fontWeight: 800, fontSize: 22, color: C.goldDeep }}>{dailyTarget}%</span>
          </div>
          <WoodMeter value={dailyTarget} />
          <div style={{ fontSize: 11.5, color: C.wood, marginTop: 8 }}>+{earned} poin dari tugas selesai (tersimpan di sheet).</div>
        </Panel>

        <Panel>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SectionTitle>✅ Task Hari Ini</SectionTitle>
            {canTask && <button onClick={() => setPage("task")} style={linkBtn}>Semua <ChevronRight size={13} /></button>}
          </div>
          {loading ? <Spinner /> : (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
              {tasks.map(t => <TaskRow key={t.id} t={t} toggle={toggle} saving={savingId === t.id} />)}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function TaskRow({ t, toggle, saving }) {
  const tag = TAGCOLOR[t.divisi] || C.wood;
  return (
    <div onClick={() => !saving && toggle(t.id)} style={{ display: "flex", alignItems: "center", gap: 9, cursor: saving ? "wait" : "pointer", padding: "7px 9px", borderRadius: 10, background: t.done ? "rgba(90,143,60,.15)" : "#fff", border: `1.5px solid ${t.done ? C.grass : C.parchmentEdge}`, opacity: saving ? .6 : 1 }}>
      <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, background: t.done ? C.grass : "#fff", border: `2px solid ${t.done ? C.grass : C.wood}`, display: "grid", placeItems: "center" }}>
        {saving ? <Loader size={11} className="nf-spin" color={C.wood} /> : t.done && <Check size={13} color="#fff" strokeWidth={3} />}
      </div>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, textDecoration: t.done ? "line-through" : "none", color: t.done ? C.wood : C.ink }}>{t.text}</span>
      <span style={{ fontSize: 11, color: C.wood, fontWeight: 700 }}>{t.prog}</span>
      <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: tag, padding: "2px 7px", borderRadius: 6, textTransform: "capitalize" }}>{t.divisi}</span>
    </div>
  );
}

function TaskCenter({ tasks, toggle, savingId, earned, loading }) {
  if (loading) return <Panel><Spinner /></Panel>;
  const done = tasks.filter(t => t.done).length;
  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <SectionTitle>✅ Task Center</SectionTitle>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.goldDeep }}>{done}/{tasks.length} selesai · +{earned} poin</span>
      </div>
      <div style={{ margin: "10px 0 14px" }}><WoodMeter value={done} max={tasks.length || 1} /></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map(t => {
          const saving = savingId === t.id; const tag = TAGCOLOR[t.divisi] || C.wood;
          return (
            <div key={t.id} onClick={() => !saving && toggle(t.id)} style={{ display: "flex", alignItems: "center", gap: 11, cursor: saving ? "wait" : "pointer", padding: "11px 13px", borderRadius: 12, background: t.done ? "rgba(90,143,60,.15)" : "#fff", border: `2px solid ${t.done ? C.grass : C.parchmentEdge}`, opacity: saving ? .6 : 1 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: t.done ? C.grass : "#fff", border: `2px solid ${t.done ? C.grass : C.wood}`, display: "grid", placeItems: "center" }}>
                {saving ? <Loader size={13} className="nf-spin" color={C.wood} /> : t.done && <Check size={15} color="#fff" strokeWidth={3} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, textDecoration: t.done ? "line-through" : "none", color: t.done ? C.wood : C.ink }}>{t.text}</div>
                <div style={{ fontSize: 11, color: C.wood, marginTop: 1 }}>Progress {t.prog} · bernilai {t.pts} poin</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: tag, padding: "3px 9px", borderRadius: 7, textTransform: "capitalize" }}>{t.divisi}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ReportView({ divisi, title, accent }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { let on = true; api.getReport(divisi).then(r => on && setRows(r)); return () => { on = false; }; }, [divisi]);
  return (
    <Panel>
      <SectionTitle>{title}</SectionTitle>
      {rows === null ? <Spinner /> : rows.length === 0 ? (
        <div style={{ color: C.wood, fontSize: 13, marginTop: 10 }}>Tidak ada data untuk akun ini.</div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
          {rows.map(([k, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 13px", borderRadius: 10, background: "#fff", border: `1.5px solid ${C.parchmentEdge}` }}>
              <span style={{ fontSize: 13, color: C.wood, fontWeight: 600 }}>{k}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: accent }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function MpResellerView({ lihatUang }) {
  const [channel, setChannel] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.getMpList(channel);
    setData(r);
    setLoading(false);
  }, [channel]);
  useEffect(() => { load(); }, [load]);

  const fmtRp = (n) => n == null ? "—" : "Rp " + Number(n).toLocaleString("id-ID");
  const summary = data?.summary;
  const orders = data?.orders || [];
  const tabs = [
    { id: "all", label: "Semua" },
    { id: "mp", label: "MP Official" },
    { id: "reseller", label: "Reseller" },
  ];

  return (
    <Panel>
      <SectionTitle>🛒 MP & Reseller — Sheet Resi (baca live)</SectionTitle>
      {summary && (
        <div style={{ marginTop: 10, fontSize: 12, color: C.wood }}>
          Tab aktif: <b>{summary.tabs?.mp}</b> · <b>{summary.tabs?.reseller}</b>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setChannel(t.id)} style={{
            padding: "7px 12px", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 12.5,
            border: `2px solid ${channel === t.id ? C.gold : C.parchmentEdge}`,
            background: channel === t.id ? C.parchment : "#fff", color: C.ink,
          }}>{t.label}</button>
        ))}
        <button onClick={load} title="Muat ulang" style={{ ...iconBtn, width: 36, height: 36, marginLeft: "auto" }}><RefreshCw size={16} color={C.nfBlue} className={loading ? "nf-spin" : ""} /></button>
      </div>
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 12 }}>
          <MiniStat label="Total pesanan" value={String(summary.total)} color={C.nfBlue} />
          <MiniStat label="MP Official" value={String(summary.countMp)} color="#cf7a2c" />
          <MiniStat label="Reseller" value={String(summary.countReseller)} color={C.grassDeep} />
          {lihatUang && (
            <>
              <MiniStat label="Omzet MP" value={fmtRp(summary.omzetMp)} color={C.goldDeep} />
              <MiniStat label="Omzet Reseller" value={fmtRp(summary.omzetReseller)} color={C.goldDeep} />
            </>
          )}
        </div>
      )}
      {data?.warnings?.length > 0 && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#fff3cd", border: `1.5px solid ${C.gold}`, fontSize: 12.5, color: C.wood }}>
          {data.warnings.join(" · ")}
        </div>
      )}
      {loading ? <Spinner /> : orders.length === 0 ? (
        <div style={{ color: C.wood, fontSize: 13, marginTop: 14 }}>Belum ada order di tab bulan ini, atau tab belum dibuat di sheet Resi.</div>
      ) : (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
          {orders.map((o, i) => (
            <div key={`${o.channel}-${o.invoice}-${i}`} style={{ padding: "11px 13px", borderRadius: 11, background: "#fff", border: `2px solid ${C.parchmentEdge}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{o.nama || "—"}</div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: o.channel === "reseller" ? C.grassDeep : "#cf7a2c", padding: "3px 8px", borderRadius: 6 }}>
                  {o.channel === "reseller" ? "Reseller" : "MP"}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: C.wood, marginTop: 5, lineHeight: 1.5 }}>
                <div><b>Tanggal:</b> {o.tanggal || "—"} · <b>Invoice:</b> {o.invoice || "—"}</div>
                <div><b>Resi:</b> {o.noResi || "—"} · <b>Kota:</b> {o.kota || "—"} · <b>Lokasi:</b> {o.lokasi || "—"}</div>
                <div><b>Barang:</b> {o.barang || "—"} ({o.jumlah || "—"}) · <b>PIC:</b> {o.pic || "—"}</div>
                {lihatUang && o.harga != null && <div style={{ fontWeight: 800, color: C.goldDeep, marginTop: 3 }}>{fmtRp(o.harga)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 11.5, color: C.wood, fontStyle: "italic" }}>
        Tahap 1: tampilan baca saja. Edit & catat dari app → Tahap 3.
      </div>
    </Panel>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fff", border: `1.5px solid ${C.parchmentEdge}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.wood, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function ProdukStok() {
  const [stock, setStock] = useState(null);
  useEffect(() => { let on = true; api.getStock().then(s => on && setStock(s)); return () => { on = false; }; }, []);
  return (
    <Panel>
      <SectionTitle>📦 Produk & Stok</SectionTitle>
      {stock === null ? <Spinner /> : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
          {stock.map(s => {
            const low = s.qty < s.min;
            return (
              <div key={s.name} style={{ padding: "11px 13px", borderRadius: 11, background: "#fff", border: `2px solid ${low ? C.chili : C.parchmentEdge}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{s.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: low ? C.chili : C.grassDeep }}>{s.qty.toLocaleString("id-ID")} pcs {low && "· menipis!"}</span>
                </div>
                <WoodMeter value={s.qty} max={1300} h={9} />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ============================================================
   AI ADVICE — aturan dulu (otomatis) + tombol minta saran AI (Claude)
   ============================================================ */

// Fokus tiap role: divisi apa yang disorot saran
const ADVICE_FOKUS = {
  owner:    { judul: "Ringkasan Owner", lintas: true },
  keuangan: { judul: "Sorotan Keuangan", lintas: true },
  cs:       { judul: "Saran untuk CS", divisi: "cs" },
  ads:      { judul: "Saran untuk Ads", divisi: "ads" },
  produksi: { judul: "Saran Produksi & Stok", divisi: "produksi" },
};

// Mesin aturan: hasilkan saran dari angka tanpa AI, pakai ambang NF
function buildRuleAdvice(role, { kpi, tasks, stock }) {
  const out = [];
  const num = (v) => Number(String(v).replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  const kpiBy = Object.fromEntries((kpi || []).map((k) => [k.id, k]));
  const belum = (tasks || []).filter((t) => !t.done);
  const fokus = ADVICE_FOKUS[role] || {};

  // hitung produk yang menembus titik reorder + saran jumlah restock
  const perluRestock = (stock || []).map((s) => {
    const aturan = NF.reorder[s.name] || NF.reorderDefault;
    return { ...s, titik: aturan.titik, jumlah: aturan.jumlah, kurang: s.qty < aturan.titik };
  }).filter((s) => s.kurang);

  // ---- saran lintas-divisi (owner & keuangan) ----
  if (fokus.lintas) {
    if (kpiBy.roas) {
      const r = num(kpiBy.roas.value);
      if (r >= NF.roasSehat) out.push({ t: "good", text: `ROAS ${kpiBy.roas.value} sehat (target \u2265${NF.roasSehat}). Aman naikkan budget di produk terlaris.` });
      else if (r < NF.roasMin) out.push({ t: "warn", text: `ROAS ${kpiBy.roas.value} di bawah ${NF.roasMin} \u2014 iklan berisiko rugi. Matikan set boros, fokus creative pemenang.` });
      else out.push({ t: "info", text: `ROAS ${kpiBy.roas.value} sedang (antara ${NF.roasMin}\u2013${NF.roasSehat}). Optimalkan dulu sebelum tambah budget.` });
    }
    if (perluRestock.length) out.push({ t: "warn", text: `${perluRestock.length} produk perlu restock: ${perluRestock.map((s) => `${s.name} (sisa ${s.qty}, order ${s.jumlah})`).join("; ")}.` });
    else out.push({ t: "good", text: "Semua produk di atas titik reorder. Stok aman." });
    if (kpiBy.closing && kpiBy.leads) {
      const rate = Math.round((num(kpiBy.closing.value) / num(kpiBy.leads.value)) * 100);
      out.push({ t: rate >= NF.konversiTarget ? "good" : "warn", text: `Konversi leads\u2192closing ~${rate}% (target ${NF.konversiTarget}%). ${rate >= NF.konversiTarget ? "Pertahankan." : "Perketat follow-up CS & kualitas leads iklan."}` });
    }
    if (belum.length) out.push({ t: "info", text: `${belum.length} tugas tim belum kelar. Divisi tertinggal: ${[...new Set(belum.map((t) => t.divisi))].join(", ")}.` });
  }

  // ---- fokus CS ----
  if (fokus.divisi === "cs") {
    const csTask = belum.filter((t) => t.divisi === "cs");
    if (csTask.length) out.push({ t: "warn", text: `Tugas CS belum selesai: ${csTask.map((t) => `${t.text} (${t.prog})`).join("; ")}. Prioritaskan balas chat.` });
    else out.push({ t: "good", text: "Semua tugas CS selesai. Pertahankan respon cepat!" });
    if (kpiBy.closing && kpiBy.leads) {
      const rate = Math.round((num(kpiBy.closing.value) / num(kpiBy.leads.value)) * 100);
      out.push({ t: rate >= NF.konversiTarget ? "good" : "info", text: `Konversi ~${rate}% (target ${NF.konversiTarget}%). Balas <5 menit menaikkan closing.` });
    }
  }

  // ---- fokus Ads ----
  if (fokus.divisi === "ads") {
    if (kpiBy.roas) {
      const r = num(kpiBy.roas.value);
      if (r >= NF.roasSehat) out.push({ t: "good", text: `ROAS ${kpiBy.roas.value} bagus. Skalakan pemenang, matikan ROAS<${NF.roasMin}.` });
      else if (r < NF.roasMin) out.push({ t: "warn", text: `ROAS ${kpiBy.roas.value} rugi. Pause iklan boros, uji ulang audiens & creative.` });
      else out.push({ t: "info", text: `ROAS ${kpiBy.roas.value} sedang. Optimalkan creative sebelum tambah budget.` });
    }
    if (kpiBy.cpwa) {
      const c = num(kpiBy.cpwa.value);
      out.push(c > NF.cpwaMax
        ? { t: "warn", text: `CPWA ${kpiBy.cpwa.value} di atas batas (${NF.cpwaMax.toLocaleString("id-ID")}). Turunkan dgn creative lebih relevan.` }
        : { t: "good", text: `CPWA ${kpiBy.cpwa.value} masih wajar (\u2264${NF.cpwaMax.toLocaleString("id-ID")}).` });
    }
  }

  // ---- fokus Produksi & Stok ----
  if (fokus.divisi === "produksi") {
    if (perluRestock.length) perluRestock.forEach((s) =>
      out.push({ t: "warn", text: `${s.name}: sisa ${s.qty} (titik ${s.titik}). Saran produksi/order ${s.jumlah} pcs.` }));
    else out.push({ t: "good", text: "Semua produk di atas titik reorder. Tidak perlu restock darurat." });
    const prodTask = belum.filter((t) => t.divisi === "produksi" || t.divisi === "packing");
    if (prodTask.length) out.push({ t: "info", text: `Tugas tersisa: ${prodTask.map((t) => `${t.text} (${t.prog})`).join("; ")}.` });
  }

  if (!out.length) out.push({ t: "info", text: "Belum ada sinyal khusus. Lanjutkan pantau target harian." });
  return out;
}

// Minta saran dinamis ke Claude (API)
async function askClaudeAdvice(role, ctx) {
  const fokus = ADVICE_FOKUS[role] || {};
  const ringkas = {
    role,
    fokus: fokus.divisi || (fokus.lintas ? "semua divisi" : "umum"),
    kpi: (ctx.kpi || []).map((k) => `${k.label}: ${k.value} (${k.delta})`),
    tugas_belum: (ctx.tasks || []).filter((t) => !t.done).map((t) => `${t.text} [${t.divisi}] ${t.prog}`),
    stok_menipis: (ctx.stock || []).filter((s) => s.qty < s.min).map((s) => `${s.name}: ${s.qty}/${s.min}`),
  };
  const prompt = `Kamu asisten operasional untuk bisnis umpan pancing "NF Nusa Fishing".
Berikan saran SINGKAT, konkret, dan langsung bisa dikerjakan untuk peran "${role}" (fokus: ${ringkas.fokus}).
Pakai bahasa Indonesia santai-profesional. Maksimal 4 poin. Jangan bertele-tele.
Data hari ini (JSON): ${JSON.stringify(ringkas)}
Jawab HANYA poin-poin saran, tiap poin diawali "- ".`;

  // Deteksi lingkungan:
  // - Di Claude.ai (artifact): panggil API Anthropic langsung (key ditangani otomatis).
  // - Di hosting sendiri (Vercel): panggil /api/advice (key aman di server).
  const diClaudeAi = typeof window !== "undefined" && window.location && window.location.hostname.includes("claude");

  if (diClaudeAi) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return text || "Tidak ada saran yang dihasilkan.";
  } else {
    const res = await fetch("/api/advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text || "Tidak ada saran yang dihasilkan.";
  }
}

function AdvicePanel({ role, ctx }) {
  const fokus = ADVICE_FOKUS[role] || { judul: "Saran" };
  const ruleAdvice = React.useMemo(() => buildRuleAdvice(role, ctx), [role, ctx]);
  const [aiText, setAiText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const minta = async () => {
    setBusy(true); setErr(""); setAiText("");
    try { setAiText(await askClaudeAdvice(role, ctx)); }
    catch { setErr("Gagal menghubungi AI. Coba lagi."); }
    finally { setBusy(false); }
  };

  const dot = { good: C.grass, warn: C.chili, info: C.nfBlueLite };
  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionTitle>🤖 {fokus.judul}</SectionTitle>
        <button onClick={minta} disabled={busy} style={{
          display: "flex", alignItems: "center", gap: 6, cursor: busy ? "wait" : "pointer",
          padding: "6px 12px", borderRadius: 9, fontSize: 11.5, fontWeight: 800,
          background: C.nfBlue, color: "#fff", border: "none", boxShadow: `0 2px 0 ${C.woodDark}`, opacity: busy ? .7 : 1,
        }}>
          {busy ? <Loader size={13} className="nf-spin" /> : <Sparkles size={13} />}
          {busy ? "Meminta…" : "Minta saran AI"}
        </button>
      </div>

      {/* Saran berbasis aturan (selalu tampil) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {ruleAdvice.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fff", border: `1.5px solid ${C.parchmentEdge}`, borderRadius: 10, padding: "9px 11px" }}>
            <div style={{ width: 9, height: 9, borderRadius: 99, background: dot[a.t] || C.nfBlueLite, marginTop: 4, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.45 }}>{a.text}</span>
          </div>
        ))}
      </div>

      {/* Hasil AI dinamis */}
      {(aiText || err) && (
        <div style={{ marginTop: 11, background: "#fff", border: `2px solid ${C.nfBlue}`, borderRadius: 11, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: C.nfBlue, marginBottom: 6 }}>
            <Sparkles size={13} /> Saran AI (dinamis)
          </div>
          {err ? <div style={{ color: C.chili, fontSize: 12.5, fontWeight: 600 }}>{err}</div> : (
            <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{aiText}</div>
          )}
        </div>
      )}
      <div style={{ fontSize: 10, color: C.wood, marginTop: 8 }}>
        Titik hijau = aman · merah = perlu tindakan · biru = info. Saran AI butuh app berjalan aktif.
      </div>
    </Panel>
  );
}

function DivisionModal({ div, onClose }) {
  const Icon = div.icon; const has = div.total != null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,.6)", display: "grid", placeItems: "center", padding: 20, zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 380 }}>
        <Panel pad={20} style={{ borderColor: div.color }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: div.color, display: "grid", placeItems: "center" }}><Icon size={26} color="#fff" /></div>
            <div><div style={{ fontWeight: 800, fontSize: 18 }}>{div.name}</div><div style={{ fontSize: 12, color: C.wood }}>{div.sub}</div></div>
          </div>
          <div style={{ background: "#fff", borderRadius: 11, padding: 14, border: `1.5px solid ${C.parchmentEdge}` }}>
            <div style={{ fontSize: 12, color: C.wood }}>{div.label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: div.color, margin: "2px 0 8px" }}>{has ? `${div.done}/${div.total}` : div.metric}{div.trend === "up" && " ↑"}</div>
            {has && <WoodMeter value={div.done} max={div.total} />}
          </div>
          <button onClick={onClose} style={{ marginTop: 14, width: "100%", padding: 11, borderRadius: 11, cursor: "pointer", background: div.color, color: "#fff", border: "none", fontWeight: 800, fontSize: 13.5 }}>Tutup</button>
        </Panel>
      </div>
    </div>
  );
}
