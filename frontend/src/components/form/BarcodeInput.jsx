import { useState } from 'react';
import { ScanLine, Camera, CameraOff } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import useBarcodeScanner from '@/hooks/useBarcodeScanner';

function CameraScanner({ open, onClose, onDetect }) {
  const { videoRef, error, supported } = useBarcodeScanner({ active: open, onDetect });

  return (
    <Modal open={open} onClose={onClose} title="Scan Barcode" subtitle="Arahkan kamera HP ke barcode" size="sm">
      {error || !supported ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-600">
          <CameraOff size={32} className="text-slate-400" />
          <p>{error || 'Scan kamera tidak didukung browser ini.'}</p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.9)]" />
        </div>
      )}
    </Modal>
  );
}

/**
 * Input barcode: ketik manual, scanner USB/Bluetooth (akhiri dengan Enter), atau kamera HP.
 * onCommit dipanggil saat Enter ditekan / barcode terdeteksi.
 */
export default function BarcodeInput({ value, onChange, onCommit, placeholder, disabled, hasError }) {
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleDetect = (code) => {
    setCameraOpen(false);
    onChange(code);
    onCommit?.(code);
  };

  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={value}
            disabled={disabled}
            autoComplete="off"
            placeholder={placeholder || 'Scan atau ketik barcode'}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommit?.(value);
              }
            }}
            onBlur={() => value && onCommit?.(value)}
            className={`input-base pl-9 font-mono ${hasError ? 'input-error' : ''}`}
          />
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCameraOpen(true)}
          title="Scan dengan kamera"
          aria-label="Scan dengan kamera"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <Camera size={18} />
        </button>
      </div>
      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={handleDetect} />
    </>
  );
}
