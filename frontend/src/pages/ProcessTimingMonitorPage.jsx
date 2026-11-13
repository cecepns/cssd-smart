import { useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Flame,
  Layers,
  Loader2,
  Package,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Timer,
  User,
  Wind,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useFetch from '@/hooks/useFetch';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDateTime } from '@/utils/format';

export default function ProcessTimingMonitorPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [unitId, setUnitId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Fetch Units for dropdown
  const { data: unitsData } = useFetch(API_ENDPOINTS.LOOKUPS.UNITS);
  const units = unitsData || [];

  // Fetch Timing Data
  const params = {
    page,
    limit,
    search: search || undefined,
    unit_id: unitId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    status: status || undefined,
  };

  const { data, loading, refetch } = useFetch(API_ENDPOINTS.MONITORING_PROCESS_TIMINGS, params);
  const items = data?.data || [];
  const pagination = data?.pagination || { total: 0, totalPages: 1 };
  const kpi = data?.kpi || {};

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSearchInput('');
    setUnitId('');
    setDateFrom('');
    setDateTo('');
    setStatus('');
    setPage(1);
  };

  const formatSec = (seconds) => {
    if (!seconds || seconds <= 0) return '0 m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}j ${mins}m`;
    return `${mins}m`;
  };

  const exportCsv = () => {
    if (items.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }
    const headers = [
      'Barcode',
      'Nama Alat',
      'Jumlah',
      'Unit Asal',
      'Tanggal Masuk',
      'Tahap Terakhir',
      'Status',
      'Total Turnaround (Menit)',
      'Total Waktu Tunggu (Menit)',
    ];
    const rows = items.map((it) => [
      `"${it.receipt?.barcode || '-'}"`,
      `"${it.receipt?.item_name || '-'}"`,
      `"${it.receipt?.quantity || 1} ${it.receipt?.unit_label || 'set'}"`,
      `"${it.receipt?.unit_name || '-'}"`,
      `"${it.receipt?.receipt_date || '-'}"`,
      `"${it.summary?.current_stage || '-'}"`,
      `"${it.receipt?.status || '-'}"`,
      `"${Math.round((it.summary?.total_turnaround_sec || 0) / 60)}"`,
      `"${Math.round((it.summary?.total_wait_sec || 0) / 60)}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Log_Waktu_CSSD_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('File CSV berhasil diunduh');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Timer size={22} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Pemantauan Log Waktu Pengerjaan CSSD</h1>
              <p className="text-xs text-slate-500">
                Lacak durasi pengerjaan, waktu tunggu, dan SLA setiap tahapan alat medis secara real-time
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} /> Segarkan
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Download size={14} /> Ekspor CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-800 transition"
          >
            <Printer size={14} /> Cetak
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Alat Diproses</span>
            <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <ScanLine size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{kpi.total_receipts || 0}</p>
          <p className="mt-1 text-[11px] text-slate-400">30 hari terakhir</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Rata-rata Waktu Cuci</span>
            <span className="rounded-lg bg-cyan-50 p-2 text-cyan-600">
              <Clock size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-cyan-700">{formatSec(kpi.avg_wash_seconds)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Pencucian & dekontaminasi</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Rata-rata Waktu Steril</span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Flame size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700">{formatSec(kpi.avg_steril_seconds)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Mesin Autoclave & Plasma</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Rata-rata Total Turnaround (SLA)</span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Timer size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatSec(kpi.avg_turnaround_seconds)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Diterima kotor s/d terdistribusi</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari barcode, nama alat, unit, petugas..."
              className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="min-w-[160px]">
            <select
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
            >
              <option value="">Semua Unit Asal</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[130px]">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="Diterima">Diterima</option>
              <option value="Proses">Proses</option>
              <option value="Selesai">Selesai</option>
              <option value="Karantina">Karantina</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
            />
            <span>s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800 transition"
          >
            Terapkan
          </button>

          {(search || unitId || dateFrom || dateTo || status) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold"
            >
              <X size={14} /> Reset
            </button>
          )}
        </form>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
              <tr>
                <th className="py-3.5 px-4 w-10"></th>
                <th className="py-3.5 px-4">Barcode & Alat</th>
                <th className="py-3.5 px-4">Unit Asal</th>
                <th className="py-3.5 px-4">Tahapan & Status</th>
                <th className="py-3.5 px-4">Waktu Mulai - Selesai</th>
                <th className="py-3.5 px-4">Durasi Proses</th>
                <th className="py-3.5 px-4">Waktu Tunggu</th>
                <th className="py-3.5 px-4">Petugas Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="mx-auto mb-2 animate-spin text-brand-600" />
                    Memuat data log waktu...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Tidak ada data pengerjaan yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const r = row.receipt;
                  const sum = row.summary || {};
                  const isExpanded = expandedId === r.id;

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 transition cursor-pointer ${isExpanded ? 'bg-sky-50/40' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    >
                      <td className="py-3.5 px-4 text-center">
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-brand-700" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-400" />
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-brand-700">{r.barcode}</div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {r.item_name} <span className="text-slate-500 font-normal">({r.quantity} {r.unit_label})</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                          <Building2 size={12} /> {r.unit_name || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{sum.current_stage || '-'}</div>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            r.status === 'Selesai'
                              ? 'bg-emerald-100 text-emerald-700'
                              : r.status === 'Karantina'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">
                          {r.started_at ? formatDateTime(r.started_at) : r.receipt_date}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.completed_at ? `Selesai: ${formatDateTime(r.completed_at)}` : 'Masih berjalan'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-2 py-0.5 font-bold text-cyan-800">
                          <Clock size={12} /> {sum.total_turnaround_human || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                          <Timer size={12} /> {sum.total_wait_human || '0 m'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {r.receiver_name || r.sender_name || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded Row Breakdown */}
        {expandedId && (
          <div className="border-t border-slate-200 bg-slate-50/80 p-6">
            {(() => {
              const currentItem = items.find((x) => x.receipt.id === expandedId);
              if (!currentItem) return null;
              const { receipt: r, timeline = [], summary = {} } = currentItem;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Rincian Log Waktu Tiap Tahapan: {r.item_name} ({r.barcode})
                      </h4>
                      <p className="text-xs text-slate-500">
                        Menampilkan jam aktual mulai/selesai, durasi pengerjaan, waktu tunggu, dan nama petugas pelaksana
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(null)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 transition"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Stage-by-stage Stepper / Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {timeline.map((step, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold text-xs text-brand-900">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] text-brand-700 font-bold">
                              {step.order}
                            </span>
                            {step.stage}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              step.status === 'ok'
                                ? 'bg-emerald-100 text-emerald-700'
                                : step.status === 'fail'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {step.status === 'ok' ? 'Selesai' : step.status === 'fail' ? 'Gagal' : 'Berjalan'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 space-y-1">
                          <div>
                            <span className="text-slate-400">Jam Mulai:</span>{' '}
                            <b className="text-slate-800">{step.startedAt ? formatDateTime(step.startedAt) : '-'}</b>
                          </div>
                          <div>
                            <span className="text-slate-400">Jam Selesai:</span>{' '}
                            <b className="text-slate-800">{step.completedAt ? formatDateTime(step.completedAt) : '-'}</b>
                          </div>
                          <div>
                            <span className="text-slate-400">Lama Proses:</span>{' '}
                            <b className="text-cyan-700">{step.processDurationHuman || '-'}</b>
                          </div>
                          {step.waitDurationHuman && (
                            <div>
                              <span className="text-slate-400">Waktu Tunggu:</span>{' '}
                              <b className="text-amber-600">{step.waitDurationHuman}</b>
                            </div>
                          )}
                          <div className="pt-1 border-t border-slate-100">
                            <span className="text-slate-400">Petugas:</span>{' '}
                            <b className="text-slate-800">{step.officer || '-'}</b>
                          </div>
                          {step.detail && (
                            <p className="text-[10px] text-slate-500 italic truncate">{step.detail}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 bg-slate-50">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Tampilkan</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>dari total {pagination.total || 0} entri</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="px-3 py-1 text-xs font-bold text-brand-900">
              Hal {page} dari {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              disabled={page >= (pagination.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
