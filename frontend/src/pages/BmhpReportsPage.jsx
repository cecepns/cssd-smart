import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart3,
  ClipboardList,
  Download,
  Printer,
  RefreshCw,
  Search,
} from 'lucide-react';
import SubNav from '@/components/ui/SubNav';
import { BMHP_CATEGORIES, BMHP_TABS } from '@/config/resources/stock';
import { ROUTES } from '@/config/routes';
import { api } from '@/utils/api';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, formatNumber } from '@/utils/format';
import { getErrorMessage } from '@/utils/request';
import useDebounce from '@/hooks/useDebounce';
import { useAuth } from '@/context/AuthContext';

const REPORT_TABS = [
  { id: 'mutasi', label: 'Mutasi Stok' },
  { id: 'rekap', label: 'Rekap Stok' },
  { id: 'masuk', label: 'Laporan Barang Masuk', badge: 'Baru' },
  { id: 'keluar', label: 'Laporan Barang Keluar', badge: 'Baru' },
  { id: 'retur', label: 'Retur / Koreksi' },
  { id: 'per_kategori', label: 'Per Jenis Barang', badge: 'Baru' },
  { id: 'per_tahun', label: 'Per Tahun Pembelian', badge: 'Baru' },
  { id: 'per_anggaran', label: 'Per Anggaran (APBD/BLUD)', badge: 'Baru' },
  { id: 'expired', label: 'Expired (ED)' },
  { id: 'keseluruhan', label: 'Keseluruhan BMHP (Nilai Rp)' },
];

const formatRp = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0));

