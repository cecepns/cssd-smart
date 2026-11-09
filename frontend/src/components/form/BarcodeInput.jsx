import { useState } from 'react';
import { ScanLine, QrCode, Camera, CameraOff } from 'lucide-react';
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
export default function BarcodeInput({ value, onChange, onCommit, placeholder, disabled, hasError, hero = false }) {
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
          {hero ? (
            <QrCode size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#00338D]" />
          ) : (
            <ScanLine size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          )}
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
            className={
              hero
                ? `block h-11 w-full rounded-xl border border-sky-300 bg-white pl-10 pr-3 font-mono text-sm text-slate-800 shadow-inner transition placeholder:font-sans placeholder:text-slate-400 focus:border-[#0055C4] focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100 ${
                    hasError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''
                  }`
                : `input-base pl-9 font-mono ${hasError ? 'input-error' : ''}`
            }
          />
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCameraOpen(true)}
          title="Scan dengan kamera"
          aria-label="Scan dengan kamera"
          className={
            hero
              ? 'inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#38BDF8] to-[#0284C7] text-white shadow-[0_4px_12px_rgba(2,132,199,0.35)] transition hover:brightness-110 disabled:opacity-50'
              : 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50'
          }
        >
          <Camera size={hero ? 20 : 18} />
        </button>
      </div>
      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={handleDetect} />
    </>
  );
}
