import { useCallback, useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';
import { fileUrl } from '@/utils/format';

const WIDTH = 480;
const HEIGHT = 160;

/**
 * Kolom tanda tangan (canvas). Nilai: data URL PNG (baru) atau path file (sudah tersimpan).
 */
export default function SignaturePad({ value, onChange, disabled }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const saved = value && !String(value).startsWith('data:');

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    return ctx;
  }, []);

  useEffect(() => {
    setup();
  }, [setup, saved]);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const start = (event) => {
    if (disabled) return;
    event.preventDefault();
    canvasRef.current.setPointerCapture(event.pointerId);
    const ctx = setup();
    const { x, y } = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
    drawing.current = true;
  };

  const move = (event) => {
    if (!drawing.current) return;
    const ctx = setup();
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, WIDTH, HEIGHT);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white">
        {saved ? (
          <img src={fileUrl(value)} alt="Tanda tangan" className="h-32 w-full object-contain" />
        ) : (
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            className="h-32 w-full touch-none cursor-crosshair"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
        )}
        {!saved && !value && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            Tanda tangan di sini
          </span>
        )}
      </div>
      {!disabled && (value || saved) && (
        <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700">
          <Eraser size={14} /> Hapus tanda tangan
        </button>
      )}
    </div>
  );
}
