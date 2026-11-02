import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

function printLabel(svgMarkup, title, subtitle) {
  const win = window.open('', '_blank', 'width=420,height=360');
  if (!win) return;
  const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  win.document.write(`<!doctype html><html><head><title>Label ${esc(title)}</title>
    <style>
      @page { size: 60mm 40mm; margin: 2mm; }
      body { font-family: Arial, sans-serif; text-align: center; margin: 0; padding: 4px; }
      h1 { font-size: 11px; margin: 0; } p { font-size: 9px; margin: 2px 0 0; color: #333; }
      svg { max-width: 100%; height: auto; }
    </style></head><body>
    <h1>CSSD SMART - RSU Serpong Utara</h1>${svgMarkup}<p>${esc(subtitle)}</p>
    <script>window.onload = function(){ window.print(); window.close(); }<\/script></body></html>`);
  win.document.close();
}

/** Modal pratinjau & cetak label barcode (Code 128). */
export default function BarcodeLabel({ open, onClose, code, title, subtitle }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!open || !code || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, code, { format: 'CODE128', height: 60, width: 2, fontSize: 14, margin: 6, displayValue: true });
    } catch {
      /* kode tidak valid, abaikan */
    }
  }, [open, code]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Label Barcode"
      subtitle={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
          <Button icon={Printer} onClick={() => printLabel(svgRef.current.outerHTML, code, subtitle || title)}>Cetak Label</Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <svg ref={svgRef} className="max-w-full" />
        {subtitle && <p className="text-center text-xs text-slate-500">{subtitle}</p>}
      </div>
    </Modal>
  );
}
