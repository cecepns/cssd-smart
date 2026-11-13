import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import useFetch from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { STAGE_LABELS } from '@/utils/constants';
import { formatDate } from '@/utils/format';

export default function UnitTrackingPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();

  // Ambil unitId dari query parameter atau dari session user unit
  const requestedUnitId = params.get('unit_id');
  const unitNameParam = params.get('unit_name');

  const effectiveUnitId = useMemo(() => {
    // Jika user yang login adalah unit luar, wajib kunci ke unit miliknya sendiri
    if (user?.role === 'unit' && user?.unit_id) {
      return user.unit_id;
    }
    return requestedUnitId ? parseInt(requestedUnitId, 10) : null;
  }, [user, requestedUnitId]);

  const [activeTab, setActiveTab] = useState('IN_PROCESS'); // 'IN_PROCESS' | 'READY_STERIL' | 'READY_DTT' | 'HISTORY'

  const endpoint = effectiveUnitId ? API_ENDPOINTS.PUBLIC_UNIT_STATUS(effectiveUnitId) : null;
  const { data: statusData, loading, error, reload } = useFetch(endpoint, {}, { enabled: Boolean(effectiveUnitId) });

  const status = statusData?.data || statusData || {};
  const unit = status.unit || { id: effectiveUnitId, name: unitNameParam || 'Unit Rumah Sakit' };

  const inProcess = status.inProcess || [];
  const readySterile = status.readySterile || [];
  const readyDtt = status.readyDtt || [];
  const recentHistory = status.recentHistory || [];

  return (
    <div className="space-y-5">
      {/* Header Halaman Pemantauan */}
      <div className="no-print">
        <PageHeader
          title={`Pemantauan Status Alat: ${unit.name || 'Unit'}`}
          subtitle="Status realtime alat kotor dalam proses CSSD, kesiapan alat steril & DTT untuk diambil, serta riwayat unit"
          icon={Building2}
          actions={
            <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading}>
              Segarkan Data
            </Button>
          }
        />
      </div>

      {!effectiveUnitId ? (
        <div className="card p-8 text-center">
          <EmptyState
            icon={Building2}
            title="Pilih Unit untuk Memantau"
            description="Scan barcode unit di depan loket CSSD atau masuk menggunakan akun unit Anda untuk melihat status alat."
          />
        </div>
      ) : loading && !statusData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : error ? (
        <div className="card rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-center">
          <AlertCircle size={32} className="mx-auto text-rose-600 mb-2" />
          <h3 className="text-base font-bold text-rose-900">Gagal Memuat Status Unit</h3>
          <p className="mt-1 text-xs text-rose-700">{error}</p>
          <Button variant="secondary" size="sm" onClick={reload} className="mt-4">
            Coba Lagi
          </Button>
        </div>
      ) : (
        <>
          {/* Kartu Ringkasan Status */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div
              onClick={() => setActiveTab('IN_PROCESS')}
              className={`card cursor-pointer transition hover:shadow-md ${
                activeTab === 'IN_PROCESS' ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-300/60' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Dalam Proses CSSD
                </p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <Clock size={16} />
                </span>
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                {inProcess.length} <span className="text-xs font-medium text-slate-500">batch</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-600">Pencucian, pengeringan, sterilisasi</p>
            </div>

            <div
              onClick={() => setActiveTab('READY_STERIL')}
              className={`card cursor-pointer transition hover:shadow-md ${
                activeTab === 'READY_STERIL' ? 'border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-300/60' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Alat Steril Siap Diambil
                </p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <ShieldCheck size={16} />
                </span>
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-emerald-700 tabular-nums">
                {readySterile.length} <span className="text-xs font-medium text-slate-500">paket</span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-800 font-semibold">Tersedia di loket pengambilan</p>
            </div>

            <div
              onClick={() => setActiveTab('READY_DTT')}
              className={`card cursor-pointer transition hover:shadow-md ${
                activeTab === 'READY_DTT' ? 'border-purple-400 bg-purple-50/40 ring-2 ring-purple-300/60' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Alat DTT Siap Diambil
                </p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-800">
                  <Sparkles size={16} />
                </span>
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-purple-700 tabular-nums">
                {readyDtt.length} <span className="text-xs font-medium text-slate-500">item</span>
              </p>
              <p className="mt-1 text-[11px] text-purple-800 font-semibold">Proses DTT telah selesai</p>
            </div>
          </div>

          {/* Tab Navigasi Detail */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('IN_PROCESS')}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                activeTab === 'IN_PROCESS'
                  ? 'bg-[#0A192F] text-amber-300 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Dalam Proses CSSD ({inProcess.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('READY_STERIL')}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                activeTab === 'READY_STERIL'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Alat Steril Siap Diambil ({readySterile.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('READY_DTT')}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                activeTab === 'READY_DTT'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Alat DTT Siap Diambil ({readyDtt.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                activeTab === 'HISTORY'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Riwayat Serah Terima ({recentHistory.length})
            </button>
          </div>

          {/* Konten Tab 1: Dalam Proses CSSD */}
          {activeTab === 'IN_PROCESS' && (
            <div className="card overflow-hidden p-0">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Daftar Alat Kotor Unit {unit.name} yang Sedang Diproses CSSD
                </h3>
              </div>
              {!inProcess.length ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Tidak ada alat kotor dari unit {unit.name} yang sedang diproses. Semua alat telah selesai diproses.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Barcode</th>
                        <th>Tanggal Masuk</th>
                        <th>Nama Alat / Set</th>
                        <th>Jumlah</th>
                        <th>Tahap Proses Saat Ini</th>
                        <th>Status</th>
                        <th>Penerima CSSD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inProcess.map((item) => (
                        <tr key={item.id}>
                          <td className="font-mono text-xs font-bold text-slate-900">{item.barcode}</td>
                          <td className="text-xs text-slate-600">{formatDate(item.receipt_date)}</td>
                          <td className="font-bold text-slate-900">{item.item_name}</td>
                          <td className="font-semibold text-slate-900 tabular-nums">
                            {item.quantity} {item.unit_label || 'Pcs'}
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                              <RefreshCw size={12} className="animate-spin" />
                              {STAGE_LABELS[item.stage] || `Tahap ${item.stage}`}
                            </span>
                          </td>
                          <td>
                            <StatusBadge value={item.status} />
                          </td>
                          <td className="text-xs text-slate-700">{item.receiver_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Konten Tab 2: Alat Steril Siap Diambil */}
          {activeTab === 'READY_STERIL' && (
            <div className="card overflow-hidden p-0">
              <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                  Alat Steril Siap Diambil di Loket CSSD (Khusus Unit {unit.name})
                </h3>
              </div>
              {!readySterile.length ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada alat steril baru yang siap diambil untuk unit ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Barcode Paket</th>
                        <th>Nama Alat / Set</th>
                        <th>Jumlah</th>
                        <th>Tanggal Pengemasan</th>
                        <th>Kedaluwarsa Steril</th>
                        <th>Bahan Kemasan</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readySterile.map((item) => (
                        <tr key={item.id} className="bg-emerald-50/30">
                          <td className="font-mono text-xs font-black text-emerald-900">{item.barcode}</td>
                          <td className="font-extrabold text-slate-900">{item.item_name}</td>
                          <td className="font-bold text-slate-900 tabular-nums">
                            {item.quantity} {item.unit_label || 'Set'}
                          </td>
                          <td className="text-xs text-slate-600">{formatDate(item.pack_date)}</td>
                          <td className="font-mono text-xs font-bold text-emerald-700">
                            {formatDate(item.expiry_date)}
                          </td>
                          <td className="text-xs text-slate-700">{item.material || '-'}</td>
                          <td>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                              <CheckCircle2 size={12} /> Siap Diambil
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Konten Tab 3: Alat DTT Siap Diambil */}
          {activeTab === 'READY_DTT' && (
            <div className="card overflow-hidden p-0">
              <div className="border-b border-purple-100 bg-purple-50 px-4 py-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-900">
                  Alat Hasil DTT Siap Diambil di Loket CSSD (Khusus Unit {unit.name})
                </h3>
              </div>
              {!readyDtt.length ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada alat hasil DTT yang siap diambil untuk unit ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Barcode DTT</th>
                        <th>Nama Instrumen Medis</th>
                        <th>Jumlah</th>
                        <th>Waktu Masuk DTT</th>
                        <th>Tahap DTT</th>
                        <th>Petugas CSSD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readyDtt.map((item) => (
                        <tr key={item.id} className="bg-purple-50/30">
                          <td className="font-mono text-xs font-black text-purple-900">{item.barcode}</td>
                          <td className="font-extrabold text-slate-900">{item.item_name}</td>
                          <td className="font-bold text-slate-900 tabular-nums">
                            {item.quantity} {item.unit_label || 'Pcs'}
                          </td>
                          <td className="text-xs text-slate-600">{formatDate(item.receipt_datetime)}</td>
                          <td>
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                              <Sparkles size={12} /> {item.process_stage}
                            </span>
                          </td>
                          <td className="text-xs text-slate-700">{item.officer_cssd || item.receiver_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Konten Tab 4: Riwayat Serah Terima Unit */}
          {activeTab === 'HISTORY' && (
            <div className="card overflow-hidden p-0">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Riwayat 10 Transaksi Terakhir Unit {unit.name}
                </h3>
              </div>
              {!recentHistory.length ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada catatan riwayat transaksi untuk unit ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Jenis Transaksi</th>
                        <th>Barcode</th>
                        <th>Tanggal</th>
                        <th>Nama Alat</th>
                        <th>Jumlah</th>
                        <th>Petugas Terkait</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentHistory.map((item, i) => (
                        <tr key={i}>
                          <td>
                            <span
                              className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-extrabold ${
                                item.jenis.includes('Kotor')
                                  ? 'bg-rose-100 text-rose-800'
                                  : item.jenis.includes('Steril')
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {item.jenis}
                            </span>
                          </td>
                          <td className="font-mono text-xs font-bold text-slate-800">{item.barcode || '-'}</td>
                          <td className="text-xs text-slate-600">{formatDate(item.tanggal)}</td>
                          <td className="font-bold text-slate-900">{item.item_name}</td>
                          <td className="font-semibold text-slate-800 tabular-nums">
                            {item.quantity} {item.unit_label || 'Set'}
                          </td>
                          <td className="text-xs text-slate-700">{item.petugas || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

