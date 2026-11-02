import { Link } from 'react-router-dom';
import { ChevronRight, FileText, History } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { REPORTS, REPORT_LIST } from '@/config/reports';
import { ROUTES } from '@/config/routes';

const GROUPS = ['Proses CSSD', 'Stok & Distribusi', 'BMHP'];

/** Pusat laporan & unduhan. Setiap laporan bisa difilter tanggal, dicetak, dan diunduh CSV. */
export default function ReportsHubPage() {
  return (
    <div>
      <PageHeader title="Laporan & Unduhan" subtitle="Rekap otomatis transaksi dan stok — filter tanggal, cetak, atau unduh CSV" icon={FileText} />

      <div className="space-y-6">
        {GROUPS.map((group) => (
          <section key={group}>
            <h2 className="mb-2.5 text-sm font-extrabold uppercase tracking-wider text-slate-400">{group}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {REPORT_LIST.filter((r) => r.group === group).map(({ slug }) => (
                <Link key={slug} to={ROUTES.REPORT(slug)} className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <FileText size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-slate-900">{REPORTS[slug].title}</span>
                    <span className="block text-xs text-slate-500">{REPORTS[slug].subtitle}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h2 className="mb-2.5 text-sm font-extrabold uppercase tracking-wider text-slate-400">Ketertelusuran</h2>
          <Link to={ROUTES.TRACE} className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md sm:max-w-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <History size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-slate-900">Laporan Ketertelusuran</span>
              <span className="block text-xs text-slate-500">Riwayat lengkap alat dari barcode: tanggal, petugas, batch, hasil verifikasi, unit tujuan</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-slate-300" />
          </Link>
        </section>
      </div>
    </div>
  );
}
