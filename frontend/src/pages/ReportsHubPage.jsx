import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Filter, CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import ResourcePage from '@/components/resource/ResourcePage';
import { REPORTS, REPORT_LIST } from '@/config/reports';

export default function ReportsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSlug = searchParams.get('jenis') || 'alat-kotor';
  const [selectedSlug, setSelectedSlug] = useState(REPORTS[initialSlug] ? initialSlug : 'alat-kotor');

  const currentConfig = useMemo(() => REPORTS[selectedSlug] || REPORTS['alat-kotor'], [selectedSlug]);

  const handleSelectReport = (slug) => {
    setSelectedSlug(slug);
    setSearchParams({ jenis: slug }, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Header Pusat Laporan */}
      <PageHeader
        title="Pusat Laporan Terpadu CSSD SMART"
        subtitle="Satu pusat laporan terintegrasi dari seluruh transaksi CSSD — otomatis terisi, filter periode, cetak, dan unduh data"
        icon={FileText}
      />

      {/* Selector Jenis Laporan */}
      <div className="no-print rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-brand-50 p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-xs">
              <Filter size={18} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-900">Pilih Jenis Laporan</p>
              <p className="text-xs text-slate-500">Pilih laporan transaksi untuk menampilkan tabel, cetak, atau unduh.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedSlug}
              onChange={(e) => handleSelectReport(e.target.value)}
              className="input-base w-full sm:w-auto text-sm font-bold text-slate-800 py-2.5 px-3.5 border-brand-300 focus:border-brand-600 focus:ring-brand-200"
            >
              <optgroup label="Proses CSSD">
                <option value="alat-kotor">1. Penerimaan Alat Kotor</option>
                <option value="pencucian">2. Pencucian (Washer & DTT)</option>
                <option value="pengeringan">3. Pengeringan & Pemeriksaan</option>
                <option value="pengemasan">4. Pengemasan & Barcode</option>
                <option value="sterilisasi">5. Sterilisasi (Autoclave & Plasma)</option>
                <option value="verifikasi">6. Verifikasi Sterilisasi</option>
                <option value="karantina">7. Karantina / Gagal</option>
              </optgroup>
              <optgroup label="Distribusi & Serah Terima">
                <option value="distribusi-alat">8. Distribusi Alat Steril (TTD)</option>
                <option value="distribusi-kasa">9. Distribusi Kasa Steril (TTD & Jenis Kasa)</option>
                <option value="distribusi">10. Distribusi Gabungan (Alat & Kasa)</option>
              </optgroup>
              <optgroup label="DTT (RIUS) & Buku Kontrol">
                <option value="dtt-rius">11. DTT (RIUS) & Buku Kontrol Reuse</option>
                <option value="dtt-distribusi">12. Distribusi Alat Hasil DTT</option>
              </optgroup>
              <optgroup label="Stok & Inventaris BMHP">
                <option value="stok-steril">13. Stok Alat Steril</option>
                <option value="stok-bmhp">14. Posisi Stok BMHP</option>
                <option value="mutasi-bmhp">15. Mutasi & Kartu Stok BMHP</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Quick Category Buttons */}
        <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-brand-100 pt-3">
          <span className="text-[11px] font-semibold text-slate-400 py-1 mr-1">Pintasan Cepat:</span>
          {REPORT_LIST.slice(0, 8).map((r) => {
            const isSelected = selectedSlug === r.slug;
            return (
              <button
                key={r.slug}
                type="button"
                onClick={() => handleSelectReport(r.slug)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-brand-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50'
                }`}
              >
                {isSelected && <CheckCircle2 size={12} />}
                {r.label || r.slug}
              </button>
            );
          })}
        </div>
      </div>

      {/* Konten Laporan Aktif */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-4 shadow-xs">
        <ResourcePage key={currentConfig.key} config={currentConfig} />
      </div>
    </div>
  );
}
