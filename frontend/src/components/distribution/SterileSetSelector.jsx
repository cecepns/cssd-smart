import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
} from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { useAuth } from '@/context/AuthContext';
import { getList } from '@/utils/request';
import { formatDate } from '@/utils/format';
import BarcodeInput from '@/components/form/BarcodeInput';
import Button from '@/components/ui/Button';

/**
 * Komponen pemilih set steril untuk Distribusi / Pengambilan Alat Steril.
 * Sistem Otomatis 3 Jalur:
 * 1. Daftar Set Steril Otomatis (menampilkan semua set steril sesuai unit + rincian isi instrumen otomatis).
 * 2. Set Siap Hasil Verifikasi Steril (paket ber-barcode ST-... yang sudah lulus verifikasi).
 * 3. Scan Barcode (ST-... / AK-...).
 */
export default function SterileSetSelector({ values, setValue, setValues, gauze = false }) {
  const { user } = useAuth();
  const isUnit = user?.role === 'unit';
  const [mode, setMode] = useState('CATALOG'); // 'CATALOG' | 'READY' | 'SCAN'
  const [categoryFilter, setCategoryFilter] = useState('SET'); // 'SET' | 'SINGLE' | 'ALL'
  const [readyList, setReadyList] = useState([]);
  const [catalogList, setCatalogList] = useState([]);
  const [itemsMap, setItemsMap] = useState({});
  const [loadingReady, setLoadingReady] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState(() => (isUnit && user?.unit_id ? String(user.unit_id) : (values?.unit_id ? String(values.unit_id) : '')));
  const [units, setUnits] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [scanCode, setScanCode] = useState('');
  const [searchingCode, setSearchingCode] = useState(false);

  // Sinkronkan filter unit dengan dropdown "Unit tujuan / pengambil" di bawah
  useEffect(() => {
    if (!isUnit && values?.unit_id && String(values.unit_id) !== String(unitFilter)) {
      setUnitFilter(String(values.unit_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values?.unit_id, isUnit]);

  // Ambil daftar unit & master rincian isi set instrumen sekali saat mount
  useEffect(() => {
    let active = true;
    if (!isUnit) {
      getList(API_ENDPOINTS.LOOKUPS.UNITS, { is_active: 1, limit: 100, sort_by: 'name', order: 'asc' })
        .then((res) => { if (active && res.data) setUnits(res.data); })
        .catch(() => {});
    }
    getList(API_ENDPOINTS.LOOKUPS.SET_INSTRUMENTS)
      .then((res) => { if (active && res.data?.itemsMap) setItemsMap(res.data.itemsMap); })
      .catch(() => {});
    return () => { active = false; };
  }, [isUnit]);

  const effectiveUnitId = isUnit ? (user?.unit_id ? String(user.unit_id) : '') : unitFilter;

  // 1. Ambil daftar stok steril siap ambil (hasil lulus verifikasi)
  const fetchReadyStock = async () => {
    setLoadingReady(true);
    try {
      const res = await getList(API_ENDPOINTS.STERILE_STOCK.READY, {
        type: gauze ? 'KASA' : 'ALAT',
        unit_id: effectiveUnitId || undefined,
      });
      const list = res.data || [];
      setReadyList(list);
      // Jika ada set siap steril di hasil verifikasi dan user belum pindah mode, tetap informatif lewat badge jumlah
    } catch (err) {
      // Silent fallback ke katalog set
    } finally {
      setLoadingReady(false);
    }
  };

  // 2. Ambil daftar lengkap Set Instrumen & Alat Steril sesuai unit (sistem otomatis!)
  const fetchCatalogSets = async () => {
    if (gauze) return;
    setLoadingCatalog(true);
    try {
      const res = await getList(API_ENDPOINTS.LOOKUPS.ITEMS, {
        is_active: 1,
        process_type: 'Steril',
        unit_id: effectiveUnitId || undefined,
        sort_by: 'name',
        order: 'asc',
      });
      const list = (res.data || []).filter((it) => it.category !== 'Kasa Steril');
      setCatalogList(list);
    } catch (err) {
      toast.error('Gagal memuat daftar set steril');
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    fetchReadyStock();
    fetchCatalogSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUnitId, gauze]);

  // Helper cari rincian isi instrumen dari master itemsMap
  const resolveInstruments = (itemName, itemId = null) => {
    if (!itemName) return [];
    const norm = itemName.trim().toLowerCase();
    let found = (itemId && itemsMap[itemId]) || itemsMap[norm];
    if (!found) {
      const key = Object.keys(itemsMap).find((k) => norm.includes(k) || k.includes(norm));
      if (key) found = itemsMap[key];
    }
    return Array.isArray(found) ? found : [];
  };

  // Filter real-time berdasarkan pencarian teks
  const filteredReady = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return readyList;
    return readyList.filter(
      (s) =>
        (s.item_name || '').toLowerCase().includes(q) ||
        (s.barcode || '').toLowerCase().includes(q) ||
        (s.origin_unit_name || '').toLowerCase().includes(q) ||
        (s.receipt_barcode || '').toLowerCase().includes(q)
    );
  }, [readyList, search]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogList.filter((it) => {
      if (categoryFilter === 'SET') {
        const isSet = it.category === 'Set Instrumen' || it.category === 'Instrumen / Set Alat' || !it.category;
        if (!isSet) return false;
      } else if (categoryFilter === 'SINGLE') {
        const isSingle = it.category === 'Alat Satuan';
        if (!isSingle) return false;
      }
      if (!q) return true;
      return (
        (it.name || '').toLowerCase().includes(q) ||
        (it.code || '').toLowerCase().includes(q) ||
        (it.unit_name || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q)
      );
    });
  }, [catalogList, search, categoryFilter]);

  // Handler saat memilih dari stok hasil verifikasi (punya barcode ST-...)
  const handleSelectStock = (stock) => {
    if (!stock) return;
    const enrichedItems = stock.items?.length ? stock.items : resolveInstruments(stock.item_name);
    setSelectedStock({ ...stock, items: enrichedItems, source: 'READY' });

    const patch = {
      barcode: stock.barcode,
      item_name: stock.item_name,
      item_category: stock.category || 'Set Instrumen',
      unit_label: stock.unit_label || 'set',
      quantity: 1,
    };
    if (stock.origin_unit_id) patch.unit_id = String(stock.origin_unit_id);
    if (stock.origin_sender && !values.receiver_name) patch.receiver_name = stock.origin_sender;

    if (setValues) setValues(patch);
    else Object.entries(patch).forEach(([k, v]) => setValue(k, v));

    toast.success(`Set ${stock.item_name} dipilih`);
  };

  // Handler saat memilih dari Daftar Set Steril Otomatis (katalog unit)
  const handleSelectCatalogItem = (item) => {
    if (!item) return;

    // Cek otomatis apakah sudah ada paket steril 'Tersedia' untuk set ini di readyList
    const matchedReady = readyList.find(
      (r) =>
        (r.item_name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase() &&
        (!item.unit_id || !r.origin_unit_id || String(r.origin_unit_id) === String(item.unit_id))
    );
    if (matchedReady) {
      handleSelectStock(matchedReady);
      return;
    }

    const instList = resolveInstruments(item.name, item.id);
    setSelectedStock({
      id: `cat-${item.id}`,
      barcode: 'OTOMATIS (DS-...)',
      item_name: item.name,
      category: item.category || 'Set Instrumen',
      origin_unit_id: item.unit_id || effectiveUnitId || null,
      origin_unit_name: item.unit_name || (units.find((u) => String(u.id) === String(effectiveUnitId))?.name) || 'Instalasi CSSD',
      unit_label: item.unit_label || 'Set',
      completeness_status: 'Lengkap',
      items: instList,
      total_instruments: instList.reduce((acc, c) => acc + Number(c.quantity || 1), 0),
      source: 'CATALOG',
    });

    const patch = {
      barcode: '', // Kosongkan agar backend otomatis generate barcode DS-DDMMYY-XXX
      item_name: item.name,
      item_category: item.category || 'Set Instrumen',
      unit_label: item.unit_label || 'set',
      quantity: 1,
    };
    if (item.unit_id) patch.unit_id = String(item.unit_id);
    else if (effectiveUnitId) patch.unit_id = String(effectiveUnitId);

    if (setValues) setValues(patch);
    else Object.entries(patch).forEach(([k, v]) => setValue(k, v));

    toast.success(`Set "${item.name}" dipilih — barcode dibuat otomatis saat disimpan`);
  };

  // Lookup melalui scan barcode (ST-... / AK-...)
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
            ? 'Barcode ini adalah Kasa Steril, gunakan menu Pengambilan Kasa Steril'
            : 'Barcode ini adalah Alat Steril, gunakan menu Pengambilan Alat Steril'
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
    if (setValues) setValues({ barcode: '', item_name: '', item_category: '', unit_label: '' });
    else {
      setValue('barcode', '');
      setValue('item_name', '');
    }
  };

  // Preview Kartu Set Terpilih + Rincian Instrumen Otomatis
  if (selectedStock) {
    const isComplete = selectedStock.completeness_status !== 'Tidak Lengkap';
    const items = selectedStock.items || [];

    return (
      <div className="rounded-2xl border-2 border-brand-500/80 bg-brand-50/20 p-4 shadow-sm transition-all sm:p-5">
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

        <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
            <span className="text-slate-500 block font-medium">Unit Tujuan / Pemilik:</span>
            <span className="text-slate-900 font-bold mt-0.5 block">
              {selectedStock.origin_unit_name || 'Instalasi CSSD'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
            <span className="text-slate-500 block font-medium">Sumber Stok:</span>
            <span className="text-slate-900 font-bold mt-0.5 block">
              {selectedStock.receipt_barcode
                ? `Sterilisasi (${selectedStock.receipt_barcode})`
                : 'Stok Rak Steril CSSD (Otomatis)'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
            <span className="text-slate-500 block font-medium">Batch & Kedaluwarsa:</span>
            <span className="text-slate-900 font-bold mt-0.5 block">
              {selectedStock.batch_no
                ? `Batch: ${selectedStock.batch_no} • Exp: ${formatDate(selectedStock.expiry_date)}`
                : 'Otomatis (+6 bulan masa steril)'}
            </span>
          </div>
        </div>

        {/* Rincian Isi Set Instrumen Otomatis */}
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
              Alat satuan / belum ada rincian item di master set ini.
            </p>
          ) : (
            <div className="mt-2.5 max-h-44 divide-y divide-slate-100 overflow-y-auto pr-1">
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

          {items.length > 0 && (
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs font-bold text-slate-900">
              <span>Total Standar Instrumen:</span>
              <span className="text-brand-700">
                {selectedStock.total_instruments || items.reduce((acc, c) => acc + Number(c.quantity || 1), 0)} Buah
              </span>
            </div>
          )}

          {!isComplete && selectedStock.missing_notes && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
              ⚠️ <strong>Catatan Alat Kurang/Hilang:</strong> {selectedStock.missing_notes}
            </div>
          )}
        </div>

        <p className="mt-2.5 text-[11px] font-medium text-emerald-800 flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
          {selectedStock.source === 'CATALOG'
            ? 'Set & unit tujuan sudah otomatis terisi. Kode barcode (DS-...) akan digenerate otomatis saat klik Simpan.'
            : 'Unit tujuan dan barcode telah terisi otomatis sesuai tanda terima alat kotor.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4 space-y-3">
      {/* Tab Switcher Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-slate-200 pb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Metode Pemilihan Alat Steril
        </span>

        <div className="grid grid-cols-3 sm:inline-flex rounded-xl bg-slate-200/80 p-1 text-xs font-bold w-full sm:w-auto gap-1">
          <button
            type="button"
            onClick={() => setMode('CATALOG')}
            className={`inline-flex items-center justify-center gap-1 rounded-lg px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              mode === 'CATALOG'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles size={13} className="shrink-0" />
            <span>Daftar Set</span>
            {catalogList.length > 0 && (
              <span className="rounded-full bg-brand-100 text-brand-800 px-1.5 py-0.2 text-[10px] font-black shrink-0">
                {catalogList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMode('READY')}
            className={`inline-flex items-center justify-center gap-1 rounded-lg px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              mode === 'READY'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={13} className="shrink-0" />
            <span>Siap Steril</span>
            {readyList.length > 0 && (
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[10px] font-black shrink-0">
                {readyList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMode('SCAN')}
            className={`inline-flex items-center justify-center gap-1 rounded-lg px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              mode === 'SCAN'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ScanLine size={13} className="shrink-0" />
            <span>Scan</span>
          </button>
        </div>
      </div>

      {/* MODE 1: DAFTAR SET STERIL OTOMATIS (SEMUA SET MILIK UNIT) */}
      {mode === 'CATALOG' && (
        <div className="space-y-2.5">
          <div className={`grid grid-cols-1 gap-2 ${isUnit ? '' : 'sm:grid-cols-2'}`}>
            {!isUnit && (
              <select
                value={unitFilter}
                onChange={(e) => {
                  setUnitFilter(e.target.value);
                  if (e.target.value) setValue('unit_id', e.target.value);
                }}
                className="input-base text-xs font-medium py-1.5"
              >
                <option value="">Semua Unit (Tampilkan Semua Set)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama set / alat steril (mis. Curetage, Minor, SC)..."
                className="input-base pl-8 text-xs font-medium py-1.5"
              />
            </div>
          </div>

          {/* Tombol Pilihan Jenis Pengambilan: Set Alat Instrumen & Alat Satuan */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Pilihan Jenis:</span>
            <button
              type="button"
              onClick={() => setCategoryFilter('SET')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-xs ${
                categoryFilter === 'SET'
                  ? 'bg-brand-700 text-white shadow-sm ring-1 ring-brand-700'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              1. Set Alat Instrumen
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('SINGLE')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-xs ${
                categoryFilter === 'SINGLE'
                  ? 'bg-brand-700 text-white shadow-sm ring-1 ring-brand-700'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              2. Alat Satuan
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                categoryFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua ({catalogList.length})
            </button>
          </div>

          <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {loadingCatalog ? (
              <div className="flex items-center justify-center p-6 text-xs text-slate-500 gap-2">
                <RefreshCw size={14} className="animate-spin text-brand-600" />
                <span>Memuat daftar set steril...</span>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                <p className="font-semibold text-slate-700">Tidak ditemukan set steril yang cocok.</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Coba ubah kata kunci pencarian atau pilih "Semua Unit".
                </p>
              </div>
            ) : (
              filteredCatalog.map((item) => {
                const instCount = resolveInstruments(item.name, item.id).length;
                const hasReady = readyList.some(
                  (r) => (r.item_name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase()
                );

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectCatalogItem(item)}
                    className="group flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-brand-50/50"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.code && (
                          <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.code}
                          </span>
                        )}
                        <span className="rounded bg-blue-50 text-blue-800 px-1.5 py-0.5 text-[10px] font-bold">
                          {item.category || 'Set Instrumen'}
                        </span>
                        {hasReady ? (
                          <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-extrabold">
                            ✓ Lulus Steril Siap Ambil
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px] font-semibold">
                            Otomatis Barcode DS
                          </span>
                        )}
                      </div>

                      <h4 className="mt-1 text-sm font-black text-slate-900 uppercase truncate">
                        {item.name}
                      </h4>

                      <p className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>Unit: <strong>{item.unit_name || 'Umum / CSSD'}</strong></span>
                        {instCount > 0 && <span>• Isi: <strong>{instCount} macam instrumen</strong></span>}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCatalogItem(item);
                      }}
                      className="shrink-0 text-xs py-1 h-7"
                    >
                      Pilih Set
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODE 2: SET SIAP HASIL VERIFIKASI STERIL */}
      {mode === 'READY' && (
        <div className="space-y-2.5">
          <div className={`grid grid-cols-1 gap-2 ${isUnit ? '' : 'sm:grid-cols-2'}`}>
            {!isUnit && (
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
            )}

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama set / barcode ST-..."
                className="input-base pl-8 text-xs font-medium py-1.5"
              />
            </div>
          </div>

          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {loadingReady ? (
              <div className="flex items-center justify-center p-6 text-xs text-slate-500 gap-2">
                <RefreshCw size={14} className="animate-spin text-brand-600" />
                <span>Memuat daftar set steril siap ambil...</span>
              </div>
            ) : filteredReady.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <p className="font-semibold text-slate-700">Belum ada paket hasil verifikasi sterilisasi yang menunggu diambil.</p>
                <button
                  type="button"
                  onClick={() => setMode('CATALOG')}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-800"
                >
                  <Sparkles size={12} /> Pilih dari Daftar Set Otomatis
                </button>
              </div>
            ) : (
              filteredReady.map((stk) => (
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

      {/* MODE 3: SCAN BARCODE */}
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
