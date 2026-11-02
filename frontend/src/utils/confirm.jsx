import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

/**
 * Konfirmasi berbasis toast. Mengembalikan Promise<boolean>.
 * Contoh: if (!(await confirmToast({ message: 'Hapus data?' }))) return;
 */
export function confirmToast({
  title = 'Konfirmasi',
  message = 'Apakah Anda yakin?',
  confirmText = 'Ya, Hapus',
  cancelText = 'Batal',
  danger = true,
} = {}) {
  return new Promise((resolve) => {
    const finish = (toastId, value) => {
      toast.dismiss(toastId);
      resolve(value);
    };

    toast.custom(
      (t) => (
        <div
          className={`w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl transition ${
            t.visible ? 'animate-slide-up' : 'opacity-0'
          }`}
          role="alertdialog"
        >
          <div className="flex gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                danger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
              }`}
            >
              <AlertTriangle size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{title}</p>
              <p className="mt-0.5 text-sm text-slate-600">{message}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => finish(t.id, false)}
              className="h-9 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => finish(t.id, true)}
              className={`h-9 rounded-lg px-4 text-sm font-semibold text-white ${
                danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-700 hover:bg-brand-800'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, position: 'top-center' }
    );
  });
}
