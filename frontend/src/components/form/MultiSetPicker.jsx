import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import useFetch from '@/hooks/useFetch';
import { API_ENDPOINTS } from '@/utils/endpoints';

export default function MultiSetPicker({ value, values, setValue, setValues, disabled }) {
  const unitId = values?.unit_id;
  const [selectedDropdownId, setSelectedDropdownId] = useState('');

  // Fetch all items / sets for this unit
  const { data: itemsData, loading } = useFetch(
    API_ENDPOINTS.LOOKUPS.ITEMS,
    { unit_id: unitId, is_active: 1, sort_by: 'name', order: 'asc' },
    { enabled: Boolean(unitId) }
  );
  const unitItems = itemsData || [];

  // Find unit name
  const { data: unitsData } = useFetch(API_ENDPOINTS.LOOKUPS.UNITS, { limit: 100 });
  const selectedUnit = (unitsData || []).find((u) => String(u.id) === String(unitId));
  const unitName = values?.unit_name || selectedUnit?.name || 'Unit';

  // Initialize items array
  const [items, setItems] = useState(() => {
    if (Array.isArray(value) && value.length > 0) return value;
    if (values?.item_name) {
      return [{ item_name: values.item_name, quantity: values.quantity || 1, unit_label: values.unit_label || 'Set' }];
    }
    return [{ item_name: '', quantity: 1, unit_label: 'Set' }];
  });

  // Sync to parent form state
  const syncParent = (newItems) => {
    setItems(newItems);
    setValue('items', newItems);
    const valid = newItems.filter((it) => it.item_name && it.item_name.trim());
    if (valid.length > 0) {
      setValue('item_name', valid.map((it) => `${it.item_name} (${it.quantity} ${it.unit_label || 'Set'})`).join(', '));
      setValue('quantity', valid.reduce((acc, curr) => acc + Number(curr.quantity || 1), 0));
      setValue('unit_label', valid[0].unit_label || 'Set');
      setValue('item_id', valid[0].item_id || null);
    }
  };

  // Add set from dropdown or add new row
  const handleAddSet = () => {
    if (selectedDropdownId) {
      const match = unitItems.find((it) => String(it.id) === String(selectedDropdownId));
      if (match) {
        // If already in list, increase quantity
        const existingIdx = items.findIndex((it) => it.item_id === match.id || it.item_name === match.name);
        if (existingIdx >= 0) {
          const next = [...items];
          next[existingIdx].quantity += 1;
          syncParent(next);
          return;
        }
        // Else add new set
        const next = [...items, { item_id: match.id, item_name: match.name, quantity: 1, unit_label: match.unit_label || 'Set' }];
        // remove empty first row if any
        const filtered = next.filter((it) => it.item_name.trim() !== '' || next.length === 1);
        syncParent(filtered);
        return;
      }
    }

    // If nothing selected in dropdown, add a row
    const next = [...items, { item_name: '', quantity: 1, unit_label: 'Set' }];
    syncParent(next);
  };

  const handleUpdateName = (idx, name, itemObj = null) => {
    const next = [...items];
    next[idx].item_name = name;
    if (itemObj) {
      next[idx].item_id = itemObj.id;
      next[idx].unit_label = itemObj.unit_label || next[idx].unit_label || 'Set';
    }
    syncParent(next);
  };

  const handleUpdateQty = (idx, newQty) => {
    const next = [...items];
    next[idx].quantity = Math.max(1, newQty);
    syncParent(next);
  };

  const handleRemove = (idx) => {
    const next = items.filter((_, i) => i !== idx);
    syncParent(next.length === 0 ? [{ item_name: '', quantity: 1, unit_label: 'Set' }] : next);
  };

  // Auto select first item if unit changed and list empty
  useEffect(() => {
    if (unitItems.length > 0 && (!items[0]?.item_name || items[0]?.item_name.trim() === '')) {
      const first = unitItems[0];
      syncParent([{ item_id: first.id, item_name: first.name, quantity: 1, unit_label: first.unit_label || 'Set' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitItems]);

  return (
    <div className="space-y-3">
      {/* 1. Dropdown Pilih jenis alat / set instrumen (sesuai unit) */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Pilih jenis alat / set instrumen (sesuai unit)
        </label>
        <select
          value={selectedDropdownId}
          disabled={disabled || !unitId || loading}
          onChange={(e) => {
            setSelectedDropdownId(e.target.value);
            if (e.target.value) {
              const match = unitItems.find((it) => String(it.id) === e.target.value);
              if (match) {
                // If the only row is empty, fill it immediately!
                if (items.length === 1 && (!items[0].item_name || items[0].item_name.trim() === '')) {
                  syncParent([{ item_id: match.id, item_name: match.name, quantity: 1, unit_label: match.unit_label || 'Set' }]);
                }
              }
            }
          }}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none shadow-sm font-medium"
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

      {/* 2. Daftar Set / Paket Header with "+ Tambah Set" Button */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-bold text-slate-900">
          Daftar Set / Paket (Unit: {unitName})
        </span>
        <button
          type="button"
          disabled={disabled || !unitId}
          onClick={handleAddSet}
          className="flex items-center gap-1.5 rounded-xl bg-[#002D85] hover:bg-brand-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
        >
          <Plus size={14} /> Tambah Set
        </button>
      </div>

      {/* 3. Container Card Daftar Set (Matches user screenshot) */}
      <div className="rounded-2xl border border-sky-100 bg-[#F4F7FC] p-3.5 space-y-2.5 shadow-inner">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 sm:gap-3">
            {/* Input Nama Set */}
            <div className="flex-1">
              <input
                type="text"
                list={`set-items-list-${idx}`}
                value={item.item_name}
                disabled={disabled}
                placeholder="Nama Set Instrumen / Alat..."
                onChange={(e) => {
                  const val = e.target.value;
                  const match = unitItems.find((u) => u.name.toLowerCase() === val.toLowerCase());
                  handleUpdateName(idx, val, match);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none"
                required
              />
              <datalist id={`set-items-list-${idx}`}>
                {unitItems.map((u) => (
                  <option key={u.id} value={u.name} />
                ))}
              </datalist>
            </div>

            {/* Stepper Jumlah Counter */}
            <div className="flex flex-col items-center shrink-0">
              <span className="text-[10px] font-medium text-slate-500 mb-0.5 leading-none">Jumlah</span>
              <div className="flex items-center rounded-xl border border-slate-300 bg-white px-1 py-0.5 shadow-sm">
                <button
                  type="button"
                  disabled={disabled || item.quantity <= 1}
                  onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-sm disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-7 text-center text-xs font-bold text-slate-900">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Tombol Hapus Sampah Merah */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleRemove(idx)}
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
              title="Hapus set ini"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

