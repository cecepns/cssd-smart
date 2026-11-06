import { useEffect, useState } from 'react';
import { Plus, Trash2, Layers } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/utils/request';

export default function InstrumentSetModal({
  open,
  mode = 'create',
  initialData = null,
  onClose,
  onSubmit,
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [completenessStatus, setCompletenessStatus] = useState('Lengkap');
  const [missingNotes, setMissingNotes] = useState('');
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialData) {
        setName(initialData.name || '');
        setCode(initialData.code || '');
        setDescription(initialData.description || '');
        setCompletenessStatus(initialData.completeness_status || 'Lengkap');
        setMissingNotes(initialData.missing_notes || '');
        setItems(
          Array.isArray(initialData.items) && initialData.items.length
            ? initialData.items.map((it) => ({
              id: it.id,
              instrument_name: it.instrument_name || '',
              quantity: it.quantity || 1,
              unit_label: it.unit_label || 'Buah',
            }))
            : [{ instrument_name: '', quantity: 1, unit_label: 'Buah' }]
        );
      } else {
        setName('');
        setCode('');
        setDescription('');
        setCompletenessStatus('Lengkap');
        setMissingNotes('');
        setItems([
          { instrument_name: 'Pinset anatomis', quantity: 2, unit_label: 'Buah' },
          { instrument_name: 'Pinset sirurgis', quantity: 2, unit_label: 'Buah' },
          { instrument_name: 'Gunting Mayo', quantity: 2, unit_label: 'Buah' },
        ]);
      }
    }
  }, [open, mode, initialData]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { instrument_name: '', quantity: 1, unit_label: 'Buah' }]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const totalCalculated = items.reduce(
    (acc, it) => acc + (parseInt(it.quantity, 10) || 0),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nama set instrumen wajib diisi');
      return;
    }

    const validItems = items
      .filter((it) => it.instrument_name && it.instrument_name.trim())
      .map((it) => ({
        instrument_name: it.instrument_name.trim(),
        quantity: Math.max(parseInt(it.quantity, 10) || 1, 1),
        unit_label: it.unit_label || 'Buah',
      }));

    if (validItems.length === 0) {
      toast.error('Minimal harus ada 1 nama instrumen di dalam set');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim().toUpperCase(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        completeness_status: completenessStatus,
        missing_notes: completenessStatus === 'Tidak Lengkap' ? missingNotes.trim() : null,
        items: validItems,
      });
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyimpan set instrumen'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === 'edit' ? 'Edit Set Instrumen' : 'Tambah Set Instrumen Baru'}
      subtitle="Atur rincian instrumen dalam 1 set dan status kelengkapannya"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button
            type="submit"
            form="instrument-set-form"
            loading={submitting}
          >
            {mode === 'edit' ? 'Simpan Perubahan' : 'Simpan Set'}
          </Button>
        </>
      }
    >
      <form id="instrument-set-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Info Utama Set */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Nama Set Instrumen <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. SET LAPAROTOMI"
              className="input-base uppercase font-semibold"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Kode Set (Opsional)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="mis. SET-LAP"
              className="input-base font-mono uppercase"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Keterangan
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="mis. Set instrumen bedah mayor kamar operasi OK"
              className="input-base"
            />
          </div>
        </div>

        {/* Status Kelengkapan */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Status Kelengkapan Set
          </label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="radio"
                name="completeness"
                value="Lengkap"
                checked={completenessStatus === 'Lengkap'}
                onChange={() => setCompletenessStatus('Lengkap')}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Lengkap
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="radio"
                name="completeness"
                value="Tidak Lengkap"
                checked={completenessStatus === 'Tidak Lengkap'}
                onChange={() => setCompletenessStatus('Tidak Lengkap')}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Tidak Lengkap
              </span>
            </label>
          </div>

          {completenessStatus === 'Tidak Lengkap' && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-amber-900">
                Catatan Instrumen yang Kurang / Hilang / Rusak:
              </label>
              <input
                type="text"
                required
                value={missingNotes}
                onChange={(e) => setMissingNotes(e.target.value)}
                placeholder="mis. Gunting Mayo kurang 1 pcs dalam perbaikan"
                className="input-base bg-white border-amber-300 text-amber-900 focus:ring-amber-200 text-sm"
              />
            </div>
          )}
        </div>

        {/* Dynamic Daftar Instrumen dalam 1 Set */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Daftar Instrumen dalam 1 Set
              </h4>
              <p className="text-xs text-slate-500">
                Rincian jenis instrumen dan jumlah per set
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 hover:bg-brand-100 transition-colors"
            >
              <Plus size={14} /> Tambah Instrumen
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
            <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <span className="col-span-8">Nama Instrumen</span>
              <span className="col-span-3 text-center">Jumlah</span>
              <span className="col-span-1 text-center">Aksi</span>
            </div>

            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 p-2.5 items-center">
                <div className="col-span-8">
                  <input
                    type="text"
                    required
                    value={item.instrument_name}
                    onChange={(e) => handleItemChange(index, 'instrument_name', e.target.value)}
                    placeholder="mis. Pinset anatomis"
                    className="input-base text-sm py-1.5"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min="1"
                    required
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    className="input-base text-center text-sm py-1.5 font-bold"
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                    className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 transition-colors"
                    title="Hapus baris"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Ringkasan Total Instrumen */}
          <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-100/80 px-3.5 py-2 text-sm font-bold text-slate-800">
            <span>Total Instrumen per Set:</span>
            <span className="text-base text-brand-700">{totalCalculated} Buah</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}

