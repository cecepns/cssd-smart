import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { ExternalLink, Printer } from 'lucide-react';
import Button from '@/components/ui/Button';
import { QrCodeSvg } from '@/utils/qr';

export default function CounterCard({
  number,
  title,
  subtitle,
  category = 'TRANSAKSI',
  barcodeValue,
  targetUrl,
  instructions,
  onPrint,
}) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && barcodeValue) {
      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: 'CODE128',
          height: 38,
          width: 1.6,
          fontSize: 12,
          margin: 4,
          displayValue: true,
        });
      } catch {
        /* abaikan jika karakter tidak valid */
      }
    }
  }, [barcodeValue]);

  return (
    <div className="card counter-card-print flex flex-col justify-between overflow-hidden border-2 border-slate-200 bg-white p-0 shadow-md transition hover:border-[#D4AF37] hover:shadow-lg">
      {/* Header Kartu Akrilik */}
      <div className="bg-[#0A192F] p-4 text-center text-white border-b-2 border-[#D4AF37]">
        <div className="flex items-center justify-center gap-2">
          <span className="rounded-full bg-[#F59E0B] px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-xs">
            RSUD SERPONG UTARA
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#D4AF37]">
            CSSD SMART
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold tracking-wide text-slate-300 uppercase">
          Instalasi Pusat Sterilisasi (CSSD)
        </p>
      </div>

      {/* Konten Kartu */}
      <div className="flex flex-1 flex-col items-center justify-center p-5 text-center">
        {number && (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-amber-400 mb-2">
            #{number}
          </span>
        )}

        <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-snug">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs font-extrabold uppercase tracking-wide text-amber-700">
            {subtitle}
          </p>
        )}

        {/* QR Code Container */}
        <div className="my-3.5 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-3 shadow-inner">
          <QrCodeSvg value={targetUrl} size={160} />
          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Scan dengan Kamera Smartphone
          </p>
        </div>

        {/* 1D Barcode Container */}
        {barcodeValue && (
          <div className="mb-2">
            <svg ref={barcodeRef} className="max-w-full" />
          </div>
        )}

        <p className="max-w-xs text-xs leading-relaxed text-slate-600">
          {instructions || 'Arahkan kamera smartphone ke QR Code ini untuk membuka halaman secara langsung.'}
        </p>

        <div className="mt-2 text-[11px] font-mono font-bold text-slate-400 truncate max-w-full px-2">
          {targetUrl}
        </div>
      </div>

      {/* Footer Aksi (Disembunyikan saat Print) */}
      <div className="no-print flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 p-3">
        <a
          href={targetUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-brand-700"
        >
          <ExternalLink size={13} />
          <span>Uji Buka</span>
        </a>

        <Button
          size="sm"
          variant="secondary"
          icon={Printer}
          onClick={() => onPrint ? onPrint() : window.print()}
          className="font-bold text-slate-800"
        >
          Cetak Kartu
        </Button>
      </div>
    </div>
  );
}
