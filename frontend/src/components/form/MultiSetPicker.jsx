import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
  Plus,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import useFetch from '@/hooks/useFetch';
import { API_ENDPOINTS } from '@/utils/endpoints';

export default function MultiSetPicker({ value, values, setValue, setValues, disabled }) {
  const unitId = values?.unit_id;
  const [selectedDropdownId, setSelectedDropdownId] = useState('');
  const [expandedSets, setExpandedSets] = useState({});

  // 1. Fetch item/set sesuai unit asal
  const { data: itemsData, loading } = useFetch(
    API_ENDPOINTS.LOOKUPS.ITEMS,
    { unit_id: unitId, is_active: 1, sort_by: 'name', order: 'asc' },
    { enabled: Boolean(unitId) }
  );
  const unitItems = itemsData || [];

  // Master lookup rincian instrumen per set
  const { data: setInstrumentsData } = useFetch(API_ENDPOINTS.LOOKUPS.SET_INSTRUMENTS);
  const itemsMap = setInstrumentsData?.itemsMap || {};

  // Find unit name
  const { data: unitsData } = useFetch(API_ENDPOINTS.LOOKUPS.UNITS, { limit: 100 });
  const selectedUnit = (unitsData || []).find((u) => String(u.id) === String(unitId));
  const unitName = values?.unit_name || selectedUnit?.name || 'Unit';

  // Helper untuk mengambil rincian instrumen otomatis
  const getInitialChecklist = (setName, itemId = null) => {
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

    // 3. Fallback cerdas sesuai standar medis CSSD RSUD
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
        { instrument_name: 'Ring forceps / Klem kassa', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
      ];
    }
    if (normalized.includes('partus') || normalized.includes('vk')) {
      return [
        { instrument_name: 'Gunting episiotomi', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Gunting tali pusat', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Klem tali pusat', quantity: 2, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Pinset anatomis', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Needle holder', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Catheter nelaton', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
        { instrument_name: 'Setengah kocher', quantity: 1, unit_label: 'Buah', status: 'Lengkap', notes: '' },
      ];
    }

    return [];
  };

  // State Daftar Set
  const [items, setItems] = useState(() => {
    if (Array.isArray(value) && value.length > 0) return value;
    if (values?.item_name) {
      return [
        {
          item_name: values.item_name,
          quantity: values.quantity || 1,
          unit_label: values.unit_label || 'Set',
          checklist: values.checklist || [],
        },
      ];
    }
    return [{ item_name: '', quantity: 1, unit_label: 'Set', checklist: [] }];
  });

  // State B: Alat Satuan Tambahan di Luar Set
  const [extraItems, setExtraItems] = useState(() => {
    if (Array.isArray(values?.extra_items) && values.extra_items.length > 0) {
      return values.extra_items;
    }
    return [];
  });

  // Sinkronisasi data ke parent form state
  const syncParent = (newSets, newExtra = extraItems) => {
    setItems(newSets);
    setExtraItems(newExtra);
    setValue('items', newSets);
    setValue('extra_items', newExtra);

    const validSets = newSets.filter((it) => it.item_name && it.item_name.trim());
    const validExtra = newExtra.filter((it) => it.item_name && it.item_name.trim());

    // Susun ringkasan nama alat untuk form utama
    const parts = [
      ...validSets.map((it) => `${it.item_name} (${it.quantity} ${it.unit_label || 'Set'})`),
      ...validExtra.map((it) => `${it.item_name} (${it.quantity} ${it.unit_label || 'Buah'})`),
    ];

    const totalQty =
      validSets.reduce((acc, curr) => acc + Number(curr.quantity || 1), 0) +
      validExtra.reduce((acc, curr) => acc + Number(curr.quantity || 1), 0);

    if (parts.length > 0) {
      setValue('item_name', parts.join(', '));
      setValue('quantity', totalQty || 1);
      setValue('unit_label', validSets.length > 0 ? validSets[0].unit_label || 'Set' : 'Buah');
      setValue('item_id', validSets[0]?.item_id || null);
    }
  };

  // Update instrumen otomatis saat itemsMap selesai dimuat jika checklist masih kosong
  useEffect(() => {
    if (Object.keys(itemsMap).length > 0) {
      let changed = false;
      const updated = items.map((it) => {
        if (it.item_name && (!it.checklist || it.checklist.length === 0)) {
          const chk = getInitialChecklist(it.item_name, it.item_id);
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

  // Tambah Set dari dropdown atau baris baru
  const handleAddSet = () => {
    if (selectedDropdownId) {
      const match = unitItems.find((it) => String(it.id) === String(selectedDropdownId));
      if (match) {
        const existingIdx = items.findIndex((it) => it.item_id === match.id || it.item_name === match.name);
        if (existingIdx >= 0) {
          const next = [...items];
          next[existingIdx].quantity += 1;
          syncParent(next);
          return;
        }

        const checklist = getInitialChecklist(match.name, match.id);
        const next = [
          ...items,
          {
            item_id: match.id,
            item_name: match.name,
            quantity: 1,
            unit_label: match.unit_label || 'Set',
            checklist,
          },
        ];
        const filtered = next.filter((it) => it.item_name.trim() !== '' || next.length === 1);
        syncParent(filtered);
        setExpandedSets((prev) => ({ ...prev, [filtered.length - 1]: true }));
        return;
      }
    }

    const next = [...items, { item_name: '', quantity: 1, unit_label: 'Set', checklist: [] }];
    syncParent(next);
    setExpandedSets((prev) => ({ ...prev, [next.length - 1]: true }));
  };

  const handleUpdateSetName = (setIdx, name, itemObj = null) => {
    const next = [...items];
    const prevName = next[setIdx].item_name;
    next[setIdx].item_name = name;

    if (itemObj) {
      next[setIdx].item_id = itemObj.id;
      next[setIdx].unit_label = itemObj.unit_label || next[setIdx].unit_label || 'Set';
    }

    // Jika nama set berubah, muat ulang checklist instrumen otomatis
    if (name.trim() !== prevName?.trim()) {
      next[setIdx].checklist = getInitialChecklist(name, itemObj?.id || next[setIdx].item_id);
    }

    syncParent(next);
    setExpandedSets((prev) => ({ ...prev, [setIdx]: true }));
  };

  const handleUpdateSetQty = (setIdx, newQty) => {
    const next = [...items];
    next[setIdx].quantity = Math.max(1, newQty);
    syncParent(next);
  };

  const handleRemoveSet = (setIdx) => {
    const next = items.filter((_, i) => i !== setIdx);
    syncParent(next.length === 0 ? [{ item_name: '', quantity: 1, unit_label: 'Set', checklist: [] }] : next);
  };

  // Checklist Actions
  const handleUpdateInstrumentStatus = (setIdx, instIdx, status) => {
    const next = [...items];
    const checklist = [...(next[setIdx].checklist || [])];
    checklist[instIdx] = {
      ...checklist[instIdx],
      status,
      // Jika kembali ke 'Lengkap', kosongkan catatan
      notes: status === 'Lengkap' ? '' : checklist[instIdx].notes || '',
    };
    next[setIdx].checklist = checklist;
    syncParent(next);
  };

  const handleUpdateInstrumentNote = (setIdx, instIdx, notes) => {
    const next = [...items];
    const checklist = [...(next[setIdx].checklist || [])];
    checklist[instIdx] = {
      ...checklist[instIdx],
      notes,
    };
    next[setIdx].checklist = checklist;
    syncParent(next);
  };

  const handleAddCustomInstrument = (setIdx) => {
    const next = [...items];
    const checklist = [...(next[setIdx].checklist || [])];
    checklist.push({
      instrument_name: `Instrumen Tambahan ${checklist.length + 1}`,
      quantity: 1,
      unit_label: 'Buah',
      status: 'Lengkap',
      notes: '',
    });
    next[setIdx].checklist = checklist;
    syncParent(next);
  };

  const handleRemoveInstrument = (setIdx, instIdx) => {
    const next = [...items];
    const checklist = (next[setIdx].checklist || []).filter((_, i) => i !== instIdx);
    next[setIdx].checklist = checklist;
    syncParent(next);
  };

  // Section B: Alat Satuan Tambahan
  const handleAddExtraItem = () => {
    const next = [...extraItems, { item_name: '', quantity: 1, unit_label: 'Buah' }];
    syncParent(items, next);
  };

  const handleUpdateExtraName = (idx, name) => {
    const next = [...extraItems];
    next[idx].item_name = name;
    syncParent(items, next);
  };

  const handleUpdateExtraQty = (idx, newQty) => {
    const next = [...extraItems];
    next[idx].quantity = Math.max(1, newQty);
    syncParent(items, next);
  };

  const handleRemoveExtra = (idx) => {
    const next = extraItems.filter((_, i) => i !== idx);
    syncParent(items, next);
  };

  // Auto select item pertama jika unit berubah dan list kosong
  useEffect(() => {
    if (unitItems.length > 0 && (!items[0]?.item_name || items[0]?.item_name.trim() === '')) {
      const first = unitItems[0];
      const chk = getInitialChecklist(first.name, first.id);
      syncParent([
        {
          item_id: first.id,
          item_name: first.name,
          quantity: 1,
          unit_label: first.unit_label || 'Set',
          checklist: chk,
        },
      ]);
      setExpandedSets({ 0: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitItems]);

  // Autocomplete untuk alat satuan dari master data
  const singleToolSuggestions = unitItems.filter((i) => i.category === 'Alat Satuan');

  return (
    <div className="space-y-4">
      {/* 1. Dropdown Pilih jenis alat / set instrumen (sesuai unit) */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Pilih jenis alat / set instrumen (sesuai unit)
        </label>
        <select
          value={selectedDropdownId}
          disabled={disabled || !unitId || loading}
          onChange={(e) => {
            const selectedVal = e.target.value;
            setSelectedDropdownId(selectedVal);
            if (selectedVal) {
              const match = unitItems.find((it) => String(it.id) === selectedVal);
              if (match) {
                const chk = getInitialChecklist(match.name, match.id);
                // Jika hanya 1 baris & belum diisi namanya, langsung isi
                if (items.length === 1 && (!items[0].item_name || items[0].item_name.trim() === '')) {
                  syncParent([
                    {
                      item_id: match.id,
                      item_name: match.name,
                      quantity: 1,
                      unit_label: match.unit_label || 'Set',
                      checklist: chk,
                    },
                  ]);
                  setExpandedSets({ 0: true });
                }
              }
            }
          }}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-brand-500 focus:outline-none shadow-sm font-medium"
        >
          <option value="">
            {!unitId ? 'Pilih Unit Asal terlebih dahulu...' : loading ? 'Memuat alat...' : 'Pilih jenis alat / set instrumen...'}
          </option>
          {unitItems.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name} ({it.category || it.unit_label || 'Set'})
            </option>
          ))}
        </select>
      </div>

      {/* ============================================================== */}
      {/* A. DAFTAR SET INSTRUMEN & PEMERIKSAAN KELENGKAPAN OTOMATIS     */}
      {/* ============================================================== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-900">
              A. Daftar Set Instrumen (Unit: {unitName})
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              {items.filter((i) => i.item_name).length} Set
            </span>
          </div>
          <button
            type="button"
            disabled={disabled || !unitId}
            onClick={handleAddSet}
            className="flex items-center gap-1.5 rounded-xl bg-[#002D85] hover:bg-brand-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
          >
            <Plus size={14} /> Tambah Set
          </button>
        </div>

        {/* Container Kartu Set */}
        <div className="space-y-3">
          {items.map((item, setIdx) => {
            const checklist = item.checklist || [];
            const isExpanded = expandedSets[setIdx] ?? true;
            const damagedCount = checklist.filter((c) => c.status === 'Rusak').length;
            const missingCount = checklist.filter((c) => c.status === 'Tidak ada' || c.status === 'Kurang').length;
            const hasIssues = damagedCount > 0 || missingCount > 0;

            return (
              <div
                key={setIdx}
                className="rounded-2xl border border-sky-100 bg-[#F4F7FC] p-3 sm:p-4 shadow-sm space-y-3 transition"
              >
                {/* Baris Input Nama Set & Stepper Jumlah */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Nama Set Instrumen #{setIdx + 1}
                    </label>
                    <input
                      type="text"
                      list={`set-items-list-${setIdx}`}
                      value={item.item_name}
                      disabled={disabled}
                      placeholder="Pilih atau ketik Nama Set (misal: SET MINOR)..."
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = unitItems.find((u) => u.name.toLowerCase() === val.toLowerCase());
                        handleUpdateSetName(setIdx, val, match);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none"
                      required
                    />
                    <datalist id={`set-items-list-${setIdx}`}>
                      {unitItems.map((u) => (
                        <option key={u.id} value={u.name} />
                      ))}
                    </datalist>
                  </div>

                  {/* Stepper Jumlah Set */}
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-[10px] font-medium text-slate-500 mb-1 leading-none">Jumlah</span>
                    <div className="flex items-center rounded-xl border border-slate-300 bg-white px-1 py-0.5 shadow-sm">
                      <button
                        type="button"
                        disabled={disabled || item.quantity <= 1}
                        onClick={() => handleUpdateSetQty(setIdx, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-sm disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleUpdateSetQty(setIdx, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Tombol Hapus Set */}
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-[10px] font-medium text-transparent mb-1 leading-none">Hapus</span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemoveSet(setIdx)}
                      className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                      title="Hapus set ini"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Bagian Accordion Rincian Isi Set Instrumen */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  {/* Header Rincian & Status Ringkasan */}
                  <div
                    onClick={() => setExpandedSets((prev) => ({ ...prev, [setIdx]: !isExpanded }))}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100/80 cursor-pointer select-none border-b border-slate-200/70"
                  >
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-brand-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Rincian Isi Instrumen ({checklist.length} alat)
                      </span>
                      {checklist.length > 0 && (
                        hasIssues ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            <AlertTriangle size={11} /> {missingCount > 0 ? `${missingCount} Tidak ada ` : ''}{damagedCount > 0 ? `${damagedCount} Rusak` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 size={11} /> Semua Lengkap
                          </span>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 text-xs">
                      <span className="text-[11px] font-medium hidden sm:inline">
                        {isExpanded ? 'Tutup Rincian' : 'Periksa Kelengkapan'}
                      </span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Isi Checklist Rincian Instrumen */}
                  {isExpanded && (
                    <div className="p-3 space-y-2.5">
                      {checklist.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center">
                          <p className="text-xs text-slate-500">
                            {item.item_name
                              ? 'Belum ada rincian instrumen di master data untuk set ini.'
                              : 'Ketik atau pilih nama set di atas untuk memuat rincian instrumen otomatis.'}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleAddCustomInstrument(setIdx)}
                            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                          >
                            <Plus size={12} /> Tambah Baris Alat Manual
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {checklist.map((inst, instIdx) => (
                            <div key={instIdx} className="py-2.5 first:pt-0 last:pb-0">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                {/* Nama Instrumen */}
                                <div className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                                    {instIdx + 1}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-800">
                                    {inst.instrument_name}
                                  </span>
                                  <span className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                                    {inst.quantity || 1} {inst.unit_label || 'Buah'}
                                  </span>
                                </div>

                                {/* 3 Pilihan Status: Lengkap | Tidak ada | Rusak */}
                                <div className="flex items-center gap-1.5 shrink-0 pl-7 sm:pl-0">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInstrumentStatus(setIdx, instIdx, 'Lengkap')}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                      inst.status === 'Lengkap'
                                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/20'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                  >
                                    <Check size={12} /> Lengkap
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInstrumentStatus(setIdx, instIdx, 'Tidak ada')}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                      inst.status === 'Tidak ada' || inst.status === 'Kurang'
                                        ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-500/20'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                  >
                                    <XCircle size={12} /> Tidak ada
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInstrumentStatus(setIdx, instIdx, 'Rusak')}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                      inst.status === 'Rusak'
                                        ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-500/20'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                  >
                                    <AlertTriangle size={12} /> Rusak
                                  </button>

                                  {/* Tombol Hapus Baris Instrumen jika manual */}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveInstrument(setIdx, instIdx)}
                                    className="p-1 text-slate-400 hover:text-rose-500 transition rounded"
                                    title="Hapus baris instrumen ini"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {/* Input Keterangan Jika Rusak atau Tidak Ada */}
                              {(inst.status === 'Rusak' || inst.status === 'Tidak ada' || inst.status === 'Kurang') && (
                                <div className="mt-2 ml-7 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-amber-900">
                                      {inst.status === 'Rusak' ? 'Keterangan Kerusakan Alat:' : 'Keterangan Ketidaklengkapan / Keberadaan Alat:'}
                                    </span>
                                    <span className="text-[10px] text-amber-700 italic">
                                      *Otomatis dicatat ke Log Diskrepansi & Laporan
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={inst.notes || ''}
                                    onChange={(e) => handleUpdateInstrumentNote(setIdx, instIdx, e.target.value)}
                                    placeholder={
                                      inst.status === 'Rusak'
                                        ? 'misal: patah, ujung tumpul/bengkok, retak, dalam perbaikan teknisi...'
                                        : 'misal: tertinggal di ruangan tindakan, dipinjam poli lain, belum ditemukan...'
                                    }
                                    className="w-full text-xs rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-xs font-medium"
                                  />
                                </div>
                              )}
                            </div>
                          ))}

                          <div className="pt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleAddCustomInstrument(setIdx)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800"
                            >
                              <Plus size={12} /> Tambah Baris Alat di Set Ini
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* B. PENAMBAHAN ALAT SATUAN DI LUAR ISI SET                      */}
      {/* ============================================================== */}
      <div className="space-y-2 pt-2 border-t border-slate-200/80">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-900 block">
              B. Penambahan Alat Satuan (Di Luar Isi Set)
            </span>
            <span className="text-[11px] text-slate-500">
              Contoh: Kom kecil – 2, Gunting tambahan – 1, Pinset tambahan – 1
            </span>
          </div>
          <button
            type="button"
            disabled={disabled || !unitId}
            onClick={handleAddExtraItem}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
          >
            <Plus size={14} /> Tambah Alat Satuan
          </button>
        </div>

        {extraItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 text-center">
            <p className="text-xs text-slate-500">
              Belum ada alat satuan tambahan di luar set. Klik{' '}
              <span className="font-semibold text-slate-700">"+ Tambah Alat Satuan"</span> jika ada instrumen lepasan.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2 shadow-xs">
            {extraItems.map((extra, extraIdx) => (
              <div key={extraIdx} className="flex items-center gap-2 sm:gap-3">
                {/* Input Nama Alat Satuan */}
                <div className="flex-1">
                  <input
                    type="text"
                    list={`extra-tools-list-${extraIdx}`}
                    value={extra.item_name}
                    disabled={disabled}
                    placeholder="Nama Alat Satuan (misal: Kom kecil, Gunting tambahan, Pinset)..."
                    onChange={(e) => handleUpdateExtraName(extraIdx, e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-800 shadow-xs focus:border-brand-500 focus:outline-none"
                    required
                  />
                  <datalist id={`extra-tools-list-${extraIdx}`}>
                    {singleToolSuggestions.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                    <option value="Kom kecil" />
                    <option value="Gunting tambahan" />
                    <option value="Pinset tambahan" />
                    <option value="Bak instrumen" />
                    <option value="Bengkok" />
                  </datalist>
                </div>

                {/* Stepper Jumlah Satuan */}
                <div className="flex items-center rounded-xl border border-slate-300 bg-white px-1 py-0.5 shadow-xs shrink-0">
                  <button
                    type="button"
                    disabled={disabled || extra.quantity <= 1}
                    onClick={() => handleUpdateExtraQty(extraIdx, extra.quantity - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-xs disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-slate-900">
                    {extra.quantity}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleUpdateExtraQty(extraIdx, extra.quantity + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-xs"
                  >
                    +
                  </button>
                </div>

                <span className="text-xs font-semibold text-slate-500 shrink-0 hidden sm:inline">
                  {extra.unit_label || 'Buah'}
                </span>

                {/* Tombol Hapus Satuan */}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleRemoveExtra(extraIdx)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                  title="Hapus alat satuan ini"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
