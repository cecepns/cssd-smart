import { BoolBadge, StatusBadge } from '@/components/ui/Badge';
import { formatDate, formatDateTime, formatNumber, formatTime } from '@/utils/format';

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

/** Jam mulai & jam selesai proses (Asia/Jakarta). */
export const timeWindow = (row) => {
  const start = row.started_time || formatTime(row.started_at || row.created_at);
  const end = row.completed_time || (row.storage_active ? 'Masih Disimpan' : formatTime(row.completed_at || row.created_at));
  return (
    <div className="whitespace-nowrap font-mono text-[11px] leading-tight text-slate-700">
      <div><span className="text-slate-400">Mulai:</span> <span className="font-bold text-slate-900">{start}</span></div>
      <div><span className="text-slate-400">Selesai:</span> <span className={row.storage_active ? 'font-semibold text-amber-600' : 'font-semibold text-emerald-700'}>{end}</span></div>
    </div>
  );
};

/** Lama proses & waktu tunggu dari tahapan sebelumnya. */
export const durationBadge = (row) => {
  const proc = row.process_duration || '-';
  const wait = row.wait_duration;
  const hasWait = wait && wait !== '-' && row.wait_seconds !== undefined && row.wait_seconds !== null && Number(row.wait_seconds) > 0;
  return (
    <div className="whitespace-nowrap text-[11px] leading-tight">
      <div className="font-semibold text-sky-700">Proses: {proc}</div>
      {hasWait ? (
        <div className="font-medium text-amber-700">Tunggu: {wait}</div>
      ) : (
        <div className="text-slate-400">Tunggu: {wait && wait !== '-' ? wait : '0 dtk'}</div>
      )}
    </div>
  );
};
