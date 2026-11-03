import { useEffect, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { todayISO } from '@/utils/format';

export default function DiscrepancyModal({
  open,
  sets = [],
  selectedSet = null,
  onClose,
  onSubmit,
}) {
  const [setId, setSetId] = useState('');
  const [instrumentName, setInstrumentName] = useState('');
  const [incidentType, setIncidentType] = useState('Kurang');
  const [quantity, setQuantity] = useState(1);
  const [unitOrigin, setUnitOrigin] = useState('');
  const [officer, setOfficer] = useState('');
  const [incidentDate, setIncidentDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Available instruments from current selected set for fast selection
  const currentSet = sets.find((s) => String(s.id) === String(setId)) || selectedSet;
  const availableInstruments = currentSet?.items || [];

  useEffect(() => {
    if (open) {
      const targetId = selectedSet?.id ? String(selectedSet.id) : (sets[0]?.id ? String(sets[0].id) : '');
      setSetId(targetId);
      setInstrumentName('');
      setIncidentType('Kurang');
      setQuantity(1);
      setUnitOrigin('');
      setOfficer('');
      setIncidentDate(todayISO());
      setNotes('');
    }
  }, [open, selectedSet, sets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!setId) {
      toast.error('Pilih set instrumen terlebih dahulu');
      return;
    }
    if (!instrumentName.trim()) {
      toast.error('Nama instrumen yang hilang/rusak/kurang wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        set_id: Number(setId),
        instrument_name: instrumentName.trim(),
        incident_type: incidentType,
        quantity: Math.max(Number(quantity) || 1, 1),
        unit_origin: unitOrigin.trim() || null,
        officer: officer.trim() || 'Petugas CSSD',
        incident_date: incidentDate,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      // Error is handled by caller toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Catat Instrumen Hilang, Rusak, atau Kurang"
      subtitle="Pencatatan ini akan otomatis memperbarui status kelengkapan set instrumen"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pilih Set */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Set Instrumen <span className="text-rose-500">*</span>
          </label>
          <select
            value={setId}
            onChange={(e) => {
              setSetId(e.target.value);
              setInstrumentName('');
            }}
            required
            className="input-base mt-1"
          >
            <option value="">Pilih Set Instrumen...</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {/* Pilih atau Ketik Nama Instrumen */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Nama Instrumen <span className="text-rose-500">*</span>
            </label>
            {availableInstruments.length > 0 && (
              <span className="text-xs text-brand-700 font-medium">
                Pilih cepat dari isi set
              </span>
            )}
          </div>

          {availableInstruments.length > 0 ? (
            <div className="mt-1 space-y-2">
              <select
                value={availableInstruments.some((it) => it.instrument_name === instrumentName) ? instrumentName : '__OTHER__'}
                onChange={(e) => {
                  if (e.target.value !== '__OTHER__') {
                    setInstrumentName(e.target.value);
                  } else {
                    setInstrumentName('');
                  }
                }}
                className="input-base text-sm"
              >
                <option value="">-- Pilih dari daftar instrumen set ini --</option>
                {availableInstruments.map((it, idx) => (
                  <option key={idx} value={it.instrument_name}>
                    {it.instrument_name} (Standar: {it.quantity} {it.unit_label || 'Buah'})
                  </option>
                ))}
                <option value="__OTHER__">Ketik instrumen lain...</option>
              </select>

              <input
                type="text"
                value={instrumentName}
                onChange={(e) => setInstrumentName(e.target.value)}
                placeholder="Nama instrumen (mis. Gunting Mayo, Pinset Sirurgis)..."
                required
                className="input-base text-sm"
              />
            </div>
          ) : (
            <input
              type="text"
              value={instrumentName}
              onChange={(e) => setInstrumentName(e.target.value)}
              placeholder="Ketik nama instrumen..."
              required
              className="input-base mt-1 text-sm"
            />
          )}
        </div>

        {/* Baris: Jenis Insiden & Jumlah */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Jenis Insiden <span className="text-rose-500">*</span>
            </label>
            <select
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              className="input-base mt-1 font-semibold"
            >
              <option value="Kurang">Kurang (Jumlah Tidak Pas)</option>
              <option value="Hilang">Hilang (Tidak Ditemukan)</option>
              <option value="Rusak">Rusak (Patah / Tumpul)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Jumlah (Buah) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="input-base mt-1 font-bold"
            />
          </div>
        </div>

        {/* Baris: Unit Asal & Tanggal */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Unit Asal / Ruangan
            </label>
            <input
              type="text"
              value={unitOrigin}
              onChange={(e) => setUnitOrigin(e.target.value)}
              placeholder="Contoh: Kamar Operasi (OK 1), IGD"
              className="input-base mt-1 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Tanggal Kejadian <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              required
              className="input-base mt-1 text-sm"
            />
          </div>
        </div>

        {/* Petugas Pelapor */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Petugas CSSD Pemeriksa
          </label>
          <input
            type="text"
            value={officer}
            onChange={(e) => setOfficer(e.target.value)}
            placeholder="Nama petugas CSSD yang memeriksa..."
            className="input-base mt-1 text-sm"
          />
        </div>

        {/* Kronologi / Catatan */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Kronologi / Catatan Pemeriksaan
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Jelaskan kondisi alat (mis. patah ujung saat tindakan, tertinggal di laundry, dsb)..."
            className="input-base mt-1 h-auto py-2 text-sm"
          />
        </div>

        {/* Info Box */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
          <span>
            Pencatatan ini akan otomatis mengubah status kelengkapan set terkait menjadi <strong>TIDAK LENGKAP</strong>.
            Status akan kembali lengkap setelah instrumen diganti atau ditemukan kembali.
          </span>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" loading={submitting}>
            Simpan Riwayat Insiden
          </Button>
        </div>
      </form>
    </Modal>
  );
}

