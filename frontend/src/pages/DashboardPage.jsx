import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  Archive,
  CalendarCheck2,
  CalendarX,
  CheckCircle2,
  ClipboardCheck,
  History,
  Layers,
  Package,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import FlowStrip from '@/components/dashboard/FlowStrip';
import InfoPanel from '@/components/dashboard/InfoPanel';
import MenuGrid from '@/components/dashboard/MenuGrid';
import BarcodeInput from '@/components/form/BarcodeInput';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import ErrorState from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import useFetch from '@/hooks/useFetch';
import { ROUTES } from '@/config/routes';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, formatDateTime, formatNumber } from '@/utils/format';
import officerPhoto from '../../assets/foto.jpeg';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isUnit = user?.role === 'unit';
  const { data, loading, error, reload } = useFetch(API_ENDPOINTS.DASHBOARD);
  const [code, setCode] = useState('');

  const trace = (value) => {
    const barcode = value.trim();
    if (barcode) navigate(`${ROUTES.TRACE}?barcode=${encodeURIComponent(barcode)}`);
  };

  const totals = data?.totals || {};

  return (
    <div className="space-y-6">
      {/* Hero Section matching referensi image.png dengan foto.jpeg */}
      <section className="relative overflow-hidden rounded-3xl border border-[#E5C07B]/40 bg-gradient-to-br from-white via-[#FDFBF7] to-[#F5EFE3] p-5 shadow-sm sm:p-7">
        {/* Decorative background swirls and circles */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#E5C07B]/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-[#0A192F]/5 blur-xl" />

        <div className="relative grid items-center gap-6 lg:grid-cols-[auto_1fr] xl:gap-8">
          {/* Foto Petugas CSSD dengan bingkai emas elegan */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative group">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-[#0A192F] via-[#D4AF37] to-[#F3E5AB] opacity-75 blur-xs transition group-hover:opacity-100" />
              <div className="relative h-44 w-44 sm:h-52 sm:w-52 md:h-60 md:w-60 overflow-hidden rounded-3xl border-2 border-white shadow-xl bg-slate-100">
                <img
                  src={officerPhoto}
                  alt="Petugas CSSD RSUD Serpong Utara"
                  className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback ke folder public jika path relatif terkendala
                    e.currentTarget.src = '/foto.jpeg';
                  }}
                />
              </div>
              <div className="absolute -bottom-2 -right-2 rounded-full border border-white bg-[#0A192F] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#E5C07B] shadow-md">
                Petugas CSSD
              </div>
            </div>
          </div>

          {/* Kolom Informasi & Branding */}
          <div className="space-y-3.5 text-center lg:text-left">
            <div>
              <p className="font-serif italic text-xl sm:text-2xl text-slate-700 tracking-wide">
                Selamat Datang di
              </p>
              <div className="mt-1 flex flex-wrap items-baseline justify-center gap-2 lg:justify-start">
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl text-[#0A192F]">
                  CSSD <span className="text-[#C89D35]">SMART</span>
                </h1>
                <span className="rounded-full bg-[#0A192F] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#E5C07B] shadow-xs">
                  RSUD SERPONG UTARA
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Sterile Management System
              </p>
            </div>

            {/* Deskripsi resmi aplikasi sesuai permintaan client */}
            <p className="max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-700 text-justify sm:text-left">
              CSSD SMART merupakan sistem digital terintegrasi untuk pengelolaan seluruh pelayanan CSSD,
              mulai dari penerimaan alat kotor, pencucian, pengeringan, pemeriksaan, pengemasan, sterilisasi
              dan DTT, verifikasi, penyimpanan, hingga distribusi alat steril, hasil DTT, dan kasa steril.
              Dilengkapi barcode, tanda tangan digital, serta manajemen inventaris BMHP untuk mendukung
              efisiensi, ketertelusuran, dan peningkatan mutu pelayanan CSSD.
            </p>

            {/* Slogan Banner Chips sesuai revisi */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 lg:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-white/80 px-3 py-1 text-xs font-extrabold text-[#0A192F] shadow-xs backdrop-blur">
                <ShieldCheck size={14} className="text-[#C89D35]" /> Akurat
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-white/80 px-3 py-1 text-xs font-extrabold text-[#0A192F] shadow-xs backdrop-blur">
                <ScanLine size={14} className="text-[#C89D35]" /> Terlacak
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-white/80 px-3 py-1 text-xs font-extrabold text-[#0A192F] shadow-xs backdrop-blur">
                <ClipboardCheck size={14} className="text-[#C89D35]" /> Terdokumentasi
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-white/80 px-3 py-1 text-xs font-extrabold text-[#0A192F] shadow-xs backdrop-blur">
                <Sparkles size={14} className="text-[#C89D35]" /> Terintegrasi
              </span>
            </div>

            {/* Barcode Quick Search box */}
            <div className="pt-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs max-w-xl mx-auto lg:mx-0">
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <ScanLine size={15} className="text-[#0A192F]" />
                  <span>Cek ketertelusuran cepat</span>
                </p>
                <div className="mt-1.5">
                  <BarcodeInput
                    value={code}
                    onChange={setCode}
                    onCommit={trace}
                    placeholder="Scan barcode alat kotor (AK-), steril (DS-), kasa (DK-), DTT (RD-/DDTT-)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ringkasan 4 Kartu Cepat sesuai referensi image.png */}
      {loading && !data ? (
        <CardSkeleton count={4} />
      ) : error && !data ? (
        <div className="card">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : (
        <>
          <section
            aria-label="Ringkasan Statistik Cepat"
            className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {/* Card 1: Transaksi Hari Ini */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-amber-200 bg-white p-4 shadow-xs transition hover:shadow-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <CalendarCheck2 size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">
                  {isUnit ? 'Transaksi Unit Hari Ini' : 'Transaksi Hari Ini'}
                </p>
                <p className="text-2xl font-black text-slate-900">
                  {formatNumber(totals.today_transactions || totals.received_today || 0)}
                </p>
                <p className="truncate text-[10px] text-slate-400">Barcode tercatat</p>
              </div>
            </div>

            {/* Card 2: Proses Aktif */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs transition hover:shadow-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">
                  {isUnit ? 'Alat Sedang Diproses' : 'Proses Aktif'}
                </p>
                <p className="text-2xl font-black text-emerald-600">
                  {formatNumber(totals.active_processes || 0)}
                </p>
                <p className="truncate text-[10px] text-slate-400">Dalam alur sterilisasi</p>
              </div>
            </div>

            {/* Card 3: Stok BMHP (atau DTT Aktif untuk Unit) */}
            {isUnit ? (
              <div className="flex items-center gap-3.5 rounded-2xl border border-violet-200 bg-white p-4 shadow-xs transition hover:shadow-md">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Sparkles size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">DTT Unit Berjalan</p>
                  <p className="text-2xl font-black text-violet-600">
                    {formatNumber(totals.dtt_active || 0)}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">Alat medis reuse</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3.5 rounded-2xl border border-amber-200 bg-white p-4 shadow-xs transition hover:shadow-md">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F5EFE3] text-[#A67C1E]">
                  <Package size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">Stok BMHP</p>
                  <p className="text-2xl font-black text-slate-900">
                    {formatNumber(totals.bmhp_stock_total || 0)}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">Item bahan medis</p>
                </div>
              </div>
            )}

            {/* Card 4: Alat Steril Siap Distribusi */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-sky-200 bg-white p-4 shadow-xs transition hover:shadow-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <ClipboardCheck size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">
                  {isUnit ? 'Alat Siap Diambil' : 'Alat Steril Siap Distribusi'}
                </p>
                <p className="text-2xl font-black text-sky-600">
                  {formatNumber(totals.sterile_stock || 0)}
                </p>
                <p className="truncate text-[10px] text-slate-400">Paket steril siap pakai</p>
              </div>
            </div>
          </section>

          {/* Alur Proses CSSD (Live Workflow) 8 Tahap */}
          <section aria-labelledby="alur-proses">
            <FlowStrip data={data} />
          </section>
        </>
      )}

      {/* Menu Utama dengan Search Bar Real-time */}
      <MenuGrid />

      {/* Panel Informasi & Peringatan (Hanya Petugas CSSD / Admin) */}
      {!isUnit && data && (
        <section aria-label="Peringatan Operasional" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <InfoPanel
            title="Karantina / Gagal Verifikasi"
            icon={AlertOctagon}
            tone="bg-rose-100 text-rose-600"
            to={ROUTES.REPORT('karantina')}
            emptyText="Tidak ada paket di karantina"
            rows={(data.recentQuarantines || []).map((q) => ({
              key: q.id,
              title: q.barcode,
              meta: `${q.batch_no} • ${q.reason}`,
              badge: <Badge tone="rose">{formatDateTime(q.created_at).slice(0, 10)}</Badge>,
            }))}
          />
          <InfoPanel
            title="Segera Kedaluwarsa (≤ 30 hari)"
            icon={CalendarX}
            tone="bg-amber-100 text-amber-600"
            to={ROUTES.REPORT('stok-steril')}
            emptyText="Tidak ada paket yang segera kedaluwarsa"
            rows={(data.expiring || []).map((s) => ({
              key: s.id,
              title: `${s.item_name} (${s.barcode})`,
              meta: `${s.quantity} ${s.unit_label} • exp ${formatDate(s.expiry_date)}`,
              badge: (
                <Badge tone={s.days_left < 0 ? 'rose' : 'amber'}>
                  {s.days_left < 0 ? 'Lewat' : `${s.days_left} hari`}
                </Badge>
              ),
            }))}
          />
          <InfoPanel
            title="BMHP Menipis & Kedaluwarsa"
            icon={Archive}
            tone="bg-sky-100 text-sky-600"
            to={ROUTES.BMHP_STOCK}
            emptyText="Semua stok BMHP aman"
            rows={(data.lowBmhp || []).map((b) => ({
              key: b.id,
              title: b.name,
              meta: `${b.code} • Min: ${b.min_stock} ${b.unit_label}${
                b.batch_no ? ` • Batch: ${b.batch_no}` : ''
              }${b.expiry_date ? ` • Exp: ${formatDate(b.expiry_date)}` : ''}`,
              badge: (
                <Badge
                  tone={
                    b.stock <= 0
                      ? 'rose'
                      : b.expiry_status === 'Kedaluwarsa'
                      ? 'rose'
                      : 'amber'
                  }
                >
                  {b.stock <= 0
                    ? 'Habis (0)'
                    : b.expiry_status === 'Kedaluwarsa'
                    ? 'Expired'
                    : `${b.stock} ${b.unit_label}`}
                </Badge>
              ),
            }))}
          />
          <InfoPanel
            title="Verifikasi Mutu Sterilisasi Terbaru"
            icon={ShieldCheck}
            tone="bg-emerald-100 text-emerald-600"
            to={ROUTES.REPORT('verifikasi')}
            emptyText="Belum ada verifikasi"
            rows={(data.recentVerifications || []).map((v) => ({
              key: v.id,
              title: v.batch_no,
              meta: v.fail_reason || `Diverifikasi ${formatDate(v.verify_date)}`,
              badge: <StatusBadge value={v.result} />,
            }))}
          />
        </section>
      )}

      {/* Unit Luar Info Panel (Hanya Riwayat Unit Sendiri) */}
      {isUnit && data && (
        <section aria-label="Informasi Unit" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card space-y-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A192F]">
              <Truck size={18} className="text-emerald-600" />
              <span>Status Pengambilan Alat Steril</span>
            </div>
            <p className="text-xs text-slate-600">
              Unit <b className="text-slate-900">{user?.unit_name}</b> memiliki{' '}
              <b className="text-emerald-700">{totals.sterile_stock || 0}</b> paket steril siap diambil di CSSD.
            </p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.DIST_TOOLS)}
              className="btn btn-primary text-xs"
            >
              Buka Pengambilan Alat Steril
            </button>
          </div>

          <div className="card space-y-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A192F]">
              <History size={18} className="text-sky-600" />
              <span>Ketertelusuran Barcode Unit</span>
            </div>
            <p className="text-xs text-slate-600">
              Lacak riwayat perjalanan dan status pemrosesan instrumen medis unit Anda secara langsung.
            </p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.TRACE)}
              className="btn btn-secondary text-xs"
            >
              Lacak Barcode Unit
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
