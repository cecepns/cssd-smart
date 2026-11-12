import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, History, Printer, RotateCcw, Search, Timer, XCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import BarcodeInput from '@/components/form/BarcodeInput';
import useFetch from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { STAGE_LABELS } from '@/utils/constants';
import { formatDate, formatNumber } from '@/utils/format';

const TRACE_KEYS = ['barcode', 'unit_id', 'date_from', 'date_to', 'time_from', 'time_to', 'officer'];

function Timeline({ events }) {
  return (
    <ol className="relative ml-3 space-y-5 border-l-2 border-slate-200 pl-6">
      {events.map((event, index) => {
        const failed = event.status === 'fail';
        const Icon = failed ? XCircle : CheckCircle2;
        const startTime = event.started_time && event.started_time !== '-' ? event.started_time : null;
        const endTime = event.completed_time && event.completed_time !== '-' ? event.completed_time : null;
        return (
          <li key={`${event.stage}-${index}`} className="relative">
            <span className={`absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full bg-white ${failed ? 'text-rose-600' : 'text-emerald-600'}`}>
              <Icon size={22} />
            </span>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className={`text-sm font-extrabold ${failed ? 'text-rose-700' : 'text-slate-900'}`}>{event.stage}</p>
              <p className="text-xs font-semibold text-slate-500">{formatDate(event.date)}</p>
              {(startTime || endTime) && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                  <Clock size={11} className="text-slate-500" />
                  {startTime || '-'} → {endTime || '-'}
                </span>
              )}
              {event.process_duration && event.process_duration !== '-' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 ring-1 ring-sky-200">
                  Proses: {event.process_duration}
                </span>
              )}
              {event.wait_duration && event.wait_duration !== '-' && Number(event.wait_seconds || 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                  Tunggu: {event.wait_duration}
                </span>
              )}
            </div>
            <p className="mt-1 break-words text-sm text-slate-700">{event.detail}</p>
            <p className="text-xs text-slate-500">Petugas: {event.officer || '-'}</p>
          </li>
        );
      })}
    </ol>
  );
}

