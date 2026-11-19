import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { useAuth } from '@/context/AuthContext';
import { getList } from '@/utils/request';
import Button from '@/components/ui/Button';

/**
 * Komponen pemilih Set / Alat DTT untuk Pengambilan Alat DTT (Reuse).
 * Langsung menampilkan daftar Set DTT dari Master Data unit penerima,
 * tanpa harus menunggu alat kotor DTT masuk terlebih dahulu.
 */
export default function DttSetSelector({ values, setValue, setValues }) {
  const { user } = useAuth();
  const isUnit = user?.role === 'unit';
  const [dttCatalog, setDttCatalog] = useState([]);
  const [readyList, setReadyList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSet, setSelectedSet] = useState(null);

  const currentUnitId = isUnit && user?.unit_id ? String(user.unit_id) : (values?.unit_id ? String(values.unit_id) : '');

  // Ambil daftar master alat DTT milik unit dan alat siap DTT
  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      getList(API_ENDPOINTS.LOOKUPS.ITEMS, {
        is_active: 1,
        process_type: 'DTT',
        unit_id: currentUnitId || undefined,
        limit: 100,
        sort_by: 'name',
        order: 'asc',
      }).catch(() => ({ data: [] })),
      getList(API_ENDPOINTS.DTT_RECEIPTS.READY, {
        unit_id: currentUnitId || undefined,
        limit: 100,
      }).catch(() => ({ data: [] })),
    ])
      .then(([catalogRes, readyRes]) => {
        if (!active) return;
        setDttCatalog(catalogRes.data || []);
        setReadyList(readyRes.data || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUnitId]);

  // Filter pencarian
  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dttCatalog;
    return dttCatalog.filter(
      (it) =>
        (it.name || '').toLowerCase().includes(q) ||
        (it.code || '').toLowerCase().includes(q) ||
        (it.unit_name || '').toLowerCase().includes(q)
    );
  }, [dttCatalog, search]);

  const handleSelect = (item, readyReceipt = null) => {
    const itemName = item.name || item.item_name;
    const unitLabel = item.unit_label || 'pcs';
    const toolCondition = readyReceipt?.tool_condition || 'Baik';
    const reuseCount = readyReceipt?.reuse_count || 1;
    const receiptId = readyReceipt ? readyReceipt.id : null;

    setSelectedSet({
      name: itemName,
      unit_label: unitLabel,
      tool_condition: toolCondition,
      reuse_count: reuseCount,
      receipt_barcode: readyReceipt?.barcode || null,
      source: readyReceipt ? 'READY' : 'MASTER',
    });

    const patch = {
      dtt_receipt_id: receiptId || '',
      item_name: itemName,
      unit_label: unitLabel,
      tool_condition: toolCondition,
      reuse_count: reuseCount,
      quantity: 1,
    };
    if (readyReceipt?.sender_name && !values?.receiver_name) {
      patch.receiver_name = readyReceipt.sender_name;
    }

    if (setValues) setValues(patch);
    else Object.entries(patch).forEach(([k, v]) => setValue(k, v));

    toast.success(`Set DTT "${itemName}" dipilih`);
  };

  const handleReset = () => {
    setSelectedSet(null);
    if (setValues) {
      setValues({
        dtt_receipt_id: '',
        item_name: '',
        unit_label: '',
        tool_condition: 'Baik',
        reuse_count: 1,
      });
    } else {
      setValue('dtt_receipt_id', '');
      setValue('item_name', '');
    }
  };

  // Tampilan Set DTT Terpilih
  if (selectedSet) {
    return (
      <div className="rounded-2xl border-2 border-emerald-500/80 bg-emerald-50/20 p-4 shadow-sm transition-all sm:p-5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between border-b border-emerald-100 pb-3.5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                <CheckCircle2 size={13} />
                Set DTT Terpilih
              </span>
              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                {selectedSet.receipt_barcode ? `Hasil DTT: ${selectedSet.receipt_barcode}` : 'Master Data DTT (Otomatis)'}
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-black text-slate-900 uppercase">
              {selectedSet.name}
            </h3>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            className="self-start text-xs border-slate-300 text-slate-700 hover:bg-white"
          >
            <RotateCcw size={13} />
            <span>Ganti Set Lain</span>
          </Button>
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
            <span className="text-slate-500 block font-medium">Satuan Alat:</span>
            <span className="text-slate-900 font-bold mt-0.5 block">{selectedSet.unit_label}</span>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
            <span className="text-slate-500 block font-medium">Kondisi Alat Medis:</span>
            <span className="text-emerald-700 font-bold mt-0.5 block">{selectedSet.tool_condition}</span>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
            <span className="text-slate-500 block font-medium">Penggunaan Ulang:</span>
            <span className="text-slate-900 font-bold mt-0.5 block">Reuse Ke-{selectedSet.reuse_count}</span>
          </div>
        </div>

        <p className="mt-2.5 text-[11px] font-medium text-emerald-800 flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
          Rincian Set DTT otomatis terisi. Barcode serah terima (DDTT-...) dibuat otomatis saat klik Simpan.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-700" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Pilih Set DTT (Master Data Unit)
          </span>
        </div>
        <span className="text-[11px] text-slate-500">
          Klik nama set DTT untuk memilih langsung
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari set DTT / alat reuse (mis. Sungkup, Tabung, Sirkuit)..."
          className="input-base pl-8 text-xs font-medium py-1.5 bg-white"
        />
      </div>

      {/* List Set DTT */}
      <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center p-6 text-xs text-slate-500 gap-2">
            <RefreshCw size={14} className="animate-spin text-brand-600" />
            <span>Memuat master set DTT...</span>
          </div>
        ) : filteredCatalog.length === 0 && readyList.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Belum ada Set DTT terdaftar untuk unit ini.</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Pilih unit penerima di bawah atau daftarkan jenis alat DTT pada Master Data Alat DTT.
            </p>
          </div>
        ) : (
          <>
            {/* 1. Paket DTT Siap Serah (Jika ada hasil proses DTT selesai) */}
            {readyList.map((ready) => (
              <div
                key={`ready-${ready.id}`}
                onClick={() => handleSelect(ready, ready)}
                className="group flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-emerald-50/60"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black">
                      Siap Serah (Hasil DTT)
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {ready.barcode}
                    </span>
                  </div>
                  <h4 className="mt-1 text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-800">
                    {ready.item_name}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {ready.quantity} {ready.unit_label} • Unit: {ready.unit_name} • Reuse ke-{ready.reuse_count} • Kondisi: {ready.tool_condition}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition"
                >
                  Pilih
                </button>
              </div>
            ))}

            {/* 2. Master Set DTT Milik Unit */}
            {filteredCatalog.map((item) => (
              <div
                key={`cat-${item.id}`}
                onClick={() => handleSelect(item)}
                className="group flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-brand-50/50"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-brand-100 text-brand-800 px-2 py-0.5 text-[10px] font-bold">
                      Master Set DTT
                    </span>
                    {item.code && (
                      <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {item.code}
                      </span>
                    )}
                    {item.unit_name && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Unit: {item.unit_name}
                      </span>
                    )}
                  </div>
                  <h4 className="mt-1 text-xs sm:text-sm font-bold text-slate-900 group-hover:text-brand-700">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Satuan: {item.unit_label || 'Set'} • Kategori: Set DTT / Reuse
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 group-hover:bg-brand-700 group-hover:text-white transition"
                >
                  Pilih
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
