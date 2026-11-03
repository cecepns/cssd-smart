import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CompletenessModal({
  open,
  set,
  onClose,
  onSubmit,
}) {
  const [status, setStatus] = useState('Lengkap');
  const [missingNotes, setMissingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (set) {
      setStatus(set.completeness_status || 'Lengkap');
      setMissingNotes(set.missing_notes || '');
    }
  }, [set]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === 'Tidak Lengkap' && !missingNotes.trim()) {
      toast.error('Mohon tuliskan catatan instrumen yang kurang');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(set.id, {
        completeness_status: status,
        missing_notes: status === 'Lengkap' ? null : missingNotes.trim(),
      });
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Gagal mengubah status kelengkapan');
    } finally {
      setSubmitting(false);
    }
  };

  if (!set) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Status Kelengkapan: ${set.name}`}
      subtitle="Perbarui status fisik kelengkapan instrumen dalam set ini"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button
            type="submit"
            form="completeness-form"
            loading={submitting}
          >
            Simpan Status
          </Button>
        </>
      }
    >
      <form id="completeness-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Pilih Status:</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStatus('Lengkap')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition-all ${
                status === 'Lengkap'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 size={16} className="text-emerald-600" /> Lengkap
            </button>

            <button
              type="button"
              onClick={() => setStatus('Tidak Lengkap')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition-all ${
                status === 'Tidak Lengkap'
                  ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertCircle size={16} className="text-amber-600" /> Tidak Lengkap
            </button>
          </div>
        </div>

        {status === 'Tidak Lengkap' && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Catatan Instrumen yang Kurang / Rusak <span className="text-rose-500">*</span>:
            </label>
            <textarea
              required
              rows={3}
              value={missingNotes}
              onChange={(e) => setMissingNotes(e.target.value)}
              placeholder="Contoh: Gunting Mayo kurang 1 pcs, Pinset sirurgis ujung bengkok"
              className="input-base text-sm h-auto py-2"
            />
          </div>
        )}
      </form>
    </Modal>
  );
}

