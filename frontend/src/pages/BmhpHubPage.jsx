import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, Archive, ChevronRight, ClipboardList } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import SubNav from '@/components/ui/SubNav';
import InfoPanel from '@/components/dashboard/InfoPanel';
import { Badge } from '@/components/ui/Badge';
import { BMHP_TABS } from '@/config/resources/stock';
import { ROUTES } from '@/config/routes';
import { TONES } from '@/utils/constants';
import { API_ENDPOINTS } from '@/utils/endpoints';
import useFetch from '@/hooks/useFetch';

const ACTIONS = [
  { title: 'Barang Masuk BMHP', desc: 'Scan barcode, input jumlah, batch dan kedaluwarsa', to: ROUTES.BMHP_IN, icon: ArrowDownToLine, tone: 'amber' },
  { title: 'Pengambilan BMHP', desc: 'Scan barcode, input jumlah, unit pemakai', to: ROUTES.BMHP_OUT, icon: ArrowUpFromLine, tone: 'blue' },
  { title: 'Stok BMHP', desc: 'Stok otomatis, peringatan minimum dan kedaluwarsa', to: ROUTES.BMHP_STOCK, icon: Archive, tone: 'green' },
  { title: 'Laporan BMHP', desc: 'Barang masuk, keluar dan sisa stok', to: ROUTES.BMHP_REPORT, icon: ClipboardList, tone: 'purple' },
];

export default function BmhpHubPage() {
  const { data } = useFetch(API_ENDPOINTS.BMHP_ITEMS.LIST, { is_low: 1, is_active: 1, limit: 10, sort_by: 'stock', order: 'asc' });

  return (
    <div>
      <SubNav items={BMHP_TABS} />
      <PageHeader title="Manajemen Stok BMHP" subtitle="Barang Medis Habis Pakai — dikelola dengan barcode" icon={Archive} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ACTIONS.map((action) => {
          const tone = TONES[action.tone];
          return (
            <Link key={action.title} to={action.to} className={`group flex flex-col gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${tone.soft}`}>
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

      <div className="mt-6">
        <InfoPanel
          title="Stok Menipis / Habis"
          icon={Archive}
          tone="bg-amber-100 text-amber-600"
          to={ROUTES.BMHP_STOCK}
          emptyText="Semua stok BMHP aman"
          rows={(data || []).map((item) => ({
            key: item.id,
            title: item.name,
            meta: `${item.code} • minimum ${item.min_stock} ${item.unit_label}`,
            badge: <Badge tone={item.stock <= 0 ? 'rose' : 'amber'}>{item.stock} {item.unit_label}</Badge>,
          }))}
        />
      </div>
    </div>
  );
}
