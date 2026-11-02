import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, History, Printer, Search, XCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import BarcodeInput from '@/components/form/BarcodeInput';
import useFetch from '@/hooks/useFetch';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { STAGE_LABELS } from '@/utils/constants';
import { formatDate } from '@/utils/format';

function Timeline({ events }) {
  return (
    <ol className="relative ml-3 space-y-5 border-l-2 border-slate-200 pl-6">
      {events.map((event, index) => {
        const failed = event.status === 'fail';
        const Icon = failed ? XCircle : CheckCircle2;
        return (
          <li key={`${event.stage}-${index}`} className="relative">
            <span className={`absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full bg-white ${failed ? 'text-rose-600' : 'text-emerald-600'}`}>
              <Icon size={22} />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <p className={`text-sm font-extrabold ${failed ? 'text-rose-700' : 'text-slate-900'}`}>{event.stage}</p>
              <p className="text-xs font-semibold text-slate-500">{formatDate(event.date)}</p>
            </div>
            <p className="mt-0.5 break-words text-sm text-slate-700">{event.detail}</p>
            <p className="text-xs text-slate-500">Petugas: {event.officer || '-'}</p>
          </li>
        );
      })}
    </ol>
  );
}

function TraceCard({ trace }) {
  const { receipt, timeline } = trace;
  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div>
          <p className="font-mono text-base font-extrabold text-slate-900">{receipt.barcode}</p>
          <p className="text-sm text-slate-600">
            {receipt.item_name} • {receipt.quantity} {receipt.unit_label} • {receipt.unit_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            Tahap: {STAGE_LABELS[receipt.stage] || '-'}
          </span>
          <StatusBadge value={receipt.status} />
        </div>
      </header>
      <div className="px-5 py-6">
        <Timeline events={timeline} />
      </div>
    </article>
  );
}

/** Ketertelusuran: riwayat lengkap dari barcode alat kotor, barcode paket, atau nomor batch. */
export default function TraceabilityPage() {
  const [params, setParams] = useSearchParams();
  const barcode = params.get('barcode') || '';
  const [code, setCode] = useState(barcode);
  const { data, loading, error, reload } = useFetch(API_ENDPOINTS.TRACEABILITY, { barcode }, { enabled: Boolean(barcode) });

  useEffect(() => setCode(barcode), [barcode]);

  const submit = (value) => {
    const next = (value ?? code).trim();
    if (!next) return;
    if (next === barcode) reload();
    else setParams({ barcode: next });
  };

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Ketertelusuran"
          subtitle="Riwayat lengkap alat: tanggal, petugas, batch, hasil verifikasi, dan unit tujuan"
          icon={History}
          actions={
            data?.length ? (
              <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
                Cetak
              </Button>
            ) : null
          }
        />

        <div className="card mb-5 p-4">
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Scan atau ketik barcode / nomor batch</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <BarcodeInput value={code} onChange={setCode} onCommit={() => {}} placeholder="AK-301026-001 / PG-301026-001 / AU1-301026-025" />
            </div>
            <Button icon={Search} onClick={() => submit()} loading={loading} disabled={!code.trim()}>
              Telusuri
            </Button>
          </div>
        </div>
      </div>

      {!barcode ? (
        <div className="card">
          <EmptyState
            icon={History}
            title="Belum ada pencarian"
            hint="Masukkan barcode alat kotor (AK-), barcode paket (PG-, KS-, SM-), atau nomor batch sterilisasi untuk melihat riwayatnya."
          />
        </div>
      ) : loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : error ? (
        <div className="card"><ErrorState message={error} onRetry={reload} /></div>
      ) : (
        <div className="space-y-4">
          {(data || []).map((trace) => (
            <TraceCard key={trace.receipt.id} trace={trace} />
          ))}
        </div>
      )}
    </div>
  );
}
