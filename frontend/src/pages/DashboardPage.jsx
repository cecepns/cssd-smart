import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  Archive,
  Award,
  CalendarCheck2,
  CalendarX,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  Package,
  ScanLine,
  Share2,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import FlowStrip from '@/components/dashboard/FlowStrip';
import InfoPanel from '@/components/dashboard/InfoPanel';
import MenuGrid from '@/components/dashboard/MenuGrid';
import BarcodeInput from '@/components/form/BarcodeInput';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import useFetch from '@/hooks/useFetch';
import { ROUTES } from '@/config/routes';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, formatDateTime, formatNumber } from '@/utils/format';
import officerPhoto from '../../assets/foto-1.jpeg';

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
      {/* Hero Banner Showcase + Quick Trace Strip sesuai referensi desain */}
      <div className="space-y-3">
        <section className="relative overflow-hidden rounded-3xl border border-sky-200/90 bg-gradient-to-br from-white via-[#F1F8FF] to-[#DDEEFF] shadow-[0_14px_40px_-12px_rgba(0,75,180,0.2)]">
          {/* Dekorasi lengkung biru & emas di sudut (tipis di tepi agar tidak menutup teks) */}
          <svg
            aria-hidden="true"
            viewBox="0 0 220 120"
            className="pointer-events-none absolute -left-1 -top-1 z-20 h-14 w-24 sm:h-16 sm:w-28"
          >
            <path d="M0,0 L165,0 C95,12 45,38 0,88 Z" fill="#002D85" />
            <path d="M0,0 L132,0 C82,18 40,42 0,74 Z" fill="#0066CC" opacity="0.55" />
            <path d="M168,0 C100,14 48,40 0,84 L0,96 C50,48 104,20 185,0 Z" fill="#FFD028" />
          </svg>
          <svg
            aria-hidden="true"
            viewBox="0 0 200 110"
            className="pointer-events-none absolute -bottom-1 -left-1 z-20 h-12 w-24 sm:h-14 sm:w-28"
          >
            <path d="M0,110 L0,26 C38,62 85,90 160,110 Z" fill="#002D85" />
            <path d="M0,18 C42,56 90,88 175,110 L155,110 C86,91 38,62 0,28 Z" fill="#FFD028" />
          </svg>
          <svg
            aria-hidden="true"
            viewBox="0 0 180 100"
            className="pointer-events-none absolute -bottom-1 -right-1 z-20 h-12 w-24 sm:h-16 sm:w-32"
          >
            <path d="M180,100 L35,100 C98,82 142,52 180,16 Z" fill="#002D85" />
            <path d="M25,100 C92,82 140,52 180,10 L180,20 C144,54 96,84 40,100 Z" fill="#FFD028" />
          </svg>

          {/* Glow latar halus */}
          <div className="pointer-events-none absolute -top-20 left-1/3 h-64 w-64 rounded-full bg-sky-300/25 blur-3xl" />

          <div className="relative grid items-stretch lg:grid-cols-[1.12fr_0.88fr] xl:grid-cols-[1.15fr_0.85fr]">
            {/* Kolom Kiri: Branding Centered, Deskripsi Resmi & 4 Slogan */}
            <div className="relative z-10 flex flex-col justify-center space-y-3.5 px-5 py-6 sm:px-8 sm:py-7 lg:pl-10 lg:pr-4">
              <div className="pt-2 text-center sm:pt-1">
                <p className="font-serif italic text-xl font-semibold tracking-wide text-[#00338D] sm:text-2xl lg:text-[26px]">
                  Selamat Datang di
                </p>
                <h1 className="mt-1 text-4xl font-black leading-none tracking-tight text-[#001F5F] sm:text-5xl lg:text-[52px]">
                  CSSD{' '}
                  <span className="italic text-[#F5A600] drop-shadow-[0_2px_10px_rgba(245,166,0,0.3)]">
                    SMART
                  </span>
                </h1>
                <div className="mt-2.5 flex justify-center">
                  <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FFE36E] via-[#FFD233] to-[#FFCA28] px-5 py-1.5 text-xs font-extrabold tracking-wide text-[#001A4D] shadow-[0_4px_14px_rgba(255,208,40,0.45)] sm:text-sm">
                    Sterile Management System
                  </span>
                </div>
              </div>

              {/* Deskripsi resmi aplikasi sesuai permintaan client */}
              <p className="mx-auto max-w-2xl text-justify text-xs leading-relaxed text-[#1E293B] sm:text-[13.5px]">
                CSSD SMART merupakan sistem digital terintegrasi untuk pengelolaan seluruh pelayanan CSSD,
                mulai dari penerimaan alat kotor, pencucian, pengeringan, pemeriksaan, pengemasan, sterilisasi
                dan DTT, verifikasi, penyimpanan, hingga distribusi alat steril, hasil DTT, dan kasa steril.
                Dilengkapi barcode, tanda tangan digital, serta manajemen inventaris BMHP untuk mendukung
                efisiensi, ketertelusuran, dan peningkatan mutu pelayanan CSSD.
              </p>

              {/* 4 Pill Slogan: Akurat | Terlacak | Terdokumentasi | Terintegrasi */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white/95 px-3.5 py-1.5 text-xs font-extrabold text-[#002266] shadow-xs backdrop-blur">
                  <ShieldCheck size={14} className="text-[#F59E0B]" /> Akurat
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white/95 px-3.5 py-1.5 text-xs font-extrabold text-[#002266] shadow-xs backdrop-blur">
                  <Share2 size={14} className="text-[#F59E0B]" /> Terlacak
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white/95 px-3.5 py-1.5 text-xs font-extrabold text-[#002266] shadow-xs backdrop-blur">
                  <FileText size={14} className="text-[#F59E0B]" /> Terdokumentasi
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white/95 px-3.5 py-1.5 text-xs font-extrabold text-[#002266] shadow-xs backdrop-blur">
                  <Award size={14} className="text-[#F59E0B]" /> Terintegrasi
                </span>
              </div>
            </div>

            {/* Kolom Kanan: Foto Petugas CSSD (foto-1.jpeg) menyatu halus dengan hero */}
            <div className="relative flex max-h-[300px] min-h-[240px] items-end justify-center overflow-hidden sm:max-h-[340px] lg:max-h-none lg:min-h-[340px]">
              {/* Fade lembut agar sisi kiri foto menyatu halus dengan area teks */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-20 bg-gradient-to-r from-[#EBF5FF] via-[#EBF5FF]/55 to-transparent lg:block"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-[#EDF6FF] to-transparent lg:hidden"
              />
              <img
                src={officerPhoto}
                alt="Petugas CSSD RSUD Serpong Utara"
                className="h-full w-full object-cover object-top lg:object-[25%_10%] xl:object-[35%_8%]"
                onError={(e) => {
                  e.currentTarget.src = '/foto-1.jpeg';
                }}
              />
            </div>
          </div>
        </section>

        {/* Strip Cek Ketertelusuran Cepat di bawah hero card sesuai referensi */}
        <div className="rounded-2xl border border-sky-200/90 bg-white/95 p-3.5 shadow-[0_8px_24px_-8px_rgba(0,75,180,0.14)] backdrop-blur-sm sm:px-5 sm:py-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-extrabold text-[#002266] sm:text-sm">
            <ScanLine size={16} className="text-[#0044AA]" />
            <span>Cek ketertelusuran cepat</span>
          </p>
          <BarcodeInput
            hero
            value={code}
            onChange={setCode}
            onCommit={trace}
            placeholder="Scan barcode alat kotor (AK-), steril (DS-), kasa (DK-), DTT (RD-/DDTT-)"
          />
        </div>
      </div>

      {/* Ringkasan 4 Kartu Cepat - Layout tetap, warna dibuat cerah, nyala, dan hidup */}
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
            <div className="flex items-center gap-3.5 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-white via-amber-50/60 to-amber-100/50 p-4 shadow-[0_6px_20px_-6px_rgba(245,158,11,0.2)] transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30">
                <CalendarCheck2 size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-600">
                  {isUnit ? 'Transaksi Unit Hari Ini' : 'Transaksi Hari Ini'}
                </p>
                <p className="text-2xl font-black text-amber-600">
                  {formatNumber(totals.today_transactions || totals.received_today || 0)}
                </p>
                <p className="truncate text-[10px] font-medium text-slate-500">Barcode tercatat</p>
              </div>
            </div>

            {/* Card 2: Proses Aktif */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-white via-emerald-50/60 to-emerald-100/50 p-4 shadow-[0_6px_20px_-6px_rgba(16,185,129,0.2)] transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-md shadow-emerald-500/30">
                <CheckCircle2 size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-600">
                  {isUnit ? 'Alat Sedang Diproses' : 'Proses Aktif'}
                </p>
                <p className="text-2xl font-black text-emerald-600">
                  {formatNumber(totals.active_processes || 0)}
                </p>
                <p className="truncate text-[10px] font-medium text-slate-500">Dalam alur sterilisasi</p>
              </div>
            </div>

            {/* Card 3: Stok BMHP (atau DTT Aktif untuk Unit) */}
            {isUnit ? (
              <div className="flex items-center gap-3.5 rounded-2xl border border-violet-200/90 bg-gradient-to-br from-white via-violet-50/60 to-purple-100/50 p-4 shadow-[0_6px_20px_-6px_rgba(139,92,246,0.2)] transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30">
                  <Sparkles size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-600">DTT Unit Berjalan</p>
                  <p className="text-2xl font-black text-violet-600">
                    {formatNumber(totals.dtt_active || 0)}
                  </p>
                  <p className="truncate text-[10px] font-medium text-slate-500">Alat medis reuse</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3.5 rounded-2xl border border-violet-200/90 bg-gradient-to-br from-white via-violet-50/60 to-purple-100/50 p-4 shadow-[0_6px_20px_-6px_rgba(139,92,246,0.2)] transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30">
                  <Package size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-600">Stok BMHP</p>
                  <p className="text-2xl font-black text-violet-700">
                    {formatNumber(totals.bmhp_stock_total || 0)}
                  </p>
                  <p className="truncate text-[10px] font-medium text-slate-500">Item bahan medis</p>
                </div>
              </div>
            )}

            {/* Card 4: Alat Steril Siap Distribusi */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-sky-200/90 bg-gradient-to-br from-white via-sky-50/60 to-blue-100/50 p-4 shadow-[0_6px_20px_-6px_rgba(14,165,233,0.2)] transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md shadow-sky-500/30">
                <ClipboardCheck size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-600">
                  {isUnit ? 'Alat Siap Diambil' : 'Alat Steril Siap Distribusi'}
                </p>
                <p className="text-2xl font-black text-sky-600">
                  {formatNumber(totals.sterile_stock || 0)}
                </p>
                <p className="truncate text-[10px] font-medium text-slate-500">Paket steril siap pakai</p>
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
            tone="bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-xs"
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
            tone="bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-xs"
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
            tone="bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-xs"
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
            tone="bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-xs"
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
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#002266]">
              <Truck size={18} className="text-emerald-600" />
              <span>Status Pengambilan Alat Steril</span>
            </div>
            <p className="text-xs text-slate-600">
              Unit <b className="text-slate-900">{user?.unit_name}</b> memiliki{' '}
              <b className="text-emerald-700">{totals.sterile_stock || 0}</b> paket steril siap diambil di CSSD.
            </p>
            <Button
              size="sm"
              onClick={() => navigate(ROUTES.DIST_TOOLS)}
              className="bg-gradient-to-r from-[#003399] to-[#0077E6] hover:brightness-110"
            >
              Buka Pengambilan Alat Steril
            </Button>
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#002266]">
              <History size={18} className="text-sky-600" />
              <span>Ketertelusuran Barcode Unit</span>
            </div>
            <p className="text-xs text-slate-600">
              Lacak riwayat perjalanan dan status pemrosesan instrumen medis unit Anda secara langsung.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(ROUTES.TRACE)}
            >
              Lacak Barcode Unit
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
