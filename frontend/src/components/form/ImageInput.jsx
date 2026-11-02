import { useEffect, useMemo } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { fileUrl } from '@/utils/format';

const MAX_SIZE = 2 * 1024 * 1024;

/** Upload gambar. Nilai: File (baru) atau path string (tersimpan). */
export default function ImageInput({ value, onChange, onError, disabled }) {
  const preview = useMemo(() => (value instanceof File ? URL.createObjectURL(value) : value ? fileUrl(value) : ''), [value]);

  useEffect(() => () => value instanceof File && URL.revokeObjectURL(preview), [value, preview]);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return onError?.('File harus PNG, JPG, atau WEBP');
    if (file.size > MAX_SIZE) return onError?.('Ukuran gambar maksimal 2 MB');
    onChange(file);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {preview ? <img src={preview} alt="Pratinjau" className="h-full w-full object-cover" /> : <ImagePlus size={24} className="text-slate-300" />}
        {preview && !disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Hapus gambar"
            className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-0.5 text-white hover:bg-slate-900"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <label className={`inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        Pilih gambar
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} disabled={disabled} />
      </label>
    </div>
  );
}
