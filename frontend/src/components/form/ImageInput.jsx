import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Maximize2, Trash2, X } from 'lucide-react';
import { fileUrl } from '@/utils/format';

/**
 * Kompres gambar ke JPEG maks 1600px agar aman dari limit 2MB & upload cepat di HP.
 */
function compressImageFile(file, maxWidth = 1600, maxHeight = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File yang dipilih bukan gambar'));
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Gagal mengompres gambar'));
            const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Upload gambar & kamera serah terima (mendukung kamera langsung HP & galeri). */
export default function ImageInput({ value, onChange, onError, disabled }) {
  const [compressing, setCompressing] = useState(false);
  const [modalPreview, setModalPreview] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const preview = useMemo(() => {
    if (value instanceof File) return URL.createObjectURL(value);
    if (typeof value === 'string' && value) {
      return value.startsWith('data:') ? value : fileUrl(value);
    }
    return '';
  }, [value]);

  useEffect(() => {
    return () => {
      if (value instanceof File && preview) URL.revokeObjectURL(preview);
    };
  }, [value, preview]);

  const processFile = async (rawFile) => {
    if (!rawFile) return;
    if (!rawFile.type.startsWith('image/')) {
      onError?.('File harus berupa foto / gambar (JPG, PNG, WEBP)');
      return;
    }
    setCompressing(true);
    try {
      const compressed = await compressImageFile(rawFile);
      onChange(compressed);
    } catch (err) {
      onError?.(err.message || 'Gagal memproses gambar kamera');
    } finally {
      setCompressing(false);
    }
  };

  const handleCameraChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    processFile(file);
  };

  const handleGalleryChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    processFile(file);
  };

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Thumbnail Preview Box */}
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          {preview ? (
            <>
              <img src={preview} alt="Bukti Foto" className="h-full w-full object-cover cursor-pointer hover:opacity-90 transition" onClick={() => setModalPreview(true)} />
              <button
                type="button"
                onClick={() => setModalPreview(true)}
                title="Perbesar Foto"
                className="absolute left-1 bottom-1 rounded-md bg-slate-900/70 p-1 text-white hover:bg-slate-900 transition"
              >
                <Maximize2 size={12} />
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange('')}
                  title="Hapus Foto"
                  className="absolute right-1 top-1 rounded-md bg-rose-600/80 p-1 text-white hover:bg-rose-700 transition"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300 p-2 text-center">
              <Camera size={26} className="text-slate-400 mb-1" />
              <span className="text-[10px] text-slate-400 font-medium">Belum ada foto</span>
            </div>
          )}
        </div>

        {/* Action Buttons: Kamera & Galeri */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Input khusus Kamera HP (capture="environment") */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCameraChange}
              disabled={disabled || compressing}
            />
            <button
              type="button"
              disabled={disabled || compressing}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              <Camera size={15} />
              <span>{compressing ? 'Memproses...' : 'Ambil Foto Kamera HP'}</span>
            </button>

            {/* Input Galeri / File */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleGalleryChange}
              disabled={disabled || compressing}
            />
            <button
              type="button"
              disabled={disabled || compressing}
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <ImagePlus size={15} className="text-slate-500" />
              <span>Pilih File / Galeri</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Foto bukti dokumentasi serah terima langsung dari kamera HP atau unggah file. Disimpan otomatis untuk keperluan audit & laporan.
          </p>
        </div>
      </div>

      {/* Modal Lightbox Popup Preview Fullscreen */}
      {modalPreview && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-xs" onClick={() => setModalPreview(false)}>
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
              <span className="text-xs font-bold text-slate-800">Bukti Foto Dokumentasi Serah Terima</span>
              <button
                type="button"
                onClick={() => setModalPreview(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-3 max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-100">
              <img src={preview} alt="Dokumentasi Serah Terima" className="max-h-[70vh] w-auto rounded-lg object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
