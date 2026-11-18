import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertOctagon,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { api } from '@/utils/api';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDateTime } from '@/utils/format';
import { getErrorMessage } from '@/utils/request';
import useDebounce from '@/hooks/useDebounce';
import useFetch from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';
import { conditionBadge } from '@/config/resources/dtt';

export default function DttReuseReportPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('SUMMARY'); // SUMMARY | HISTORY
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [unitId, setUnitId] = useState('');
  const [alertFilter, setAlertFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({ kpi: {}, summary_by_tool: [], transactions: [] });
  const [updatingKey, setUpdatingKey] = useState(null);

  const { data: unitsRes } = useFetch(API_ENDPOINTS.LOOKUPS.UNITS, { is_active: 1, limit: 100 });
  const units = useMemo(() => unitsRes?.data || unitsRes || [], [unitsRes]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.DTT_REUSE_REPORT, {
        params: {
          search: debouncedSearch || undefined,
          unit_id: unitId || undefined,
          alert_level: alertFilter !== 'ALL' ? alertFilter : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      });
      if (res.data?.success && res.data?.data) {
        setReportData(res.data.data);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memuat Laporan Reuse DTT'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, unitId, alertFilter, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSetLimit = async (tool, newLimit) => {
    setUpdatingKey(tool.key);
    try {
      await api.patch(API_ENDPOINTS.DTT_REUSE_LIMIT, {
        item_name: tool.item_name,
        unit_id: tool.unit_id,
        max_reuse_limit: newLimit,
      });
      toast.success(`Batas maksimal reuse "${tool.item_name}" diatur menjadi ${newLimit}x`);
      fetchReport();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal mengubah batas maksimal reuse'));
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleExportCsv = () => {
    const isSummary = activeTab === 'SUMMARY';
    const headers = isSummary
      ? ['Unit', 'Kode Alat', 'Nama Alat DTT', 'Total Terima', 'Total Ambil', 'Siklus Reuse', 'Batas Maks', 'Sisa Reuse', 'Status Peringatan', 'Kondisi Terakhir']
      : ['Barcode Terima', 'Waktu Terima', 'Barcode Ambil', 'Waktu Ambil', 'Unit', 'Nama Alat', 'Reuse Ke-', 'Batas Maks', 'Kondisi', 'Petugas CSSD', 'Petugas Unit'];

    const rows = isSummary
      ? (reportData.summary_by_tool || []).map((r) => [
          r.unit_name,
          r.item_code,
          r.item_name,
          r.total_receipts,
          r.total_distributions,
          r.current_reuse,
          `${r.max_reuse_limit}x`,
          r.remaining_reuse,
          r.alert_message,
          r.last_condition,
        ])
      : (reportData.transactions || []).map((t) => [
          t.barcode,
          formatDateTime(t.receipt_datetime),
          t.dist_barcode || '-',
          t.dist_datetime ? formatDateTime(t.dist_datetime) : 'Belum Diambil',
          t.unit_name,
          t.item_name,
          t.reuse_count,
          `${t.effective_max_limit}x`,
          t.tool_condition,
          t.receiver_name || '-',
          t.sender_name || '-',
        ]);

    const csv = [headers, ...rows]
      .map((line) => line.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-reuse-dtt-${activeTab.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpi = reportData.kpi || {};
  const summaryRows = reportData.summary_by_tool || [];
  const txRows = reportData.transactions || [];

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-sm">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Laporan Reuse DTT
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Terintegrasi otomatis dari Penerimaan & Pengambilan Alat DTT — kontrol batas maksimal 3x / 4x tanpa pencatatan manual.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={fetchReport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Muat Ulang
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs"
          >
            <Download size={14} /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 px-3.5 py-2 text-xs font-bold text-white shadow-xs"
          >
            <Printer size={14} /> Cetak PDF
          </button>
        </div>
      </div>

      {/* Notifikasi Peringatan Otomatis */}
      {Number(kpi.danger_count || 0) > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-rose-900 shadow-xs">
          <AlertOctagon size={22} className="shrink-0 text-rose-600 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-black uppercase tracking-wide text-rose-700">
              PERINGATAN BATAS MAKSIMAL REUSE TERCAPAI ({kpi.danger_count} Alat)
            </p>
            <p className="mt-0.5 text-rose-800">
              Terdapat <b>{kpi.danger_count} jenis alat DTT</b> yang telah mencapai batas maksimal pemakaian ulang (3x / 4x) atau berstatus Rusak/Afkir. Segera lakukan evaluasi penggantian alat baru.
            </p>
          </div>
        </div>
      )}

      {Number(kpi.warning_count || 0) > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-xs">
          <AlertTriangle size={20} className="shrink-0 text-amber-600 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-extrabold text-amber-800">
              WARNING: {kpi.warning_count} Alat DTT Mendekati Batas Maksimal Reuse
            </p>
            <p className="mt-0.5 text-amber-800/90">
              Sisa pemakaian tinggal <b>1x siklus lagi</b> sebelum mencapai batas maksimal. Harap siapkan stok pengganti.
            </p>
          </div>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Alat DTT Terpantau</span>
            <Sparkles size={17} className="text-purple-600" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{kpi.total_tools || 0}</p>
          <p className="text-[11px] text-slate-500">
            {kpi.total_receipts || 0} terima • {kpi.total_distributions || 0} ambil
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Status Aman</span>
            <CheckCircle2 size={17} className="text-emerald-600" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-emerald-700">{kpi.safe_count || 0}</p>
          <p className="text-[11px] text-emerald-700/80">Masih di bawah batas reuse</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Warning (Sisa 1x)</span>
            <AlertTriangle size={17} className="text-amber-600" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-amber-700">{kpi.warning_count || 0}</p>
          <p className="text-[11px] text-amber-700/80">Mendekati batas 3x / 4x</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Batas Maksimal</span>
            <ShieldAlert size={17} className="text-rose-600" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-rose-700">{kpi.danger_count || 0}</p>
          <p className="text-[11px] text-rose-700/80">Wajib afkir / ganti baru</p>
        </div>
      </div>

      {/* Tabs + Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('SUMMARY')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'SUMMARY'
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Rekap & Kontrol Batas Reuse ({summaryRows.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'HISTORY'
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Riwayat Terintegrasi Terima & Ambil ({txRows.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama alat, kode, barcode, unit..."
              className="input-base pl-9 text-xs"
            />
          </div>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="input-base text-xs font-medium"
          >
            <option value="">Semua Unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value)}
            className="input-base text-xs font-medium"
          >
            <option value="ALL">Semua Status Reuse</option>
            <option value="DANGER">Batas Maksimal Tercapai</option>
            <option value="WARNING">Warning (Mendekati Batas)</option>
            <option value="SAFE">Aman</option>
          </select>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-base text-xs px-2"
              title="Tanggal Mulai"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-base text-xs px-2"
              title="Tanggal Selesai"
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Memuat data otomatis Laporan Reuse DTT...</div>
        ) : activeTab === 'SUMMARY' ? (
          summaryRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Belum ada data transaksi Penerimaan / Pengambilan Alat DTT yang sesuai filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Unit & Alat DTT</th>
                    <th className="px-3 py-3 text-center">Terima / Ambil</th>
                    <th className="px-3 py-3">Siklus Reuse</th>
                    <th className="px-3 py-3">Status Peringatan</th>
                    <th className="px-3 py-3">Kondisi</th>
                    <th className="px-3 py-3">Transaksi Terakhir</th>
                    {isAdmin && <th className="px-3 py-3 text-center print:hidden">Batas Maks</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryRows.map((row) => {
                    const pct = Math.min(Math.round((row.current_reuse / row.max_reuse_limit) * 100), 100);
                    const barColor =
                      row.alert_level === 'DANGER'
                        ? 'bg-rose-600'
                        : row.alert_level === 'WARNING'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500';

                    return (
                      <tr
                        key={row.key}
                        className={
                          row.alert_level === 'DANGER'
                            ? 'bg-rose-50/40'
                            : row.alert_level === 'WARNING'
                            ? 'bg-amber-50/40'
                            : 'hover:bg-slate-50/70'
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{row.item_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {row.unit_name} {row.item_code && row.item_code !== '-' ? `• ${row.item_code}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-slate-700">
                          {row.total_receipts}x Terima / {row.total_distributions}x Ambil
                        </td>
                        <td className="px-3 py-3 min-w-[140px]">
                          <div className="flex items-center justify-between text-xs font-extrabold">
                            <span
                              className={
                                row.alert_level === 'DANGER'
                                  ? 'text-rose-700'
                                  : row.alert_level === 'WARNING'
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }
                            >
                              {row.current_reuse}x / {row.max_reuse_limit}x
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              Sisa {row.remaining_reuse}x
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {row.alert_level === 'DANGER' ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 border border-rose-300 px-2.5 py-1 text-[11px] font-extrabold text-rose-800">
                              <AlertOctagon size={12} /> BATAS MAKSIMAL — WAJIB GANTI
                            </span>
                          ) : row.alert_level === 'WARNING' ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">
                              <AlertTriangle size={12} /> WARNING: MENDEKATI BATAS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                              <CheckCircle2 size={12} /> Aman ({row.remaining_reuse}x sisa)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">{conditionBadge(row.last_condition)}</td>
                        <td className="px-3 py-3 text-[11px] text-slate-600">
                          <div className="font-mono font-bold text-slate-800">{row.last_barcode}</div>
                          <div>{formatDateTime(row.last_receipt_datetime)}</div>
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-3 text-center print:hidden">
                            <div className="inline-flex items-center gap-1">
                              {[3, 4].map((lim) => (
                                <button
                                  key={lim}
                                  type="button"
                                  disabled={updatingKey === row.key}
                                  onClick={() => handleSetLimit(row, lim)}
                                  className={`rounded-lg px-2 py-1 text-[11px] font-extrabold transition ${
                                    row.max_reuse_limit === lim
                                      ? 'bg-brand-700 text-white shadow-xs'
                                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {lim}x
                                </button>
                              ))}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : txRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Belum ada riwayat transaksi DTT.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3">Penerimaan (RD)</th>
                  <th className="px-3 py-3">Pengambilan (DDTT)</th>
                  <th className="px-3 py-3">Unit & Alat DTT</th>
                  <th className="px-3 py-3">Siklus Reuse</th>
                  <th className="px-3 py-3">Kondisi</th>
                  <th className="px-3 py-3">Petugas Terima / Ambil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txRows.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <div className="font-mono font-bold text-brand-700">{tx.barcode}</div>
                      <div className="text-[11px] text-slate-500">{formatDateTime(tx.receipt_datetime)}</div>
                    </td>
                    <td className="px-3 py-3">
                      {tx.dist_barcode ? (
                        <>
                          <div className="font-mono font-bold text-emerald-700">{tx.dist_barcode}</div>
                          <div className="text-[11px] text-slate-500">{formatDateTime(tx.dist_datetime)}</div>
                        </>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {tx.process_stage}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-900">{tx.item_name}</div>
                      <div className="text-[11px] text-slate-500">
                        {tx.unit_name} • {tx.quantity} {tx.unit_label}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${
                          tx.alert_level === 'DANGER'
                            ? 'bg-rose-100 text-rose-800'
                            : tx.alert_level === 'WARNING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        Ke-{tx.reuse_count} / {tx.effective_max_limit}x
                      </span>
                    </td>
                    <td className="px-3 py-3">{conditionBadge(tx.tool_condition)}</td>
                    <td className="px-3 py-3 text-[11px] text-slate-600">
                      <div>Unit: <b>{tx.sender_name || '-'}</b></div>
                      <div>CSSD: <b>{tx.receiver_name || '-'}</b></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
