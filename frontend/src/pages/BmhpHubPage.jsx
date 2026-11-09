import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  CalendarX,
  ChevronRight,
  ClipboardList,
  Clock,
  Layers,
  Package,
  PackageX,
  ShieldCheck,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import SubNav from '@/components/ui/SubNav';
import InfoPanel from '@/components/dashboard/InfoPanel';
import { Badge } from '@/components/ui/Badge';
import { BMHP_TABS } from '@/config/resources/stock';
import { ROUTES } from '@/config/routes';
import { TONES } from '@/utils/constants';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, formatNumber } from '@/utils/format';
import { useAuth } from '@/context/AuthContext';
import useFetch from '@/hooks/useFetch';

const ACTIONS = [
  {
    title: 'Barang Masuk BMHP',
    desc: 'Scan barcode, input jumlah, nomor batch dan tanggal kedaluwarsa',
    to: ROUTES.BMHP_IN,
    icon: ArrowDownToLine,
    tone: 'amber',
  },
  {
    title: 'Pengambilan BMHP',
    desc: 'Scan barcode, input jumlah, dan unit pemakai',
    to: ROUTES.BMHP_OUT,
    icon: ArrowUpFromLine,
    tone: 'blue',
  },
  {
    title: 'Stok BMHP',
    desc: 'Spesifikasi lengkap, stok otomatis, peringatan minimum & expired',
    to: ROUTES.BMHP_STOCK,
    icon: Archive,
    tone: 'green',
  },
  {
    title: 'Laporan BMHP',
    desc: 'Histori mutasi barang masuk, keluar dan sisa stok',
    to: ROUTES.BMHP_REPORT,
    icon: ClipboardList,
    tone: 'purple',
    adminOnly: true,
  },
];

