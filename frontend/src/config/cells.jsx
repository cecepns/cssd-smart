import { BoolBadge, StatusBadge } from '@/components/ui/Badge';
import { formatDate, formatDateTime, formatNumber } from '@/utils/format';

/** Helper sel tabel yang dipakai ulang oleh konfigurasi kolom. */
export const mono = (key) => (row) => (
  <span className="font-mono text-xs font-semibold text-slate-800">{row[key] ?? '-'}</span>
);

export const date = (key) => (row) => formatDate(row[key]);
export const dateTime = (key) => (row) => formatDateTime(row[key]);
export const badge = (key) => (row) => <StatusBadge value={row[key]} />;
export const yesNo = (key, yes, no) => (row) => <BoolBadge value={Boolean(row[key])} yes={yes} no={no} />;
export const qty = (key = 'quantity', unitKey = 'unit_label') => (row) => `${formatNumber(row[key])} ${row[unitKey] || ''}`.trim();
export const bold = (key) => (row) => <span className="font-semibold text-slate-900">{row[key] ?? '-'}</span>;

/** Sisa masa steril: merah bila lewat/hampir kedaluwarsa. */
export const expiry = (row) => {
  const left = Number(row.days_left);
  const tone = left < 0 ? 'text-rose-600' : left <= 30 ? 'text-amber-600' : 'text-slate-500';
  return (
    <div className="leading-tight">
      <div>{formatDate(row.expiry_date)}</div>
      <div className={`text-xs font-semibold ${tone}`}>{left < 0 ? `lewat ${Math.abs(left)} hari` : `${left} hari lagi`}</div>
    </div>
  );
};
