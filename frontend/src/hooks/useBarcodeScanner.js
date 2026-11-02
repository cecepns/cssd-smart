import { useEffect, useRef, useState } from 'react';

const FORMATS = ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'itf', 'codabar'];

/**
 * Scan barcode memakai kamera HP (BarcodeDetector API, Chrome Android / Edge / Safari terbaru).
 * Membutuhkan HTTPS atau localhost agar kamera dapat diakses.
 */
export default function useBarcodeScanner({ active, onDetect }) {
  const videoRef = useRef(null);
  const onDetectRef = useRef(onDetect);
  const [error, setError] = useState(null);
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    if (!active) return undefined;
    setError(null);

    if (!supported) {
      setError('Browser belum mendukung scan kamera. Gunakan scanner USB/Bluetooth atau ketik barcode manual.');
      return undefined;
    }

    let stream;
    let frame;
    let stopped = false;
    const detector = new window.BarcodeDetector({ formats: FORMATS });

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            if (codes.length) {
              onDetectRef.current(codes[0].rawValue);
              return;
            }
          } catch {
            // frame belum siap, lanjutkan
          }
          frame = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError('Kamera tidak dapat diakses. Izinkan akses kamera pada browser dan gunakan HTTPS.');
      }
    };

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, supported]);

  return { videoRef, error, supported };
}
