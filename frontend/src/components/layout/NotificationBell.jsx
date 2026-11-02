import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertOctagon, Archive, Bell, CalendarX, ShieldCheck } from 'lucide-react';
import useFetch from '@/hooks/useFetch';
import useClickOutside from '@/hooks/useClickOutside';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { ROUTES } from '@/config/routes';

/** Lonceng notifikasi: karantina, BMHP menipis, alat kedaluwarsa, batch menunggu verifikasi. */
export default function NotificationBell() {
  const { pathname } = useLocation();
  const { data } = useFetch(API_ENDPOINTS.DASHBOARD, undefined, { refreshKey: pathname });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);

  const totals = data?.totals || {};
  const alerts = [
    { count: totals.quarantine, label: 'paket di Karantina / Gagal', to: ROUTES.REPORT('karantina'), icon: AlertOctagon, tone: 'text-rose-600 bg-rose-50' },
    { count: totals.expired, label: 'paket steril kedaluwarsa', to: ROUTES.REPORT('stok-steril'), icon: CalendarX, tone: 'text-rose-600 bg-rose-50' },
    { count: totals.bmhp_low, label: 'BMHP stok menipis', to: ROUTES.BMHP_STOCK, icon: Archive, tone: 'text-amber-600 bg-amber-50' },
    { count: totals.waiting_verification, label: 'batch menunggu verifikasi', to: ROUTES.VERIFICATIONS, icon: ShieldCheck, tone: 'text-sky-600 bg-sky-50' },
  ].filter((a) => Number(a.count) > 0);

  const badge = Number(totals.quarantine || 0) + Number(totals.expired || 0) + Number(totals.bmhp_low || 0);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm transition hover:bg-slate-100"
      >
        <Bell size={19} />
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white ring-2 ring-brand-800">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">Notifikasi</p>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Semua aman, tidak ada peringatan.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {alerts.map((alert) => (
                <li key={alert.label}>
                  <Link to={alert.to} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${alert.tone}`}>
                      <alert.icon size={17} />
                    </span>
                    <span className="text-slate-700">
                      <b className="text-slate-900">{alert.count}</b> {alert.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