export default function BmhpReportsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'mutasi';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState('Semua');
  const [fiscalYear, setFiscalYear] = useState('Semua');
  const [budgetSource, setBudgetSource] = useState('Semua');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && REPORT_TABS.some((rt) => rt.id === t)) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const selectTab = (id) => {
    setActiveTab(id);
    setSearchParams({ tab: id });
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.BMHP_ITEMS.REPORTS, {
        params: {
          report_type: activeTab,
          search: debouncedSearch || undefined,
          category: category !== 'Semua' ? category : undefined,
          fiscal_year: fiscalYear !== 'Semua' ? fiscalYear : undefined,
          budget_source: budgetSource !== 'Semua' ? budgetSource : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      });
      setRows(res.data?.data?.rows || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memuat laporan BMHP'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, category, fiscalYear, budgetSource, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = () => {
    if (!rows.length) {
      toast.error('Tidak ada data untuk diunduh');
      return;
    }
    const keys = Object.keys(rows[0]).filter((k) => !['proof_image', 'officer_signature'].includes(k));
    const csv = [
      keys,
      ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`)),
    ]
      .map((line) => line.join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-bmhp-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentTabMeta = REPORT_TABS.find((t) => t.id === activeTab) || REPORT_TABS[0];

  return (
    <div className="space-y-4 pb-8">
      <div className="print:hidden">
        <SubNav items={BMHP_TABS} />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-sm">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Laporan BMHP Terintegrasi — {currentTabMeta.label}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Seluruh laporan otomatis terbentuk & terbarui real-time dari satu basis data transaksi BMHP (tanpa input ulang).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => navigate(ROUTES.BMHP_STOCK_CARD)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100"
          >
            <ClipboardList size={14} /> Kartu Stok (Per Barang)
          </button>
          <button
            type="button"
            onClick={fetchReport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Muat Ulang
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white"
          >
            <Download size={14} /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 px-3.5 py-2 text-xs font-bold text-white"
          >
            <Printer size={14} /> Cetak PDF
          </button>
        </div>
      </div>

      {/* 10 Jenis Laporan Selector */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-wrap gap-1.5">
          {REPORT_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-[#002D85] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-black uppercase ${active ? 'bg-amber-400 text-[#001F5F]' : 'bg-rose-500 text-white'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6 pt-2 border-t border-slate-100">
          <div className="relative lg:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama barang, kode, batch, petugas..."
              className="input-base pl-8 text-xs"
            />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-base text-xs font-semibold">
            <option value="Semua">Semua Jenis Barang</option>
            {BMHP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className="input-base text-xs font-semibold">
            <option value="Semua">Semua Tahun</option>
            {['2026', '2025', '2024', '2023'].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={budgetSource} onChange={(e) => setBudgetSource(e.target.value)} className="input-base text-xs font-semibold">
            <option value="Semua">Semua Anggaran</option>
            {['BLUD', 'APBD', 'DAK', 'BOK'].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-base text-[11px] px-1.5" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-base text-[11px] px-1.5" />
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-400">Memuat data laporan...</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">Tidak ada data laporan yang sesuai filter.</div>
          ) : activeTab === 'mutasi' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b">
                <tr>
                  <th className="px-4 py-3">Kode & Nama Barang</th>
                  <th className="px-3 py-3">Kategori</th>
                  <th className="px-3 py-3 text-right">Masuk (+)</th>
                  <th className="px-3 py-3 text-right">Keluar (-)</th>
                  <th className="px-3 py-3 text-right">Retur / Koreksi</th>
                  <th className="px-4 py-3 text-right">Stok Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5"><div className="font-bold text-slate-900">{r.name}</div><div className="text-[10px] font-mono text-slate-500">{r.code}</div></td>
                    <td className="px-3 py-2.5 text-slate-600">{r.category}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">+{formatNumber(r.qty_in)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-rose-700">-{formatNumber(r.qty_out)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-purple-700">{Number(r.qty_adj) >= 0 ? `+${formatNumber(r.qty_adj)}` : formatNumber(r.qty_adj)}</td>
                    <td className="px-4 py-2.5 text-right font-black text-slate-900">{formatNumber(r.current_stock)} {r.unit_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'rekap' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b">
                <tr>
                  <th className="px-4 py-3">Kode & Nama Barang</th>
                  <th className="px-3 py-3">Kategori</th>
                  <th className="px-3 py-3 text-center">Batch Aktif</th>
                  <th className="px-3 py-3 text-right">Stok Min</th>
                  <th className="px-3 py-3 text-right">Stok Tersedia</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5"><div className="font-bold text-slate-900">{r.name}</div><div className="text-[10px] font-mono text-slate-500">{r.code}</div></td>
                    <td className="px-3 py-2.5 text-slate-600">{r.category}</td>
                    <td className="px-3 py-2.5 text-center font-semibold">{r.active_batches || 0}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{formatNumber(r.min_stock)} {r.unit_label}</td>
                    <td className="px-3 py-2.5 text-right font-black text-slate-900">{formatNumber(r.stock)} {r.unit_label}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                        r.stock_status === 'Habis' ? 'bg-rose-100 text-rose-800' :
                        r.stock_status === 'Menipis' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>{r.stock_status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'masuk' || activeTab === 'keluar' || activeTab === 'retur' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b">
                <tr>
                  <th className="px-4 py-3">Tanggal & No. Ref</th>
                  <th className="px-3 py-3">Nama Barang</th>
                  <th className="px-3 py-3">Batch & Anggaran</th>
                  <th className="px-3 py-3">Unit / Keterangan</th>
                  <th className="px-3 py-3 text-right">Jumlah</th>
                  <th className="px-4 py-3">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5"><div className="font-mono font-bold text-brand-700">{r.doc_number || `#${r.id}`}</div><div className="text-[11px] text-slate-500">{formatDate(r.trx_date)}</div></td>
                    <td className="px-3 py-2.5"><div className="font-bold text-slate-900">{r.item_name}</div><div className="text-[10px] text-slate-500">{r.category}</div></td>
                    <td className="px-3 py-2.5">{r.fiscal_year} • {r.budget_source} • Batch {r.batch_no || '-'}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.unit_name || 'CSSD'} — {r.correction_reason || r.purpose || r.notes || '-'}</td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-slate-900">{formatNumber(r.quantity)} {r.unit_label}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{r.officer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'per_kategori' || activeTab === 'per_tahun' || activeTab === 'per_anggaran' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b">
                <tr>
                  <th className="px-4 py-3">Kelompok ({currentTabMeta.label})</th>
                  <th className="px-3 py-3 text-center">Jumlah Jenis Barang</th>
                  <th className="px-3 py-3 text-center">Jumlah Batch</th>
                  <th className="px-3 py-3 text-right">Total Stok Awal</th>
                  <th className="px-3 py-3 text-right">Sisa Stok Saat Ini</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Estimasi Nilai (Rp)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-extrabold text-slate-900">{r.group_label || '-'}</td>
                    <td className="px-3 py-3 text-center font-bold">{formatNumber(r.total_items)}</td>
                    <td className="px-3 py-3 text-center">{formatNumber(r.total_batches)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{formatNumber(r.total_initial)}</td>
                    <td className="px-3 py-3 text-right font-black text-brand-700">{formatNumber(r.total_stock)}</td>
                    {isAdmin && <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatRp(r.total_value)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'expired' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b">
                <tr>
                  <th className="px-4 py-3">Nama Barang</th>
                  <th className="px-3 py-3">Batch & Anggaran</th>
                  <th className="px-3 py-3">Tanggal ED</th>
                  <th className="px-3 py-3 text-right">Sisa Stok</th>
                  <th className="px-4 py-3 text-center">Status ED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-bold text-slate-900">{r.item_name}</td>
                    <td className="px-3 py-2.5">{r.batch_no} • {r.fiscal_year} / {r.budget_source}</td>
                    <td className="px-3 py-2.5 font-mono font-bold">{formatDate(r.expiry_date)}</td>
                    <td className="px-3 py-2.5 text-right font-extrabold">{formatNumber(r.stock)} {r.unit_label}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                        r.days_left < 0 ? 'bg-rose-100 text-rose-800' :
                        r.days_left <= 30 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {r.expiry_status} ({r.days_left < 0 ? `Lewat ${Math.abs(r.days_left)} hari` : `${r.days_left} hari lagi`})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b">
                <tr>
                  <th className="px-4 py-3">Kode & Nama Barang</th>
                  <th className="px-3 py-3">Kategori</th>
                  <th className="px-3 py-3">Tahun / Anggaran / Batch</th>
                  <th className="px-3 py-3">ED</th>
                  <th className="px-3 py-3 text-right">Sisa Stok</th>
                  {isAdmin && <th className="px-3 py-3 text-right">Harga Satuan</th>}
                  {isAdmin && <th className="px-4 py-3 text-right">Total Nilai (Rp)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5"><div className="font-bold text-slate-900">{r.item_name}</div><div className="text-[10px] font-mono text-slate-500">{r.item_code}</div></td>
                    <td className="px-3 py-2.5 text-slate-600">{r.category}</td>
                    <td className="px-3 py-2.5">{r.fiscal_year} • {r.budget_source} • {r.batch_no}</td>
                    <td className="px-3 py-2.5">{r.expiry_date ? formatDate(r.expiry_date) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-extrabold">{formatNumber(r.stock)} {r.unit_label}</td>
                    {isAdmin && <td className="px-3 py-2.5 text-right text-slate-700">{formatRp(r.unit_price)}</td>}
                    {isAdmin && <td className="px-4 py-2.5 text-right font-black text-emerald-700">{formatRp(r.total_value)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