export default function BmhpHubPage() {
  const { isAdmin } = useAuth();
  const visibleActions = ACTIONS.filter((action) => !action.adminOnly || isAdmin);
  const { data: summary } = useFetch(API_ENDPOINTS.BMHP_ITEMS.SUMMARY);
  const { data: lowItems } = useFetch(API_ENDPOINTS.BMHP_ITEMS.LIST, {
    is_low: 1,
    is_active: 1,
    limit: 8,
    sort_by: 'stock',
    order: 'asc',
  });
  const { data: expiringItems } = useFetch(API_ENDPOINTS.BMHP_ITEMS.LIST, {
    expiry_status: 'expiring',
    is_active: 1,
    limit: 8,
    sort_by: 'expiry_date',
    order: 'asc',
  });

  const emptyCount = Number(summary?.empty_count || 0);
  const lowCount = Number(summary?.low_count || 0);
  const expiredCount = Number(summary?.expired_count || 0);
  const expiringCount = Number(summary?.expiring_count || 0);
  const hasUrgentAlert = emptyCount > 0 || expiredCount > 0 || lowCount > 0 || expiringCount > 0;

  return (
    <div className="space-y-6">
      <SubNav items={BMHP_TABS} />
      <PageHeader
        title="Manajemen Persediaan BMHP"
        subtitle="Barang Medis Habis Pakai — spesifikasi lengkap, stok real-time otomatis, serta notifikasi minimum & kedaluwarsa"
        icon={Archive}
      />

      {/* Early Warning Banner */}
      {hasUrgentAlert && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-amber-100/60 to-rose-50 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-amber-950">
                  Perhatian: Monitoring Persediaan BMHP
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-800">
                  {emptyCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-white">
                      <PackageX size={13} /> {emptyCount} item stok habis (0)
                    </span>
                  )}
                  {lowCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-0.5 text-white">
                      <AlertOctagon size={13} /> {lowCount} item stok menipis (≤ min)
                    </span>
                  )}
                  {expiredCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-700 px-2 py-0.5 text-white">
                      <CalendarX size={13} /> {expiredCount} item kedaluwarsa
                    </span>
                  )}
                  {expiringCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-700 px-2 py-0.5 text-white">
                      <Clock size={13} /> {expiringCount} item mendekati expired (≤30 hari)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Link
              to={ROUTES.BMHP_STOCK}
              className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto rounded-xl bg-brand-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-800"
            >
              <span>Buka Data Stok</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Link
          to={ROUTES.BMHP_STOCK}
          className="group rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-brand-500 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Item</span>
            <Package size={16} className="text-brand-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {formatNumber(summary?.total_items || 0)}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">Katalog BMHP</div>
        </Link>

        <Link
          to={ROUTES.BMHP_STOCK}
          className="group rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-brand-500 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Stok</span>
            <Layers size={16} className="text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {formatNumber(summary?.total_stock || 0)}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">Akumulasi Fisik</div>
        </Link>

        <Link
          to={`${ROUTES.BMHP_STOCK}?stock_status=empty`}
          className="group rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-sm transition hover:border-rose-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-bold uppercase tracking-wider">Stok Habis</span>
            <PackageX size={16} />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600">
            {formatNumber(emptyCount)}
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-rose-700">Perlu re-stock segera</div>
        </Link>

        <Link
          to={`${ROUTES.BMHP_STOCK}?stock_status=low`}
          className="group rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm transition hover:border-amber-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold uppercase tracking-wider">Stok Menipis</span>
            <AlertOctagon size={16} />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {formatNumber(lowCount)}
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-amber-700">≤ Stok minimum</div>
        </Link>

        <Link
          to={`${ROUTES.BMHP_STOCK}?expiry_status=expired`}
          className="group rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-sm transition hover:border-rose-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-bold uppercase tracking-wider">Kedaluwarsa</span>
            <CalendarX size={16} />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600">
            {formatNumber(expiredCount)}
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-rose-700">Lewat tanggal exp</div>
        </Link>

        <Link
          to={`${ROUTES.BMHP_STOCK}?expiry_status=expiring`}
          className="group rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm transition hover:border-amber-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold uppercase tracking-wider">Mendekati Exp</span>
            <Clock size={16} />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {formatNumber(expiringCount)}
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-amber-700">≤ 30 hari tersisa</div>
        </Link>
      </div>

      {/* Main Action Cards */}
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        {visibleActions.map((action) => {
          const tone = TONES[action.tone];
          return (
            <Link
              key={action.title}
              to={action.to}
              className={`group flex flex-col gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${tone.soft}`}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm ${tone.solid}`}>
                <action.icon size={22} />
              </span>
              <span>
                <span className={`block text-sm font-extrabold ${tone.text}`}>{action.title}</span>
                <span className="mt-0.5 block text-xs text-slate-600">{action.desc}</span>
              </span>
              <ChevronRight size={18} className={`mt-auto self-end ${tone.text}`} />
            </Link>
          );
        })}
      </div>

      {/* Two Monitoring Panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoPanel
          title="Stok Menipis & Habis"
          icon={Archive}
          tone="bg-amber-100 text-amber-600"
          to={`${ROUTES.BMHP_STOCK}?stock_status=low`}
          emptyText="Semua stok BMHP dalam batas aman"
          rows={(lowItems || []).map((item) => ({
            key: item.id,
            title: item.name,
            meta: `${item.code} • Kategori: ${item.category || '-'} • Minimum: ${item.min_stock} ${item.unit_label}`,
            badge: (
              <Badge tone={item.stock <= 0 ? 'rose' : 'amber'}>
                {item.stock <= 0 ? 'Habis (0)' : `${item.stock} ${item.unit_label}`}
              </Badge>
            ),
          }))}
        />

        <InfoPanel
          title="Pengingat Kedaluwarsa BMHP (≤ 30 Hari)"
          icon={Clock}
          tone="bg-rose-100 text-rose-600"
          to={`${ROUTES.BMHP_STOCK}?expiry_status=expiring`}
          emptyText="Tidak ada barang BMHP yang mendekati masa expired"
          rows={(expiringItems || []).map((item) => {
            const left = Number(item.days_left);
            const isExp = left < 0;
            return {
              key: item.id,
              title: item.name,
              meta: `Batch: ${item.batch_no || '-'} • Exp: ${formatDate(item.expiry_date)} • Stok: ${item.stock} ${item.unit_label}`,
              badge: (
                <Badge tone={isExp ? 'rose' : 'amber'}>
                  {isExp ? `Lewat ${Math.abs(left)} hr` : left === 0 ? 'Hari ini' : `${left} hari lagi`}
                </Badge>
              ),
            };
          })}
        />
      </div>
    </div>
  );
}
