import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

export default function DiscrepancyResolveModal({
  open,
  discrepancy = null,
  onClose,
  onSubmit,
}) {
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && discrepancy) {
      setResolutionNotes(`Sudah diganti baru / diselesaikan oleh CSSD`);
    }
  }, [open, discrepancy]);

  if (!discrepancy) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(discrepancy.id, {
        resolution_notes: resolutionNotes.trim() || 'Sudah diganti baru / diselesaikan',
      });
      onClose();
    } catch (err) {
      // Error handled by caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Selesaikan Insiden Instrumen"
      subtitle={`Set: ${discrepancy.set_name || ''}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
          <p>
            <strong>Instrumen:</strong> {discrepancy.instrument_name} ({discrepancy.quantity} pcs)
          </p>
          <p>
            <strong>Insiden:</strong> {discrepancy.incident_type} • {discrepancy.incident_date}
          </p>
          {discrepancy.notes && (
            <p className="text-slate-500 italic">"{discrepancy.notes}"</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Tindakan Solusi / Keterangan Penggantian <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Contoh: Sudah diganti dengan instrumen baru dari stok BMHP, atau ditemukan kembali di OK..."
            required
            className="input-base mt-1 h-auto py-2 text-sm"
          />
        </div>

        <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 flex items-center gap-1.5">
          <CheckCircle2 size={15} className="shrink-0" />
          Jika tidak ada instrumen lain yang kurang, status set otomatis kembali <strong>LENGKAP</strong>.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" loading={submitting}>
            Tandai Selesai
          </Button>
        </div>
      </form>
    </Modal>
  );
}

