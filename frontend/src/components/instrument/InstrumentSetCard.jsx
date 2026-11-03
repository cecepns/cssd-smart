import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  Package,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';

/**
 * Kartu Monitoring Set Instrumen CSSD
 * Menyajikan monitoring stok, isi rincian instrumen, dan kelengkapan secara otomatis.
 */
export default function InstrumentSetCard({
  set,
  canEdit = true,
  canDelete = true,
  onEdit,
  onDelete,
  onToggleCompleteness,
  onReportDiscrepancy,
}) {
  const isAvailable = set.available_stock > 0;
  const isComplete = set.completeness_status === 'Lengkap';
  const items = set.items || [];
  const inUnitStock = Number(set.in_unit_stock ?? set.distributed_stock) || 0;
  const inProcessStock = Number(set.in_process_stock) || 0;
  const discrepancyCount = Number(set.discrepancy_count) || 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      {/* Header Kartu */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-black tracking-tight text-slate-800 uppercase">
              {set.name}
            </h3>
            {set.code && (
              <p className="mt-0.5 text-xs font-mono font-medium text-slate-600">
                {set.code} {set.description ? `• ${set.description}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isAvailable ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                Tersedia
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-0.5 text-xs font-semibold text-rose-700">
                Kosong
              </span>
            )}
          </div>
        </div>

        {/* 2 Box Statistik Utama: Jumlah Set Tersedia & Instrumen Per Set */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Box 1: Jumlah set tersedia (Siap Pakai di CSSD) */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
            <span className="block text-xs font-medium text-slate-500">
              Stok siap pakai
            </span>
            <span className="mt-1 block text-2xl font-black text-emerald-700 sm:text-3xl">
              {set.available_stock} Set
            </span>
          </div>

          {/* Box 2: Instrumen per set */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
            <span className="block text-xs font-medium text-slate-500">
              Instrumen per set
            </span>
            <span className="mt-1 block text-2xl font-black text-slate-800 sm:text-3xl">
              {set.total_instruments} Buah
            </span>
          </div>
        </div>

        {/* Status Pergerakan: Sedang di Unit & Sedang Diproses */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-sky-100 bg-sky-50/70 px-2.5 py-1.5 text-sky-800 font-medium">
            <Users size={14} className="text-sky-600 shrink-0" />
            <span>Di Unit: <strong>{inUnitStock} Set</strong></span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50/70 px-2.5 py-1.5 text-amber-800 font-medium">
            <Clock size={14} className="text-amber-600 shrink-0" />
            <span>Proses: <strong>{inProcessStock} Set</strong></span>
          </div>
        </div>

        {/* Section: Daftar Instrumen dalam 1 Set */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              Rincian instrumen dalam 1 set
            </h4>
            <span className="text-xs text-slate-500 font-medium">
              {items.length} macam item
            </span>
          </div>

          {/* Tabel / List Instrumen */}
          <div className="mt-2.5">
            <div className="flex justify-between border-b border-slate-200 pb-1.5 text-xs font-semibold text-slate-700">
              <span>Nama instrumen</span>
              <span>Jumlah</span>
            </div>

            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-600">
                Belum ada rincian instrumen. Klik edit untuk menambahkan.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="flex items-center justify-between py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-50/80 px-1 rounded"
                  >
                    <span className="pr-2">{it.instrument_name}</span>
                    <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                      {it.quantity} {it.unit_label || 'Buah'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Total Row */}
            <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2 text-xs sm:text-sm font-bold text-slate-900">
              <span>Total Standar</span>
              <span className="tabular-nums">{set.total_instruments} Buah</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Kartu: Status Kelengkapan & Aksi */}
      <div className="mt-5 border-t border-slate-100 pt-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Badge Status Kelengkapan (bisa diklik untuk ubah cepat) */}
          <button
            type="button"
            onClick={() => onToggleCompleteness?.(set)}
            title="Klik untuk mengubah status kelengkapan"
            className="group inline-flex items-center gap-1.5 transition-transform active:scale-95"
          >
            {isComplete ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 group-hover:bg-emerald-100 transition-colors">
                <CheckCircle2 size={13} /> Lengkap
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 group-hover:bg-amber-100 transition-colors">
                <AlertCircle size={13} /> Tidak Lengkap
              </span>
            )}
          </button>

          {/* Action buttons (Lapor Hilang/Rusak, Edit & Hapus) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onReportDiscrepancy?.(set)}
              title="Catat instrumen hilang, rusak, atau kurang pada set ini"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors border border-amber-200"
            >
              <AlertTriangle size={12} />
              <span>Lapor Kurang/Rusak</span>
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit?.(set)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Edit2 size={12} /> Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete?.(set)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Catatan jika tidak lengkap / ada barang hilang */}
        {(!isComplete || discrepancyCount > 0) && (
          <div className="text-xs font-medium text-amber-800 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/90 space-y-1">
            {set.missing_notes && (
              <p>⚠️ <strong>Catatan:</strong> {set.missing_notes}</p>
            )}
            {discrepancyCount > 0 && (
              <p className="text-[11px] text-amber-700 font-semibold">
                🔔 Terdapat {discrepancyCount} catatan instrumen bermasalah yang belum diselesaikan.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