function TraceCard({ trace }) {
  const { receipt, timeline, summary } = trace;
  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-base font-extrabold text-slate-900">{receipt.barcode}</p>
            {receipt.is_dtt && (
              <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800">DTT (Reuse)</span>
            )}
          </div>
          <p className="text-sm text-slate-600">
            {receipt.item_name} • {receipt.quantity} {receipt.unit_label} • {receipt.unit_name || '-'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {receipt.is_dtt ? (
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              Tahap: {receipt.process_stage || '-'}
            </span>
          ) : (
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              Tahap: {STAGE_LABELS[receipt.stage] || receipt.stage || '-'}
            </span>
          )}
          <StatusBadge value={receipt.status || receipt.verification_result || 'Diterima'} />
        </div>
      </header>
      <div className="px-5 py-6">
        <Timeline events={timeline} />
        {summary && (
          <div className="mt-5 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Timer size={14} className="shrink-0 text-sky-600" />
              <div>
                <p className="text-slate-500">Total Waktu Proses</p>
                <p className="font-extrabold text-slate-900">{summary.total_process_duration || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="shrink-0 text-amber-600" />
              <div>
                <p className="text-slate-500">Total Waktu Tunggu</p>
                <p className="font-extrabold text-slate-900">{summary.total_wait_duration || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <History size={14} className="shrink-0 text-emerald-600" />
              <div>
                <p className="text-slate-500">Total Durasi Layanan</p>
                <p className="font-extrabold text-emerald-700">{summary.total_elapsed_duration || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/** Ketertelusuran: riwayat lengkap berdasarkan barcode, unit asal, tanggal, jam proses, dan nama petugas. */
export default function TraceabilityPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const readParamsState = () => ({
    barcode: params.get('barcode') || '',
    unit_id: params.get('unit_id') || '',
    date_from: params.get('date_from') || '',
    date_to: params.get('date_to') || '',
    time_from: params.get('time_from') || '',
    time_to: params.get('time_to') || '',
    officer: params.get('officer') || '',
  });

  const activeQuery = useMemo(() => {
    const q = {};
    TRACE_KEYS.forEach((k) => {
      const val = (params.get(k) || '').trim();
      if (val) q[k] = val;
    });
    return q;
  }, [params]);

  const [form, setForm] = useState(readParamsState);

  useEffect(() => {
    setForm(readParamsState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const { data: unitsData } = useFetch(
    API_ENDPOINTS.LOOKUPS.UNITS,
    { is_active: 1, sort_by: 'name', order: 'asc', limit: 100 },
    { enabled: user?.role !== 'unit' }
  );
  const { data: officersData } = useFetch(
    API_ENDPOINTS.LOOKUPS.OFFICERS,
    { is_active: 1, sort_by: 'name', order: 'asc', limit: 100 }
  );

  const hasAnyQuery = Object.keys(activeQuery).length > 0;
  const hasDraftInput = TRACE_KEYS.some((k) => String(form[k] || '').trim() !== '');

  const { data, loading, error, reload } = useFetch(API_ENDPOINTS.TRACEABILITY, activeQuery, { enabled: hasAnyQuery });

  const submit = (overrideBarcode) => {
    const draft = overrideBarcode !== undefined ? { ...form, barcode: overrideBarcode } : form;
    const nextCleaned = {};
    TRACE_KEYS.forEach((k) => {
      const val = String(draft[k] || '').trim();
      if (val) nextCleaned[k] = val;
    });
    if (!Object.keys(nextCleaned).length) return;

    if (JSON.stringify(nextCleaned) === JSON.stringify(activeQuery)) {
      reload();
      return;
    }

    const nextParams = new URLSearchParams(params);
    TRACE_KEYS.forEach((k) => {
      if (nextCleaned[k]) nextParams.set(k, nextCleaned[k]);
      else nextParams.delete(k);
    });
    setParams(nextParams);
  };

  const resetFilters = () => {
    setForm({ barcode: '', unit_id: '', date_from: '', date_to: '', time_from: '', time_to: '', officer: '' });
    const nextParams = new URLSearchParams(params);
    TRACE_KEYS.forEach((k) => nextParams.delete(k));
    setParams(nextParams);
  };

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Ketertelusuran"
          subtitle="Riwayat lengkap perjalanan alat berdasarkan barcode, unit asal, tanggal, jam proses, lama/waktu tunggu, dan petugas"
          icon={History}
          actions={
            data?.length ? (
              <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
                Cetak
              </Button>
            ) : null
          }
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="card mb-5 space-y-3 p-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Scan / ketik barcode, atau telusuri berdasarkan unit asal, tanggal, jam proses &amp; petugas
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <BarcodeInput
                  value={form.barcode}
                  onChange={(val) => setForm((prev) => ({ ...prev, barcode: val }))}
                  onCommit={(scanned) => submit(scanned)}
                  placeholder="AK-301026-001 / AS-... / RD-... / DDTT-... / batch sterilisasi"
                />
              </div>
              <Button type="submit" icon={Search} loading={loading} disabled={!hasDraftInput}>
                Telusuri
              </Button>
              {(hasAnyQuery || hasDraftInput) && (
                <Button type="button" variant="secondary" icon={RotateCcw} onClick={resetFilters}>
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-5">
            {user?.role !== 'unit' ? (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Unit Asal</label>
                <select
                  value={form.unit_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, unit_id: e.target.value }))}
                  className="input-base h-9 text-xs"
                >
                  <option value="">Semua Unit</option>
                  {(unitsData || []).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Unit Asal</label>
                <input
                  type="text"
                  disabled
                  value={user?.unit_name || 'Unit Terdaftar'}
                  className="input-base h-9 bg-slate-50 text-xs text-slate-600"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Dari Tanggal</label>
              <input
                type="date"
                value={form.date_from}
                onChange={(e) => setForm((prev) => ({ ...prev, date_from: e.target.value }))}
                className="input-base h-9 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Sampai Tanggal</label>
              <input
                type="date"
                value={form.date_to}
                onChange={(e) => setForm((prev) => ({ ...prev, date_to: e.target.value }))}
                className="input-base h-9 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Jam Proses (Mulai – Akhir)</label>
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  value={form.time_from}
                  onChange={(e) => setForm((prev) => ({ ...prev, time_from: e.target.value }))}
                  aria-label="Jam proses mulai"
                  className="input-base h-9 px-2 text-xs"
                />
                <span className="text-xs text-slate-400">–</span>
                <input
                  type="time"
                  value={form.time_to}
                  onChange={(e) => setForm((prev) => ({ ...prev, time_to: e.target.value }))}
                  aria-label="Jam proses akhir"
                  className="input-base h-9 px-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nama Petugas</label>
              <input
                type="text"
                list="trace-officers-list"
                value={form.officer}
                onChange={(e) => setForm((prev) => ({ ...prev, officer: e.target.value }))}
                placeholder="Cari petugas CSSD / unit..."
                className="input-base h-9 text-xs"
              />
              <datalist id="trace-officers-list">
                {(officersData || []).map((o) => (
                  <option key={o.id} value={o.name} />
                ))}
              </datalist>
            </div>
          </div>
        </form>
      </div>

      {!hasAnyQuery ? (
        <div className="card">
          <EmptyState
            icon={History}
            title="Belum ada pencarian"
            hint="Masukkan barcode alat kotor (AK-), paket steril (AS-, ST-, PG-, KS-), barcode DTT (RD-, DDTT-), atau filter berdasarkan unit asal, tanggal, jam proses, dan nama petugas."
          />
        </div>
      ) : loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : error ? (
        <div className="card"><ErrorState message={error} onRetry={reload} /></div>
      ) : !data?.length ? (
        <div className="card">
          <EmptyState
            icon={History}
            title="Data ketertelusuran tidak ditemukan"
            hint="Coba ubah barcode atau kombinasi filter unit asal, tanggal, jam proses, dan nama petugas."
          />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500">
            Menampilkan <b className="text-slate-800">{formatNumber(data.length)}</b> riwayat perjalanan alat:
          </p>
          {data.map((trace) => (
            <TraceCard key={`${trace.receipt.is_dtt ? 'dtt' : 'steril'}-${trace.receipt.id}`} trace={trace} />
          ))}
        </div>
      )}
    </div>
  );
}
