import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Minus,
  Package,
  Plus,
  QrCode,
  RotateCcw,
  ScanLine,
  Trash2,
  Wrench,
} from 'lucide-react';
import useFetch from '@/hooks/useFetch';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { useAuth } from '@/context/AuthContext';
import { getList } from '@/utils/request';

/**
 * Komponen Pemilih Multi-Set & Alat Satuan untuk Pengambilan / Distribusi Alat Steril.
 * Dibuat identik dengan alur input Terima Alat Kotor:
 * 1. Bagian A: Daftar Set Instrumen (dengan tombol "+ Tambah Set" untuk memilih beberapa jenis set berbeda).
 * 2. Bagian B: Alat Satuan Tambahan di Luar Set (dengan tombol "+ Tambah Alat Satuan").
 * 3. Rincian instrumen otomatis muncul mengikuti Master Data setiap set.
 * 4. Input beberapa alat sekaligus dan simpan cukup 1 kali dengan 1 barcode transaksi resmi (DS-...).
 */
export default function SterileSetSelector({ values, setValue, setValues, disabled }) {
  const { user } = useAuth();
  const unitId = values?.unit_id;
  const prevUnitIdRef = useRef(unitId);
  const [expandedSets, setExpandedSets] = useState({ 0: true });
  const [showScanBar, setShowScanBar] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [searchingScan, setSearchingScan] = useState(false);

  // Pastikan unit_id selalu terisi jika user role adalah 'unit'
  useEffect(() => {
    if (user?.role === 'unit' && !values?.unit_id) {
      const uname = String(user.username || '').toLowerCase();
      const targetId = user.unit_id ? String(user.unit_id) : (uname.includes('vk') || uname.includes('bersalin') ? '4' : '1');
      if (setValues) setValues({ unit_id: targetId });
      else if (setValue) setValue('unit_id', targetId);
    }
  }, [user, values?.unit_id, setValue, setValues]);

  // 1. Ambil daftar master set & alat milik unit tujuan
  const { data: itemsData, loading: loadingItems } = useFetch(
    API_ENDPOINTS.LOOKUPS.ITEMS,
    { unit_id: unitId, is_active: 1, sort_by: 'name', order: 'asc' },
    { enabled: Boolean(unitId) }
  );
  // Fallback seluruh item standar RSUD jika unit belum punya master data khusus
  const { data: allItemsData } = useFetch(
    API_ENDPOINTS.LOOKUPS.ITEMS,
    { is_active: 1, sort_by: 'name', order: 'asc' },
    { enabled: Boolean(unitId && itemsData && itemsData.length === 0) }
  );
  const unitItems = (itemsData && itemsData.length > 0) ? itemsData : (allItemsData || []);

  // 2. Ambil master rincian instrumen per set
  const { data: setInstrumentsData } = useFetch(API_ENDPOINTS.LOOKUPS.SET_INSTRUMENTS);
  const itemsMap = setInstrumentsData?.itemsMap || {};

  // 3. Nama unit tujuan
  const { data: unitsData } = useFetch(API_ENDPOINTS.LOOKUPS.UNITS, { limit: 100 });
  const selectedUnit = (unitsData || []).find((u) => String(u.id) === String(unitId));
  const unitName = values?.unit_name || selectedUnit?.name || 'Unit';

  // Helper untuk mengambil rincian instrumen otomatis dari master data
  const getInitialInstruments = (setName, itemId = null) => {
    if (!setName || !setName.trim()) return [];
    const normalized = setName.trim().toLowerCase();

    // 1. Cari exact match di itemsMap
    let found = (itemId && itemsMap[itemId]) || itemsMap[normalized];
    if (!found) {
      // 2. Cari partial match nama set
      const key = Object.keys(itemsMap).find(
        (k) => normalized.includes(k) || k.includes(normalized)
      );
      if (key) found = itemsMap[key];
    }

    if (found && Array.isArray(found) && found.length > 0) {
      return found.map((item) => ({
        instrument_name: item.instrument_name,
        quantity: item.quantity || 1,
        unit_label: item.unit_label || 'Buah',
        status: 'Lengkap',
        notes: '',
      }));
    }

    // 3. Fallback cerdas sesuai standar medis RSUD
    if (normalized.includes('minor')) {
      return [
        { instrument_name: 'Gunting jaringan', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Pinset anatomis', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Pinset chirurgis', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Needle holder', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Klem mosquito', quantity: 4, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Bengkok', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Bak instrumen', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
      ];
    }
    if (normalized.includes('laparotomi') || normalized.includes('mayor')) {
      return [
        { instrument_name: 'Pinset anatomis', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Pinset sirurgis', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Gunting Mayo', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Klem Pean', quantity: 6, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Needle holder', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Klem Kocher', quantity: 4, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Retraktor Abdomen', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
      ];
    }
    if (normalized.includes('sc') || normalized.includes('caesarea') || normalized.includes('sesar')) {
      return [
        { instrument_name: 'Pinset sirurgis', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Pinset anatomis', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Gunting Metzenbaum', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Gunting Mayo', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Klem Kocher', quantity: 4, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Klem Pean', quantity: 4, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Needle holder', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Retraktor Abdomen', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
      ];
    }
    if (normalized.includes('partus') || normalized.includes('vk')) {
      return [
        { instrument_name: 'Gunting episiotomi', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Gunting tali pusat', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Klem tali pusat', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Pinset anatomis', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Needle holder', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
      ];
    }

    return [];
  };

  // State Daftar Set Terpilih
  const [items, setItems] = useState(() => {
    if (values?.items_detail) {
      try {
        const parsed = typeof values.items_detail === 'string' ? JSON.parse(values.items_detail) : values.items_detail;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    if (Array.isArray(values?.items) && values.items.length > 0) return values.items;
    if (values?.item_name) {
      return [{ item_name: values.item_name, quantity: values.quantity || 1, unit_label: values.unit_label || 'Set', checklist: [] }];
    }
    return [{ item_name: '', quantity: 1, unit_label: 'Set', checklist: [], isCustom: false }];
  });

  // State Daftar Alat Satuan Tambahan Terpilih
  const [extraItems, setExtraItems] = useState(() => {
    if (values?.extra_items) {
      try {
        const parsed = typeof values.extra_items === 'string' ? JSON.parse(values.extra_items) : values.extra_items;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    if (Array.isArray(values?.extra_items) && values.extra_items.length > 0) return values.extra_items;
    return [];
  });

  // Sinkronisasi data ke parent form state
  const syncParent = (newSets, newExtra = extraItems) => {
    setItems(newSets);
    setExtraItems(newExtra);

    const validSets = newSets.filter((it) => it.item_name && it.item_name.trim());
    const validExtra = newExtra.filter((it) => it.item_name && it.item_name.trim());

    // Susun ringkasan nama alat untuk form utama
    const parts = [
      ...validSets.map((it) => `${it.item_name} (${it.quantity || 1} ${it.unit_label || 'Set'})`),
      ...validExtra.map((it) => `${it.item_name} (${it.quantity || 1} ${it.unit_label || 'Buah'})`),
    ];

    const totalQty =
      validSets.reduce((acc, curr) => acc + Number(curr.quantity || 1), 0) +
      validExtra.reduce((acc, curr) => acc + Number(curr.quantity || 1), 0);

    const patch = {
      items: newSets,
      extra_items: validExtra.length > 0 ? JSON.stringify(validExtra) : '',
      items_detail: validSets.length > 0 ? JSON.stringify(validSets) : '',
      item_name: parts.join(', ') || '',
      quantity: totalQty || 1,
      unit_label: validSets.length > 0 ? validSets[0].unit_label || 'Set' : 'Buah',
      item_category: validSets.length > 0 ? 'Set Instrumen' : 'Alat Satuan',
      item_id: validSets[0]?.item_id || null,
    };

    if (setValues) setValues(patch);
    else Object.entries(patch).forEach(([k, v]) => setValue(k, v));
  };

  // Muat rincian instrumen otomatis saat itemsMap selesai dimuat jika checklist masih kosong
  useEffect(() => {
    if (Object.keys(itemsMap).length > 0) {
      let changed = false;
      const updated = items.map((it) => {
        if (it.item_name && (!it.checklist || it.checklist.length === 0)) {
          const chk = getInitialInstruments(it.item_name, it.item_id);
          if (chk.length > 0) {
            changed = true;
            return { ...it, checklist: chk };
          }
        }
        return it;
      });
      if (changed) {
        syncParent(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsMap]);

  // Tambah baris Set baru tersendiri (bebas pilih jenis set yang berbeda di tiap dropdown)
  const handleAddSet = () => {
    const next = [
      ...items,
      { item_id: null, item_name: '', quantity: 1, unit_label: 'Set', checklist: [], isCustom: false },
    ];
    syncParent(next);
    setExpandedSets((prev) => ({ ...prev, [next.length - 1]: true }));
    toast.success('Baris Set instrumen baru ditambahkan');
  };

  // Pilih set dari dropdown milik baris set tertentu
  const handleSelectSetOption = (setIdx, rawVal) => {
    const next = [...items];
    if (rawVal === '__CUSTOM__') {
      next[setIdx] = {
        ...next[setIdx],
        item_id: null,
        item_name: '',
        isCustom: true,
        checklist: [],
      };
      syncParent(next);
      return;
    }
    if (!rawVal) {
      next[setIdx] = {
        ...next[setIdx],
        item_id: null,
        item_name: '',
        isCustom: false,
        checklist: [],
      };
      syncParent(next);
      return;
    }
    const match = unitItems.find((u) => String(u.id) === String(rawVal));
    if (match) {
      next[setIdx] = {
        ...next[setIdx],
        item_id: match.id,
        item_name: match.name,
        unit_label: match.unit_label || 'Set',
        isCustom: false,
        checklist: getInitialInstruments(match.name, match.id),
      };
      syncParent(next);
      setExpandedSets((prev) => ({ ...prev, [setIdx]: true }));
    }
  };

  const handleUpdateSetName = (setIdx, name, itemObj = null) => {
    const next = [...items];
    const prevName = next[setIdx].item_name;
    next[setIdx].item_name = name;

    if (itemObj) {
      next[setIdx].item_id = itemObj.id;
      next[setIdx].unit_label = itemObj.unit_label || next[setIdx].unit_label || 'Set';
    }

    if (name.trim() !== prevName?.trim()) {
      next[setIdx].checklist = getInitialInstruments(name, itemObj?.id || next[setIdx].item_id);
    }

    syncParent(next);
    setExpandedSets((prev) => ({ ...prev, [setIdx]: true }));
  };

  const handleUpdateSetQty = (setIdx, delta) => {
    const next = [...items];
    const cur = Number(next[setIdx].quantity || 1);
    const newQty = Math.max(1, cur + delta);
    next[setIdx].quantity = newQty;
    syncParent(next);
  };

  const handleRemoveSet = (setIdx) => {
    const next = items.filter((_, i) => i !== setIdx);
    syncParent(next.length === 0 ? [{ item_name: '', quantity: 1, unit_label: 'Set', checklist: [] }] : next);
    toast.success('Set instrumen dihapus');
  };

  // Section B: Alat Satuan Tambahan
  const handleAddExtraItem = () => {
    const next = [...extraItems, { item_name: '', quantity: 1, unit_label: 'Buah' }];
    syncParent(items, next);
    toast.success('Baris alat satuan ditambahkan');
  };

  const handleUpdateExtraName = (idx, name) => {
    const next = [...extraItems];
    next[idx].item_name = name;
    syncParent(items, next);
  };

  const handleUpdateExtraQty = (idx, delta) => {
    const next = [...extraItems];
    const cur = Number(next[idx].quantity || 1);
    next[idx].quantity = Math.max(1, cur + delta);
    syncParent(items, next);
  };

  const handleRemoveExtra = (idx) => {
    const next = extraItems.filter((_, i) => i !== idx);
    syncParent(items, next);
    toast.success('Alat satuan dihapus');
  };

  // Reset daftar set saat Unit Tujuan berganti agar pilihan set sesuai unit baru
  useEffect(() => {
    if (prevUnitIdRef.current && String(prevUnitIdRef.current) !== String(unitId || '')) {
      syncParent([{ item_id: null, item_name: '', quantity: 1, unit_label: 'Set', checklist: [], isCustom: false }], []);
      setExpandedSets({ 0: true });
    }
    prevUnitIdRef.current = unitId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  // Saran nama alat satuan dari Master Data
  const singleToolSuggestions = unitItems.filter((i) => i.category === 'Alat Satuan');

  // Hitung total set dan total kuantitas
  const filledSetsCount = items.filter((i) => i.item_name && i.item_name.trim()).length;
  const totalSetQty = items
    .filter((i) => i.item_name && i.item_name.trim())
    .reduce((acc, it) => acc + Number(it.quantity || 1), 0);
  const totalExtraQty = extraItems
    .filter((e) => e.item_name && e.item_name.trim())
    .reduce((acc, it) => acc + Number(it.quantity || 1), 0);
  const totalAllItems = totalSetQty + totalExtraQty;

  // Fitur Scan Barcode Cepat (Opsional)
  const handleScanBarcode = async (e) => {
    e.preventDefault();
    const clean = scanInput.trim();
    if (!clean) return;
    setSearchingScan(true);
    try {
      const res = await getList(API_ENDPOINTS.STERILE_STOCK.LOOKUP, { code: clean });
      const stock = res.data;
      if (!stock) {
        toast.error(`Barcode ${clean} tidak ditemukan di stok steril`);
        return;
      }
      if (stock.category === 'Alat Satuan') {
        const nextExtra = [...extraItems, { item_name: stock.item_name, quantity: stock.quantity || 1, unit_label: stock.unit_label || 'Buah' }];
        syncParent(items, nextExtra);
        toast.success(`Alat satuan "${stock.item_name}" berhasil ditambahkan dari scan!`);
      } else {
        const nextSets = [
          ...items.filter((it) => it.item_name),
          {
            item_id: stock.origin_item_id || null,
            item_name: stock.item_name,
            quantity: stock.quantity || 1,
            unit_label: stock.unit_label || 'Set',
            checklist: getInitialInstruments(stock.item_name),
            isCustom: false,
          },
        ];
        syncParent(nextSets);
        setExpandedSets((prev) => ({ ...prev, [nextSets.length - 1]: true }));
        toast.success(`Set "${stock.item_name}" berhasil ditambahkan dari scan!`);
      }
      setScanInput('');
    } catch (err) {
      toast.error(err?.message || `Barcode ${clean} tidak ditemukan`);
    } finally {
      setSearchingScan(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tombol bantu buka scan barcode jika diperlukan */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Boxes size={16} className="text-brand-700" />
          <span>Pengambilan Set Instrumen & Alat Satuan Steril</span>
        </div>
        <button
          type="button"
          onClick={() => setShowScanBar((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900 transition"
        >
          <ScanLine size={13} />
          <span>{showScanBar ? 'Tutup Scan Barcode' : 'Scan Barcode Paket?'}</span>
        </button>
      </div>

      {showScanBar && (
        <form onSubmit={handleScanBarcode} className="flex gap-2 rounded-xl border border-brand-200 bg-brand-50/50 p-2.5">
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Scan barcode paket steril (ST-... / AS-...) lalu tekan Enter..."
            className="flex-1 rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-mono focus:border-brand-600 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={searchingScan || !scanInput.trim()}
            className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {searchingScan ? 'Mencari...' : 'Tambah dari Barcode'}
          </button>
        </form>
      )}

      {/* ============================================================== */}
      {/* A. DAFTAR SET INSTRUMEN (MULTI-SET BERBEDA DALAM 1 TRANSAKSI)  */}
      {/* ============================================================== */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-900">
              A. Daftar Set Instrumen (Unit: {unitId ? unitName : 'Pilih Unit Tujuan dahulu'})
            </span>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">
              {filledSetsCount} Jenis Set • {totalSetQty} Total Set
            </span>
          </div>
          <button
            type="button"
            disabled={disabled || !unitId}
            onClick={handleAddSet}
            className="flex items-center gap-1.5 rounded-xl bg-[#002D85] hover:bg-brand-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Plus size={14} /> Tambah Set
          </button>
        </div>

        {!unitId && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs font-medium text-amber-800">
            Pilih <b>Unit tujuan / pengambil</b> terlebih dahulu di atas agar daftar set instrumen milik unit tersebut muncul di setiap dropdown.
          </div>
        )}

        {/* Container Kartu Set */}
        <div className="space-y-3">
          {items.map((item, setIdx) => {
            const checklist = item.checklist || [];
            const isExpanded = expandedSets[setIdx] ?? true;

            const matchedOption = unitItems.find(
              (u) =>
                (item.item_id && String(u.id) === String(item.item_id)) ||
                (item.item_name && u.name.toLowerCase() === item.item_name.trim().toLowerCase())
            );
            const isCustomMode = item.isCustom || (Boolean(item.item_name) && !matchedOption && unitItems.length > 0);

            return (
              <div
                key={setIdx}
                className="rounded-2xl border border-sky-200/80 bg-[#F4F7FC] p-3 sm:p-4 shadow-sm space-y-3 transition"
              >
                {/* Baris Dropdown Pilih Nama Set & Stepper Jumlah */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-brand-800 uppercase tracking-wider">
                        Set Instrumen #{setIdx + 1} <span className="text-rose-500">*</span>
                      </label>
                      {isCustomMode && (
                        <button
                          type="button"
                          onClick={() => handleSelectSetOption(setIdx, '')}
                          className="text-[10px] font-semibold text-brand-700 hover:underline"
                        >
                          ← Kembali ke Dropdown
                        </button>
                      )}
                    </div>

                    {!isCustomMode ? (
                      <select
                        value={matchedOption ? String(matchedOption.id) : ''}
                        disabled={disabled || !unitId || loadingItems}
                        onChange={(e) => handleSelectSetOption(setIdx, e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none"
                        required
                      >
                        <option value="">
                          {!unitId
                            ? 'Pilih Unit Tujuan dahulu...'
                            : loadingItems
                            ? 'Memuat daftar set unit...'
                            : `-- Pilih Jenis Set Instrumen #${setIdx + 1} --`}
                        </option>
                        {unitItems.map((u) => {
                          const usedAtIdx = items.findIndex(
                            (other, idx) =>
                              idx !== setIdx &&
                              ((other.item_id && String(other.item_id) === String(u.id)) ||
                                (other.item_name && other.item_name.toLowerCase() === u.name.toLowerCase()))
                          );
                          return (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.category || u.unit_label || 'Set'})
                              {usedAtIdx >= 0 ? ` — [Sudah di Set #${usedAtIdx + 1}]` : ''}
                            </option>
                          );
                        })}
                        <option value="__CUSTOM__">✏️ Ketik nama set / alat manual...</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={item.item_name}
                        disabled={disabled}
                        placeholder="Ketik Nama Set Instrumen (misal: SET MINOR)..."
                        onChange={(e) => {
                          const val = e.target.value;
                          const match = unitItems.find((u) => u.name.toLowerCase() === val.toLowerCase());
                          handleUpdateSetName(setIdx, val, match);
                        }}
                        className="w-full rounded-xl border border-brand-400 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none"
                        required
                      />
                    )}
                  </div>

                  {/* Stepper Jumlah Set */}
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-[10px] font-medium text-slate-500 mb-1 leading-none">Jumlah</span>
                    <div className="flex items-center rounded-xl border border-slate-300 bg-white px-1 py-0.5 shadow-sm">
                      <button
                        type="button"
                        disabled={disabled || item.quantity <= 1}
                        onClick={() => handleUpdateSetQty(setIdx, -1)}
                        className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-9 text-center text-xs font-bold text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleUpdateSetQty(setIdx, 1)}
                        className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Tombol Hapus Baris Set */}
                  {items.length > 1 && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemoveSet(setIdx)}
                      title="Hapus set ini"
                      className="rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 p-2 text-rose-600 transition shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Bar Info Rincian Instrumen & Tombol Accordion */}
                {item.item_name && (
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setExpandedSets((prev) => ({ ...prev, [setIdx]: !isExpanded }))}
                        className="flex items-center gap-1.5 text-xs font-bold text-brand-900 hover:text-brand-700 transition"
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        <span>Rincian Isi Instrumen ({checklist.length} macam)</span>
                      </button>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <Check size={11} /> Siap Pakai & Steril
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        {checklist.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                            {checklist.map((inst, instIdx) => (
                              <div
                                key={instIdx}
                                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs"
                              >
                                <span className="font-medium text-slate-800 truncate" title={inst.instrument_name}>
                                  {instIdx + 1}. {inst.instrument_name}
                                </span>
                                <span className="shrink-0 font-bold text-slate-600 text-[11px] ml-2">
                                  {inst.quantity || 1} {inst.unit_label || 'Buah'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic py-1">
                            Rincian instrumen standar belum terdaftar di Master Data, paket set tetap dapat diserahterimakan.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* B. ALAT SATUAN TAMBAHAN DI LUAR SET                            */}
      {/* ============================================================== */}
      <div className="space-y-2.5 border-t border-slate-200 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-900">
              B. Alat Satuan Tambahan di Luar Set (Opsional)
            </span>
            {extraItems.length > 0 && (
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-800">
                {extraItems.length} Macam • {totalExtraQty} Buah
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={handleAddExtraItem}
            className="flex items-center gap-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Plus size={14} /> Tambah Alat Satuan
          </button>
        </div>

        {extraItems.length > 0 && (
          <div className="space-y-2">
            {extraItems.map((extra, eIdx) => (
              <div
                key={eIdx}
                className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/40 p-2.5 shadow-xs"
              >
                <div className="flex-1">
                  <input
                    type="text"
                    list={`extra-tool-list-${eIdx}`}
                    value={extra.item_name}
                    disabled={disabled}
                    onChange={(e) => handleUpdateExtraName(eIdx, e.target.value)}
                    placeholder="Nama alat satuan (misal: Gunting Angkat Jahitan, Bengkok, Tromol)..."
                    className="w-full rounded-xl border border-purple-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm focus:border-purple-600 focus:outline-none"
                    required
                  />
                  <datalist id={`extra-tool-list-${eIdx}`}>
                    {singleToolSuggestions.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center rounded-xl border border-purple-300 bg-white px-1 py-0.5 shadow-sm">
                    <button
                      type="button"
                      disabled={disabled || extra.quantity <= 1}
                      onClick={() => handleUpdateExtraQty(eIdx, -1)}
                      className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-slate-900">
                      {extra.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleUpdateExtraQty(eIdx, 1)}
                      className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 transition"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <span className="text-xs font-medium text-slate-600">
                    {extra.unit_label || 'Buah'}
                  </span>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemoveExtra(eIdx)}
                    title="Hapus alat satuan ini"
                    className="rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 p-1.5 text-rose-600 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ringkasan Keseluruhan Pengambilan */}
      <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-brand-900">
          Total Alat yang Diambil:
        </span>
        <span className="font-black text-brand-950 text-sm">
          {totalAllItems} Item ({filledSetsCount} Set • {totalExtraQty} Satuan)
        </span>
      </div>
    </div>
  );
}
