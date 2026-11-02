import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, Archive, CalendarX, Cog, Layers, Leaf, Link2, ScanLine, ShieldCheck, Truck, Inbox } from 'lucide-react';
import FlowStrip from '@/components/dashboard/FlowStrip';
import InfoPanel from '@/components/dashboard/InfoPanel';
import MenuGrid from '@/components/dashboard/MenuGrid';
import StatTile from '@/components/dashboard/StatTile';
import BarcodeInput from '@/components/form/BarcodeInput';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import ErrorState from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import useFetch from '@/hooks/useFetch';
import { ROUTES } from '@/config/routes';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, formatDateTime } from '@/utils/format';

const VALUE_CHIPS = [
  { label: 'Aman', icon: ShieldCheck },
  { label: 'Efisien', icon: Cog },
  { label: 'Terintegrasi', icon: Link2 },
  { label: 'Paperless', icon: Leaf },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(API_ENDPOINTS.DASHBOARD);
  const [code, setCode] = useState('');

  const trace = (value) => {
    const barcode = value.trim();
    if (barcode) navigate(`${ROUTES.TRACE}?barcode=${encodeURIComponent(barcode)}`);
  };

  const totals = data?.totals || {};

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-5 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-brand-100">Selamat datang, {user?.name}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">CSSD SMART</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-50">
              Sistem informasi pengelolaan alat steril, barcode dan inventaris CSSD RSU Serpong Utara.
              Dari alat kotor masuk sampai menjadi alat steril, tercatat otomatis.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {VALUE_CHIPS.map((chip) => (
                <span key={chip.label} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
                  <chip.icon size={13} /> {chip.label}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 text-slate-800 shadow-md">
            <p className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <ScanLine size={17} className="text-brand-700" /> Cek ketertelusuran cepat
            </p>
            <p className="mb-3 mt-0.5 text-xs text-slate-500">Scan atau ketik barcode alat kotor, paket, atau nomor batch.</p>
            <BarcodeInput value={code} onChange={setCode} onCommit={trace} placeholder="mis. AK-301026-001" />
          </div>
        </div>
      </section>

      {/* Ringkasan */}
      {loading && !data ? (
        <CardSkeleton count={4} />
      ) : error && !data ? (
        <div className="card"><ErrorState message={error} onRetry={reload} /></div>
      ) : (
        <>
          <section aria-label="Ringkasan" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Alat kotor masuk hari ini" value={totals.received_today} icon={Inbox} tone="red" to={ROUTES.RECEIPTS} />
            <StatTile label="Batch menunggu verifikasi" value={totals.waiting_verification} icon={ShieldCheck} tone="amber" to={ROUTES.VERIFICATIONS} />
            <StatTile label="Stok alat steril" value={totals.sterile_stock} hint="paket tersedia" icon={Layers} tone="green" to={ROUTES.REPORT('stok-steril')} />
            <StatTile label="Distribusi hari ini" value={totals.distributed_today} icon={Truck} tone="blue" to={ROUTES.REPORT('distribusi')} />
          </section>

          <section aria-labelledby="alur-proses">
            <h2 id="alur-proses" className="mb-1 text-lg font-extrabold text-slate-900">Alur Proses CSSD</h2>
            <p className="mb-3 text-sm text-slate-500">Data otomatis terhubung dan terkunci per tahap. Barcode hanya pada 3 transaksi utama.</p>
            <FlowStrip data={data} />
          </section>
        </>
      )}

      <MenuGrid />

      {data && (
        <section aria-label="Peringatan" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <InfoPanel
            title="Karantina / Gagal"
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
              badge: <Badge tone={s.days_left < 0 ? 'rose' : 'amber'}>{s.days_left < 0 ? 'Lewat' : `${s.days_left} hari`}</Badge>,
            }))}
          />
          <InfoPanel
            title="BMHP Stok Menipis"
            icon={Archive}
            tone="bg-sky-100 text-sky-600"
            to={ROUTES.BMHP_STOCK}
            emptyText="Semua stok BMHP aman"
            rows={(data.lowBmhp || []).map((b) => ({
              key: b.id,
              title: b.name,
              meta: `${b.code} • minimum ${b.min_stock} ${b.unit_label}`,
              badge: <Badge tone={b.stock <= 0 ? 'rose' : 'amber'}>{b.stock} {b.unit_label}</Badge>,
            }))}
          />
          <InfoPanel
            title="Verifikasi Terbaru"
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
    </div>
  );
}
