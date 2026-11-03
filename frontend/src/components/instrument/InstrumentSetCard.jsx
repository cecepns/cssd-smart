import { useState } from 'react';
import { AlertCircle, CheckCircle2, Edit2, MoreVertical, Package, Trash2, Clock, Check } from 'lucide-react';

/**
 * Kartu Set Instrumen CSSD
 * Tampilan dirancang persis sesuai referensi visual:
 * - Header nama set dan badge Tersedia / Kosong
 * - 2 Box: Jumlah set tersedia & Instrumen per set
 * - Rincian tabel nama instrumen dan jumlah
 * - Total instrumen
 * - Badge status kelengkapan (Lengkap / Tidak Lengkap)
 */
export default function InstrumentSetCard({
  set,
  canEdit = true,
  canDelete = true,
  onEdit,
  onDelete,
  onToggleCompleteness,
}) {
  const isAvailable = set.available_stock > 0;
  const isComplete = set.completeness_status === 'Lengkap';
  const items = set.items || [];

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
          <div className="flex items-center gap-2 shrink-0">
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

        {/* 2 Box Statistik: Jumlah Set Tersedia & Instrumen Per Set */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Box 1: Jumlah set tersedia */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
            <span className="block text-xs font-medium text-slate-500">
              Jumlah set tersedia
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

        {/* Info Alur Siklus: Dalam Proses & Terdistribusi (opsional/ekstra) */}
        {(set.in_process_stock > 0 || set.distributed_stock > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 px-1">
            {set.in_process_stock > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                <Clock size={13} /> Sedang diproses: {set.in_process_stock} set
              </span>
            )}
            {set.distributed_stock > 0 && (
              <span className="inline-flex items-center gap-1 text-sky-700 font-medium">
                <Package size={13} /> Di Unit: {set.distributed_stock} set
              </span>
            )}
          </div>
        )}

        {/* Section: Daftar Instrumen dalam 1 Set */}
        <div className="mt-5">
          <h4 className="text-sm font-bold text-slate-900">
            Daftar instrumen dalam 1 set
          </h4>

          {/* Tabel / List Instrumen */}
          <div className="mt-2.5">
            <div className="flex justify-between border-b border-slate-200 pb-2 text-xs font-semibold text-slate-700">
              <span>Nama instrumen</span>
              <span>Jumlah</span>
            </div>

            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-600">
                Belum ada rincian instrumen. Klik edit untuk menambahkan.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="flex items-center justify-between py-2 text-sm text-slate-700"
                  >
                    <span className="pr-2">{it.instrument_name}</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {it.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Total Row */}
            <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2.5 text-sm font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{set.total_instruments}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Kartu: Badge Kelengkapan & Aksi */}
      <div className="mt-5 border-t border-slate-100 pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Badge Status Kelengkapan (bisa diklik untuk toggle/ubah) */}
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

          {/* Action buttons (Edit & Hapus) */}
          <div className="flex items-center gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit?.(set)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Edit2 size={13} /> Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete?.(set)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
              >
                <Trash2 size={13} /> Hapus
              </button>
            )}
          </div>
        </div>

        {/* Catatan jika tidak lengkap */}
        {!isComplete && set.missing_notes && (
          <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50/60 p-2 rounded-lg border border-amber-100">
            ⚠️ {set.missing_notes}
          </p>
        )}
      </div>
    </div>
  );
}

