import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  History,
  Lock,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import ResourcePage from '@/components/resource/ResourcePage';
import TraceabilityPage from '@/pages/TraceabilityPage';
import { REPORTS, REPORT_LIST } from '@/config/reports';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatNumber } from '@/utils/format';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const UNLOCK_STORAGE_KEY = 'cssd_smart_report_unlocked';

export default function ReportsHubPage() {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode: 'transaksi' (13 Laporan) atau 'bulanan' (Rekap Bulanan Otomatis)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'transaksi');
  const initialSlug = searchParams.get('jenis') || 'alat-kotor';
  const [selectedSlug, setSelectedSlug] = useState(REPORTS[initialSlug] || initialSlug === 'ketertelusuran' ? initialSlug : 'alat-kotor');

  // Keamanan: Proteksi password khusus Kepala Instalasi / Admin
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem(UNLOCK_STORAGE_KEY) === 'true';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);

  // Filter Rekap Bulanan
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Buka kunci keamanan
  const handleUnlock = async (e) => {
    e?.preventDefault();
    if (!password.trim()) {
      toast.error('Masukkan password khusus Kepala Instalasi / Admin');
      return;
    }
    setUnlockLoading(true);
    try {
      const res = await api.post(API_ENDPOINTS.AUTH.VERIFY_REPORT, { password });
      if (res.data?.success) {
        setIsUnlocked(true);
        sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
        toast.success('Akses laporan berhasil dibuka');
        setPassword('');
      } else {
        toast.error(res.data?.message || 'Password khusus tidak sesuai');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password khusus Kepala Instalasi tidak sesuai');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleLockAgain = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
    toast.success('Pusat laporan berhasil dikunci kembali');
  };

  // Muat data rekap bulanan saat tab bulanan aktif
  const loadMonthlyRecap = async (m, y) => {
    setMonthlyLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.REPORTS_MONTHLY, { params: { month: m, year: y } });
      if (res.data?.success) {
        setMonthlyData(res.data.data);
      }
    } catch (err) {
      toast.error('Gagal memuat rekap bulanan');
    } finally {
      setMonthlyLoading(false);
    }
  };

  useEffect(() => {
    if (isUnlocked && activeTab === 'bulanan') {
      loadMonthlyRecap(selectedMonth, selectedYear);
    }
  }, [isUnlocked, activeTab, selectedMonth, selectedYear]);

  const handleSelectReport = (slug) => {
    setSelectedSlug(slug);
    setSearchParams({ tab: 'transaksi', jenis: slug }, { replace: true });
  };

  const currentConfig = useMemo(() => REPORTS[selectedSlug] || REPORTS['alat-kotor'], [selectedSlug]);

  // Ekspor CSV Rekap Bulanan
  const exportMonthlyCsv = () => {
    if (!monthlyData) return;
    const { steril, dtt, gauze, overall } = monthlyData;
    const lines = [
      ['CSSD SMART - REKAPITULASI BULANAN', `Periode: ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`],
      [],
      ['1. REKAP STERILISASI'],
      ['Total Batch Sterilisasi', steril.total_batches || 0],
      ['Total Paket Kemasan Disterilkan', steril.total_packages || 0],
      ['Verifikasi Lolos', steril.passed_verifications || 0],
      ['Verifikasi Gagal', steril.failed_verifications || 0],
      [],
      ['2. REKAP DTT (REUSE)'],
      ['Total Alat Kotor DTT Diterima', dtt.total_receipts || 0],
      ['Jumlah Fisik Alat Masuk', dtt.total_tools_received || 0],
      ['Kondisi Baik', dtt.condition_baik || 0],
      ['Kondisi Perlu Perbaikan', dtt.condition_perbaikan || 0],
      ['Kondisi Rusak / Afkir', dtt.condition_rusak || 0],
      ['Total Selesai & Terdistribusi', dtt.distributed_quantity || 0],
      [],
      ['3. REKAP DISTRIBUSI KASA STERIL'],
      ['Total Distribusi Kasa (Pcs/Rol)', gauze.total_quantity || 0],
      ['Jumlah Transaksi Distribusi', gauze.total_transactions || 0],
      [],
      ['4. REKAP SELURUH AKTIVITAS CSSD'],
      ['Alat Kotor Masuk', overall?.dirty_receipts || 0],
      ['Jumlah Fisik Alat Kotor', overall?.dirty_items_count || 0],
      ['Proses Pencucian Selesai', overall?.washings_count || 0],
      ['Pengemasan Selesai', overall?.packagings_count || 0],
      ['Siklus Sterilisasi', overall?.steril_batches || 0],
      ['Alat Steril Terdistribusi', overall?.sterile_tools_distributed || 0],
      ['Kasa Steril Terdistribusi', overall?.gauze_distributed || 0],
      ['Penerimaan DTT Masuk', overall?.dtt_receipts || 0],
      ['Distribusi DTT Kembali', overall?.dtt_distributions || 0],
      ['BMHP Keluar / Terpakai', overall?.bmhp_consumed || 0],
      ['Kejadian Karantina / Gagal', overall?.quarantines_count || 0],
      [],
      ['5. WAKTU PROSES & WAKTU TUNGGU PER TAHAPAN CSSD'],
      ['Tahapan', 'Jumlah Data', 'Rata-Rata Lama Proses', 'Rata-Rata Waktu Tunggu', 'Total Lama Proses'],
      ...(monthlyData.timings || []).map((t) => [
        t.stage,
        t.total_records || 0,
        t.avg_process_duration || '-',
        t.avg_wait_duration || '-',
        t.total_process_duration || '-',
      ]),
    ];

    const csvContent = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap-bulanan-cssd-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File Rekap Bulanan berhasil diunduh');
  };

  /* ------------------------------------------------------------
   * LAYAR TERKUNCI (SECURITY LOCK SCREEN)
   * ------------------------------------------------------------ */
  if (!isUnlocked) {
    return (
      <div className="mx-auto max-w-md py-12">
        <div className="card overflow-hidden border border-[#D4AF37]/50 shadow-xl">
          <div className="bg-[#0A192F] p-6 text-center text-white">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 shadow-inner">
              <Lock size={32} className="text-[#E5C07B]" />
            </div>
            <h1 className="mt-3 text-lg font-black tracking-tight sm:text-xl text-white">
              Pusat Laporan CSSD SMART Terkunci
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              Sesuai SOP, seluruh laporan dan rekapitulasi data diproteksi dan hanya bisa dibuka oleh{' '}
              <b className="text-[#E5C07B]">Kepala Instalasi / Admin CSSD</b>.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4 p-6 bg-white">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Password Khusus Kepala Instalasi / Admin
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password khusus..."
                  className="input input-base pr-10 w-full"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* <p className="mt-1 text-[11px] text-slate-400">
                Gunakan password akun Admin Anda (atau PIN standar: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-bold">admin123</code>).
              </p> */}
            </div>

            <button
              type="submit"
              disabled={unlockLoading}
              className="btn btn-primary w-full flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#E5C07B] font-bold"
            >
              {unlockLoading ? <RefreshCw size={16} className="animate-spin" /> : <Unlock size={16} />}
              <span>Buka Akses Laporan</span>
            </button>

            <div className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-800 border border-amber-200 flex items-start gap-2">
              <ShieldAlert size={16} className="shrink-0 text-amber-600 mt-0.5" />
              <span>
                Petugas CSSD tetap dapat melakukan input dan serah terima barcode operasional, namun data laporan dan ekspor tetap terkunci dan aman.
              </span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------
   * LAYAR UTAMA PUSAT LAPORAN TERPADU (UNLOCKED)
   * ------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* Header Pusat Laporan dengan Tombol Kunci Kembali */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Pusat Laporan CSSD SMART"
          subtitle="Pusat laporan terintegrasi seluruh transaksi & rekapitulasi bulanan otomatis RSUD Serpong Utara"
          icon={FileText}
        />
        <div className="no-print flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 shadow-xs">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Akses Terbuka: Admin / Ka. Instalasi</span>
          </div>
          <button
            type="button"
            onClick={handleLockAgain}
            className="btn btn-secondary text-xs flex items-center gap-1.5 text-rose-700 border-rose-200 hover:bg-rose-50"
            title="Kunci kembali agar aman saat komputer ditinggal"
          >
            <Lock size={13} />
            <span>Kunci Kembali</span>
          </button>
        </div>
      </div>

      {/* Navigasi 2 Tab Utama */}
      <div className="no-print flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('transaksi');
            setSearchParams({ tab: 'transaksi', jenis: selectedSlug }, { replace: true });
          }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-extrabold transition ${activeTab === 'transaksi'
              ? 'border-[#0A192F] text-[#0A192F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <FileText size={18} />
          <span>13 Laporan Transaksi Lengkap</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('bulanan');
            setSearchParams({ tab: 'bulanan' }, { replace: true });
          }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-extrabold transition ${activeTab === 'bulanan'
              ? 'border-[#0A192F] text-[#0A192F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Calendar size={18} />
          <span>Rekap Bulanan Otomatis</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            Auto
          </span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: 13 LAPORAN TRANSAKSI SESUAI SUSUNAN CLIENT             */}
      {/* ============================================================ */}
      {activeTab === 'transaksi' && (
        <div className="space-y-5">
          {/* Selector 13 Laporan */}
          <div className="no-print rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4 shadow-xs">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0A192F] text-[#E5C07B] shadow-xs">
                  <Filter size={18} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Pilih Menu Laporan (1-13)
                  </p>
                  <p className="text-xs text-slate-500">
                    Otomatis terisi dari transaksi yang dicatat. Tersedia filter tanggal, cari alat/petugas, cetak, & unduh.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedSlug}
                  onChange={(e) => handleSelectReport(e.target.value)}
                  className="input-base w-full sm:w-80 text-sm font-extrabold text-[#0A192F] py-2 px-3 border-slate-300 focus:border-[#0A192F]"
                >
                  <optgroup label="Alur Pelayanan CSSD">
                    <option value="alat-kotor">1. Laporan Alat Kotor</option>
                    <option value="pencucian">2. Laporan Pencucian</option>
                    <option value="pengeringan">3. Laporan Pengeringan</option>
                    <option value="pengemasan">4. Laporan Pengemasan</option>
                    <option value="sterilisasi">5. Laporan Sterilisasi</option>
                    <option value="verifikasi">6. Laporan Verifikasi</option>
                    <option value="karantina">12. Laporan Karantina/Gagal</option>
                  </optgroup>
                  <optgroup label="Stok, Pengambilan, & DTT">
                    <option value="stok-steril">7. Laporan Stok Alat Steril</option>
                    <option value="distribusi-alat">8. Laporan Pengambilan Alat Steril</option>
                    <option value="distribusi-kasa">9. Laporan Pengambilan Kasa Steril</option>
                    <option value="distribusi-dtt">10. Laporan Distribusi Alat DTT</option>
                    <option value="stok-bmhp">11. Laporan Stok BMHP</option>
                    <option value="ketertelusuran">13. Laporan Ketertelusuran</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Quick Pills untuk seluruh 13 Laporan */}
            <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
              {REPORT_LIST.map((r) => {
                const isSelected = selectedSlug === r.slug;
                return (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => handleSelectReport(r.slug)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${isSelected
                        ? 'bg-[#0A192F] text-[#E5C07B] shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                      }`}
                  >
                    {isSelected && <CheckCircle2 size={12} className="text-[#E5C07B]" />}
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Konten Laporan Aktif */}
          {selectedSlug === 'ketertelusuran' ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <TraceabilityPage />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-4 shadow-xs">
              <ResourcePage key={currentConfig.key} config={currentConfig} />
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: REKAP BULANAN OTOMATIS                                 */}
      {/* ============================================================ */}
      {activeTab === 'bulanan' && (
        <div className="space-y-6">
          {/* Filter Bar Bulan & Tahun */}
          <div className="no-print flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-[#0A192F]" />
                <span className="text-xs font-bold text-slate-700">Periode Rekap:</span>
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="input-base text-sm font-bold text-slate-800 py-1.5 px-3"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    Bulan {name}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="input-base text-sm font-bold text-slate-800 py-1.5 px-3"
              >
                {[2026, 2025, 2024, 2027].map((y) => (
                  <option key={y} value={y}>
                    Tahun {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => loadMonthlyRecap(selectedMonth, selectedYear)}
                disabled={monthlyLoading}
                className="btn btn-secondary text-xs flex items-center gap-1.5"
              >
                <RefreshCw size={14} className={monthlyLoading ? 'animate-spin' : ''} />
                <span>Segarkan Data</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportMonthlyCsv}
                disabled={!monthlyData}
                className="btn btn-secondary text-xs flex items-center gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              >
                <FileSpreadsheet size={15} />
                <span>Unduh Excel (CSV)</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary text-xs flex items-center gap-1.5 bg-[#0A192F] text-white hover:bg-[#112240]"
              >
                <Printer size={15} />
                <span>Cetak Rekap Bulanan</span>
              </button>
            </div>
          </div>

          {/* Area Cetak & Tampilan Rekap Bulanan */}
          {monthlyLoading ? (
            <div className="card flex items-center justify-center py-20 text-slate-500 gap-2">
              <RefreshCw size={24} className="animate-spin text-[#0A192F]" />
              <span className="text-sm font-semibold">Menghitung rekapitulasi bulanan seluruh modul...</span>
            </div>
          ) : !monthlyData ? (
            <div className="card text-center py-12 text-slate-400">Belum ada data rekap.</div>
          ) : (
            <div className="space-y-6 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs print:p-0 print:border-none">
              {/* Header Cetak Formal */}
              <div className="border-b border-slate-200 pb-4 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">RSUD SERPONG UTARA</p>
                <h2 className="text-xl font-black text-[#0A192F] sm:text-2xl">
                  REKAPITULASI PELAYANAN BULANAN CSSD SMART
                </h2>
                <p className="text-sm font-semibold text-slate-600 mt-1">
                  Periode: <b className="text-slate-900">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</b>
                </p>
              </div>

              {/* 1. Rekap Sterilisasi Bulanan */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                    1
                  </span>
                  <h3 className="text-base font-extrabold text-blue-950 flex items-center gap-2">
                    <Flame size={18} className="text-blue-600" />
                    <span>Rekap Steril</span>
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Total Siklus Batch</p>
                    <p className="text-2xl font-black text-blue-900">{formatNumber(monthlyData.steril.total_batches || 0)}</p>
                    <p className="text-[10px] text-slate-400">Proses mesin</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Total Paket Steril</p>
                    <p className="text-2xl font-black text-blue-900">{formatNumber(monthlyData.steril.total_packages || 0)}</p>
                    <p className="text-[10px] text-slate-400">Kemasan instrumen</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Verifikasi Lolos</p>
                    <p className="text-2xl font-black text-emerald-600">{formatNumber(monthlyData.steril.passed_verifications || 0)}</p>
                    <p className="text-[10px] text-emerald-600 font-bold">100% Memenuhi syarat</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Verifikasi Gagal</p>
                    <p className="text-2xl font-black text-rose-600">{formatNumber(monthlyData.steril.failed_verifications || 0)}</p>
                    <p className="text-[10px] text-slate-400">Siklus ulang / karantina</p>
                  </div>
                </div>

                {/* Rincian per mesin */}
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-2">Rincian Siklus per Tipe Mesin:</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {monthlyData.steril.machines?.length > 0 ? (
                      monthlyData.steril.machines.map((m) => (
                        <div key={m.machine_name} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                          <p className="font-bold text-slate-800 truncate">{m.machine_name}</p>
                          <p className="text-sm font-extrabold text-blue-700">{m.batch_count} siklus</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 col-span-5">Belum ada siklus mesin di bulan ini.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Rekap DTT (Reuse) Bulanan */}
              <div className="rounded-2xl border border-violet-200 bg-violet-50/30 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white font-bold text-xs">
                    2
                  </span>
                  <h3 className="text-base font-extrabold text-violet-950 flex items-center gap-2">
                    <Sparkles size={18} className="text-violet-600" />
                    <span>Rekap DTT (Reuse)</span>
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                  <div className="bg-white p-3 rounded-xl border border-violet-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Total DTT Diterima</p>
                    <p className="text-2xl font-black text-violet-900">{formatNumber(monthlyData.dtt.total_receipts || 0)}</p>
                    <p className="text-[10px] text-slate-400">Barcode penerimaan RD</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-violet-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Fisik Alat Masuk</p>
                    <p className="text-2xl font-black text-violet-900">{formatNumber(monthlyData.dtt.total_tools_received || 0)}</p>
                    <p className="text-[10px] text-slate-400">Pcs / Sungkup / Tabung</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-violet-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Selesai & Didistribusikan</p>
                    <p className="text-2xl font-black text-emerald-600">{formatNumber(monthlyData.dtt.distributed_quantity || 0)}</p>
                    <p className="text-[10px] text-slate-400">{monthlyData.dtt.distributed_count || 0} serah terima</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-violet-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Kondisi Alat</p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-bold">
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Baik: {monthlyData.dtt.condition_baik || 0}</span>
                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Servis: {monthlyData.dtt.condition_perbaikan || 0}</span>
                      <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">Rusak: {monthlyData.dtt.condition_rusak || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Rekap Kasa Steril Bulanan */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
                    3
                  </span>
                  <h3 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                    <Boxes size={18} className="text-emerald-600" />
                    <span>Rekap Kasa Steril</span>
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Total Kasa Didistribusikan</p>
                    <p className="text-2xl font-black text-emerald-900">{formatNumber(monthlyData.gauze.total_quantity || 0)}</p>
                    <p className="text-[10px] text-slate-400">Total rol & lembar</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Total Transaksi Penyerahan</p>
                    <p className="text-2xl font-black text-emerald-900">{formatNumber(monthlyData.gauze.total_transactions || 0)}</p>
                    <p className="text-[10px] text-slate-400">Barcode distribusi DK</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                    <p className="text-xs text-slate-500 font-semibold">Unit Penerima Aktif</p>
                    <p className="text-2xl font-black text-emerald-900">{monthlyData.gauze.by_unit?.length || 0}</p>
                    <p className="text-[10px] text-slate-400">Ruangan / Instalasi</p>
                  </div>
                </div>

                {/* Breakdown per jenis kasa */}
                {monthlyData.gauze.by_type?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-bold text-slate-700 mb-1.5">Distribusi per Jenis Kasa:</p>
                    <div className="flex flex-wrap gap-2">
                      {monthlyData.gauze.by_type.map((t) => (
                        <span key={t.gauze_type} className="bg-white border border-emerald-200 px-3 py-1 rounded-lg text-xs font-semibold text-emerald-900">
                          {t.gauze_type}: <b>{formatNumber(t.quantity)}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Rekap Seluruh Aktivitas CSSD (Ringkasan Komprehensif) */}
              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0A192F] text-white font-bold text-xs">
                    4
                  </span>
                  <h3 className="text-base font-extrabold text-[#0A192F] flex items-center gap-2">
                    <FileText size={18} className="text-[#0A192F]" />
                    <span>Rekap Seluruh Aktivitas CSSD (Ringkasan Eksekutif)</span>
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0A192F] text-[#E5C07B] uppercase tracking-wider font-extrabold">
                      <tr>
                        <th className="p-2.5 rounded-l-lg">No</th>
                        <th className="p-2.5">Aktivitas / Modul Operasional</th>
                        <th className="p-2.5 text-right">Volume Bulan Ini</th>
                        <th className="p-2.5 rounded-r-lg">Keterangan / Satuan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-semibold text-slate-700 bg-white">
                      <tr>
                        <td className="p-2.5 font-bold">1</td>
                        <td className="p-2.5">Penerimaan Alat Kotor (Unit $\rightarrow$ CSSD)</td>
                        <td className="p-2.5 text-right font-extrabold text-slate-900">{formatNumber(monthlyData.overall.dirty_receipts)}</td>
                        <td className="p-2.5 text-slate-500">Transaksi ({formatNumber(monthlyData.overall.dirty_items_count)} instrumen fisik)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">2</td>
                        <td className="p-2.5">Pencucian & Dekontaminasi</td>
                        <td className="p-2.5 text-right font-extrabold text-slate-900">{formatNumber(monthlyData.overall.washings_count)}</td>
                        <td className="p-2.5 text-slate-500">Siklus pencucian (Washer & Manual)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">3</td>
                        <td className="p-2.5">Pengemasan & Pelabelan Barcode</td>
                        <td className="p-2.5 text-right font-extrabold text-slate-900">{formatNumber(monthlyData.overall.packagings_count)}</td>
                        <td className="p-2.5 text-slate-500">Paket instrumen siap steril</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">4</td>
                        <td className="p-2.5">Sterilisasi (Autoclave, Steam, Plasma)</td>
                        <td className="p-2.5 text-right font-extrabold text-slate-900">{formatNumber(monthlyData.overall.steril_batches)}</td>
                        <td className="p-2.5 text-slate-500">Siklus sterilisasi tercatat</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">5</td>
                        <td className="p-2.5">Pengambilan Alat Steril (CSSD $\rightarrow$ Unit)</td>
                        <td className="p-2.5 text-right font-extrabold text-emerald-700">{formatNumber(monthlyData.overall.sterile_tools_distributed)}</td>
                        <td className="p-2.5 text-slate-500">Paket instrumen diserahterimakan</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">6</td>
                        <td className="p-2.5">Pengambilan Kasa Steril</td>
                        <td className="p-2.5 text-right font-extrabold text-emerald-700">{formatNumber(monthlyData.overall.gauze_distributed)}</td>
                        <td className="p-2.5 text-slate-500">Kasa lipat & rol diserahterimakan</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">7</td>
                        <td className="p-2.5">Transaksi Alat Medis DTT (Reuse)</td>
                        <td className="p-2.5 text-right font-extrabold text-violet-700">{formatNumber(monthlyData.overall.dtt_receipts)}</td>
                        <td className="p-2.5 text-slate-500">Penerimaan ({monthlyData.overall.dtt_distributions} terdistribusi kembali)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">8</td>
                        <td className="p-2.5">Pemakaian BMHP (Barang Medis Habis Pakai)</td>
                        <td className="p-2.5 text-right font-extrabold text-amber-700">{formatNumber(monthlyData.overall.bmhp_consumed)}</td>
                        <td className="p-2.5 text-slate-500">Item bahan habis pakai dikeluarkan</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">9</td>
                        <td className="p-2.5">Insiden Karantina / Uji Mutu Gagal</td>
                        <td className="p-2.5 text-right font-extrabold text-rose-600">{formatNumber(monthlyData.overall.quarantines_count)}</td>
                        <td className="p-2.5 text-slate-500">Paket ditahan untuk investigasi</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. Rekap Lama Proses & Waktu Tunggu per Tahapan CSSD */}
              {monthlyData.timings?.length > 0 && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50/30 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white font-bold text-xs">
                      5
                    </span>
                    <h3 className="text-base font-extrabold text-sky-950 flex items-center gap-2">
                      <Clock size={18} className="text-sky-600" />
                      <span>Waktu Proses &amp; Waktu Tunggu per Tahapan CSSD</span>
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0A192F] text-[#E5C07B] uppercase tracking-wider font-extrabold">
                        <tr>
                          <th className="p-2.5 rounded-l-lg">Tahapan Proses CSSD</th>
                          <th className="p-2.5 text-right">Jumlah Data</th>
                          <th className="p-2.5 text-right">Rata-Rata Lama Proses</th>
                          <th className="p-2.5 text-right">Rata-Rata Waktu Tunggu</th>
                          <th className="p-2.5 text-right rounded-r-lg">Total Lama Proses</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-semibold text-slate-700 bg-white">
                        {monthlyData.timings.map((t) => (
                          <tr key={t.stage}>
                            <td className="p-2.5 font-bold text-slate-900">{t.stage}</td>
                            <td className="p-2.5 text-right font-mono">{formatNumber(t.total_records || 0)}</td>
                            <td className="p-2.5 text-right font-bold text-sky-700">{t.avg_process_duration || '-'}</td>
                            <td className="p-2.5 text-right font-bold text-amber-700">{t.avg_wait_duration || '-'}</td>
                            <td className="p-2.5 text-right font-mono text-slate-600">{t.total_process_duration || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tanda Tangan Pengesahan Laporan Bulanan */}
              <div className="grid grid-cols-2 pt-6 text-center text-xs text-slate-700">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold mt-1">Kepala Instalasi CSSD</p>
                  <div className="h-20" />
                  <p className="font-bold underline text-slate-900">Inge Kusryaningsih, S.Kep., Ners</p>
                  <p className="text-slate-500 text-[11px]">NIP. 198506152010012024</p>
                </div>
                <div>
                  <p>Serpong Utara, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="font-bold mt-1">Petugas Pengelola Data Laporan</p>
                  <div className="h-20" />
                  <p className="font-bold underline text-slate-900">{user?.name || 'Administrator CSSD'}</p>
                  <p className="text-slate-500 text-[11px]">CSSD SMART RSUD Serpong Utara</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
