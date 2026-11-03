import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  AlertTriangle,
  Barcode,
  CheckCircle2,
  ChevronDown,
  Layers,
  Package,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getList } from '@/utils/request';
import { formatDate } from '@/utils/format';
import BarcodeInput from '@/components/form/BarcodeInput';
import Button from '@/components/ui/Button';

/**
 * Komponen pemilih set steril untuk Distribusi / Pengambilan.
 * Memungkinkan:
 * 1. Klik langsung dari daftar set steril yang siap diambil (berdasarkan unit/tanda terima kotor).
 * 2. Scan barcode (bisa barcode paket ST-... atau barcode tanda terima kotor AK-...).
 * 3. Menampilkan rincian isi set secara otomatis (isi instrumen lengkap per set).
 */
export default function SterileSetSelector({ values, setValue, setValues, gauze = false }) {
  const [mode, setMode] = useState('SELECT'); // 'SELECT' | 'SCAN'
  const [readyList, setReadyList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [units, setUnits] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [scanCode, setScanCode] = useState('');
  const [searchingCode, setSearchingCode] = useState(false);

  // Ambil daftar unit untuk filter
  useEffect(() => {
    let active = true;
    getList(API_ENDPOINTS.UNITS.LIST, { is_active: 1, limit: 100, sort_by: 'name', order: 'asc' })
      .then((res) => {
        if (active && res.data) setUnits(res.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Ambil daftar stok steril yang siap diambil
  const fetchReadyStock = async () => {
    setLoading(true);
    try {
      const res = await getList(API_ENDPOINTS.STERILE_STOCK.READY, {
        type: gauze ? 'KASA' : 'ALAT',
        unit_id: unitFilter || undefined,
        search: search.trim() || undefined,
      });
      setReadyList(res.data || []);
    } catch (err) {
      toast.error('Gagal memuat daftar stok steril siap ambil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadyStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitFilter, gauze]);

  // Handler saat memilih stok dari daftar atau hasil scan
  const handleSelectStock = (stock) => {
    if (!stock) return;
    setSelectedStock(stock);

    // Auto-fill form fields
    setValue('barcode', stock.barcode);
    if (stock.origin_unit_id) {
      setValue('unit_id', stock.origin_unit_id);
    }
    setValue('quantity', 1);
    if (stock.origin_sender && !values.receiver_name) {
      setValue('receiver_name', stock.origin_sender);
    }

    toast.success(`Set ${stock.item_name} dipilih`);
  };

  // Lookup melalui barcode (bisa barcode ST-... atau AK-...)
  const handleLookupBarcode = async (code) => {
    const clean = (code || '').trim();
    if (!clean) return;
    setSearchingCode(true);
    try {
      const res = await getList(API_ENDPOINTS.STERILE_STOCK.LOOKUP, { code: clean });
      const stock = res.data;
      if (!stock) {
        toast.error(`Barcode ${clean} tidak ditemukan di stok steril`);
        return;
      }

      const isGauze = stock.category === 'Kasa Steril';
      if (gauze !== isGauze) {
        toast.error(
          isGauze
            ? 'Barcode ini adalah Kasa Steril, gunakan menu Distribusi Kasa Steril'
            : 'Barcode ini adalah Alat Steril, gunakan menu Distribusi Alat Steril'
        );
        return;
      }

      handleSelectStock(stock);
    } catch (err) {
      toast.error(err?.message || `Barcode ${clean} tidak ditemukan`);
    } finally {
      setSearchingCode(false);
    }
  };

  const handleResetSelection = () => {
    setSelectedStock(null);
    setValue('barcode', '');
  };

  // Jika sudah ada set yang dipilih, tampilkan preview rincian set
  if (selectedStock) {
    const isComplete = selectedStock.completeness_status === 'Lengkap';
    const items = selectedStock.items || [];

    return (
      <div className="rounded-2xl border-2 border-brand-500/80 bg-brand-50/20 p-4 shadow-sm transition-all sm:p-5">
        {/* Header Preview Set */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between border-b border-brand-100 pb-3.5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                <CheckCircle2 size={13} />
                Set Terpilih
              </span>
              <span className="font-mono text-xs font-bold text-brand-800 bg-brand-100/80 px-2 py-0.5 rounded">
                {selectedStock.barcode}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Kategori: <strong>{selectedStock.category}</strong>
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-black text-slate-900 uppercase">
              {selectedStock.item_name}
            </h3>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetSelection}
            className="self-start text-xs border-slate-300 text-slate-700 hover:bg-white"
          >
            <RotateCcw size={13} />
            <span>Ganti Set Lain</span>
          </Button>
        </div>

        {/* Info Asal Penerimaan Kotor & Sterilisasi */}
        <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
            <span className="text-slate-500 block font-medium">Unit Asal Penyerah:</span>
            <span className="text-slate-900 font-bold mt-0.5 block">
              {selectedStock.origin_unit_name || 'Umum / Stok CSSD'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
            <span className="text-slate-500 block font-medium">Bukti Terima Kotor:</span>
            <span className="text-slate-900 font-bold font-mono mt-0.5 block">
              {selectedStock.receipt_barcode ? (
                <span>{selectedStock.receipt_barcode} {selectedStock.receipt_date ? `(${formatDate(selectedStock.receipt_date)})` : ''}</span>
              ) : (
                'Non-penerimaan kotor'
              )}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
            <span className="text-slate-500 block font-medium">Batch & Kedaluwarsa:</span>
            <span className="text-slate-900 font-bold mt-0.5 block">
              Batch: {selectedStock.batch_no || '-'} • Exp: {formatDate(selectedStock.expiry_date)}
            </span>
          </div>
        </div>

        {/* Section Rincian Isi Set Instrumen (Otomatis Keluar Isi Set) */}
        {selectedStock.category === 'Set Instrumen' && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-brand-700" />
                <span className="text-sm font-bold text-slate-900">
                  Rincian Instrumen dalam 1 Set
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  ({items.length} macam item)
                </span>
              </div>

              {selectedStock.completeness_status && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isComplete
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {isComplete ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  {selectedStock.completeness_status}
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-500">
                Tidak ada rincian item instrumen tersimpan untuk set ini.
              </p>
            ) : (
              <div className="mt-2.5 max-h-48 divide-y divide-slate-100 overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="flex items-center justify-between py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-50/80 px-1 rounded"
                  >
                    <span className="font-medium text-slate-800">{it.instrument_name}</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {it.quantity} {it.unit_label || 'Buah'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Total Standar Set */}
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs font-bold text-slate-900">
              <span>Total Standar Instrumen:</span>
              <span className="text-brand-700">
                {selectedStock.total_instruments || items.reduce((acc, c) => acc + Number(c.quantity || 1), 0)} Buah
              </span>
            </div>

            {/* Catatan Kekurangan jika ada */}
            {!isComplete && selectedStock.missing_notes && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
                ⚠️ <strong>Catatan Alat Kurang/Hilang:</strong> {selectedStock.missing_notes}
              </div>
            )}
          </div>
        )}

        <p className="mt-2.5 text-[11px] font-medium text-emerald-800 flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
          Unit tujuan dan barcode telah terisi otomatis sesuai tanda terima alat kotor.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4 space-y-3">
      {/* Tab Switcher Mode (Mobile-friendly Stack & Full Width Grid) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-slate-200 pb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Metode Pemilihan Alat Steril
        </span>

        <div className="grid grid-cols-2 sm:inline-flex rounded-xl bg-slate-200/80 p-1 text-xs font-bold w-full sm:w-auto gap-1">
          <button
            type="button"
            onClick={() => setMode('SELECT')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              mode === 'SELECT'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} className="shrink-0" />
            <span>Pilih Set Siap</span>
            {readyList.length > 0 && (
              <span className="rounded-full bg-brand-100 text-brand-800 px-1.5 py-0.2 text-[10px] font-black shrink-0">
                {readyList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMode('SCAN')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              mode === 'SCAN'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ScanLine size={14} className="shrink-0" />
            <span>Scan Barcode</span>
          </button>
        </div>
      </div>

      {/* MODE 1: PILIH DARI DAFTAR SET SIAP AMBIL */}
      {mode === 'SELECT' && (
        <div className="space-y-2.5">
          {/* Bar Filter Unit & Cari */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="input-base text-xs font-medium py-1.5"
            >
              <option value="">Semua Unit Asal Penyerah</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReadyStock()}
                placeholder="Cari nama set / barcode..."
                className="input-base pl-8 text-xs font-medium py-1.5"
              />
            </div>
          </div>

          {/* List Kartu Set Siap Ambil */}
          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {loading ? (
              <div className="flex items-center justify-center p-6 text-xs text-slate-500 gap-2">
                <RefreshCw size={14} className="animate-spin text-brand-600" />
                <span>Memuat daftar set steril siap ambil...</span>
              </div>
            ) : readyList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                <p className="font-semibold text-slate-700">Tidak ada set steril yang siap diambil saat ini.</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {unitFilter ? 'Tidak ada set steril untuk unit yang dipilih.' : 'Pastikan alat kotor telah selesai disterilkan dan lolos verifikasi.'}
                </p>
              </div>
            ) : (
              readyList.map((stk) => (
                <div
                  key={stk.id}
                  onClick={() => handleSelectStock(stk)}
                  className="group flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-brand-50/50"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 group-hover:text-brand-800">
                        {stk.barcode}
                      </span>
                      {stk.completeness_status && (
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                            stk.completeness_status === 'Lengkap'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {stk.completeness_status}
                        </span>
                      )}
                    </div>

                    <h4 className="mt-0.5 text-sm font-black text-slate-900 uppercase truncate">
                      {stk.item_name}
                    </h4>

                    <p className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>Unit: <strong>{stk.origin_unit_name || 'Umum'}</strong></span>
                      {stk.receipt_barcode && (
                        <span>• Tanda Terima: <strong>{stk.receipt_barcode}</strong></span>
                      )}
                      <span>• Sisa: <strong>{stk.quantity} {stk.unit_label}</strong></span>
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectStock(stk);
                    }}
                    className="shrink-0 text-xs py-1 h-7"
                  >
                    Pilih Set
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODE 2: SCAN BARCODE (BISA BARCODE PAKET ST-... ATAU BARCODE KOTOR AK-...) */}
      {mode === 'SCAN' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">
            Arahkan kamera HP ke barcode stiker paket steril (<strong>ST-...</strong>) atau barcode lembar penerimaan alat kotor (<strong>AK-...</strong>):
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <BarcodeInput
                value={scanCode}
                onChange={setScanCode}
                onCommit={handleLookupBarcode}
                placeholder="mis. ST-031126-001 atau AK-031126-001"
              />
            </div>
            <Button
              onClick={() => handleLookupBarcode(scanCode)}
              disabled={searchingCode || !scanCode.trim()}
              size="sm"
              className="text-xs h-10 px-4 shrink-0"
            >
              {searchingCode ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              <span>Cari</span>
            </Button>
          </div>

          <p className="text-[11px] text-slate-500">
            💡 Sistem otomatis mencari data set steril, unit asal, dan rincian instrumen di dalamnya.
          </p>
        </div>
      )}
    </div>
  );
}

