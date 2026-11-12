import { useMemo, useState } from 'react';
import { Building2, Layers, Printer, QrCode, Search, Sparkles } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import CounterCard from '@/components/counter/CounterCard';
import useFetch from '@/hooks/useFetch';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { ROUTES } from '@/config/routes';

export default function CounterBarcodePage() {
  const [activeTab, setActiveTab] = useState('TRANSAKSI'); // 'TRANSAKSI' | 'UNITS'
  const [searchUnit, setSearchUnit] = useState('');
  const [selectedPrintCard, setSelectedPrintCard] = useState(null);

  const { data: unitsData, loading: unitsLoading } = useFetch(API_ENDPOINTS.UNITS.LIST);
  const units = unitsData?.data || (Array.isArray(unitsData) ? unitsData : []);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // 6 Barcode Transaksi Loket CSSD SMART (sesuai referensi resmi)
  const transactionCards = useMemo(() => [
    {
      number: 1,
      title: 'Penerimaan Alat Kotor',
      subtitle: 'Alur: Unit → CSSD',
      barcodeValue: 'TRX-ALAT-KOTOR',
      targetUrl: `${origin}${ROUTES.RECEIPTS}`,
      instructions: 'Scan QR Code ini untuk serah terima alat kotor masuk dari unit ke CSSD dengan TTD digital.',
    },
    {
      number: 2,
      title: 'Distribusi Alat Steril',
      subtitle: 'Alur: CSSD → Unit',
      barcodeValue: 'TRX-DIST-STERIL',
      targetUrl: `${origin}${ROUTES.DIST_TOOLS}`,
      instructions: 'Scan QR Code ini untuk pengambilan alat steril dari CSSD ke unit dengan TTD digital petugas unit.',
    },
    {
      number: 3,
      title: 'Distribusi Kasa Steril',
      subtitle: 'Alur: CSSD → Unit',
      barcodeValue: 'TRX-DIST-KASA',
      targetUrl: `${origin}${ROUTES.DIST_GAUZE}`,
      instructions: 'Scan QR Code ini untuk distribusi kasa steril (OK, Umum, Rol) ke unit tujuan.',
    },
    {
      number: 4,
      title: 'Penerimaan Alat Kotor DTT (Reuse)',
      subtitle: 'Alur: Unit → CSSD',
      barcodeValue: 'TRX-DTT-KOTOR',
      targetUrl: `${origin}${ROUTES.DTT_RECEIPTS}`,
      instructions: 'Scan QR Code ini untuk serah terima alat medis kotor DTT Reuse di loket CSSD.',
    },
    {
      number: 5,
      title: 'Distribusi Alat Hasil DTT (Reuse)',
      subtitle: 'Alur: CSSD → Unit',
      barcodeValue: 'TRX-DTT-DIST',
      targetUrl: `${origin}${ROUTES.DTT_DISTRIBUTIONS}`,
      instructions: 'Scan QR Code ini untuk pengambilan alat steril hasil DTT oleh petugas unit dengan TTD layar HP.',
    },
    {
      number: 6,
      title: 'Barcode BMHP (Bahan Medis)',
      subtitle: 'Transaksi Stok Masuk / Keluar',
      barcodeValue: 'TRX-BMHP-STOK',
      targetUrl: `${origin}${ROUTES.BMHP}`,
      instructions: 'Scan QR Code ini untuk transaksi stok masuk, keluar, dan mutasi inventaris BMHP CSSD.',
    },
  ], [origin]);

  // Barcode Monitoring Status per Unit Rumah Sakit
  const filteredUnits = useMemo(() => {
    if (!searchUnit.trim()) return units;
    const q = searchUnit.toLowerCase();
    return units.filter((u) => u.name?.toLowerCase().includes(q) || u.code?.toLowerCase().includes(q));
  }, [units, searchUnit]);

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div>
      {/* Bagian Header Kontrol */}
      <div className="no-print space-y-4 mb-6">
        <PageHeader
          title="Generate & Cetak Barcode Loket CSSD"
          subtitle="Buat dan cetak barcode akrilik untuk dipajang di depan loket CSSD: 6 Barcode Transaksi Utama & Barcode Monitoring Khusus Unit"
          icon={QrCode}
          actions={
            <Button
              icon={Printer}
              onClick={handlePrintAll}
              className="font-bold shadow-md"
            >
              Cetak Semua Kartu Loket
            </Button>
          }
        />

        {/* Tab Navigasi */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('TRANSAKSI')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition shadow-xs ${
                activeTab === 'TRANSAKSI'
                  ? 'bg-[#0A192F] text-amber-300 ring-2 ring-[#D4AF37]/50'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Layers size={16} />
              <span>6 Barcode Transaksi Loket</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('UNITS')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition shadow-xs ${
                activeTab === 'UNITS'
                  ? 'bg-[#0A192F] text-amber-300 ring-2 ring-[#D4AF37]/50'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Building2 size={16} />
              <span>Barcode Pantau Status per Unit ({units.length})</span>
            </button>
          </div>

          {activeTab === 'UNITS' && (
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchUnit}
                onChange={(e) => setSearchUnit(e.target.value)}
                placeholder="Cari nama unit..."
                className="input-base pl-9 text-xs"
              />
            </div>
          )}
        </div>

        {/* Banner Penjelasan Stand Akrilik */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-950 leading-relaxed">
              <p className="font-bold">Panduan Pemasangan Barcode Loket CSSD:</p>
              <p className="mt-0.5">
                Cetak kartu di bawah ini dan masukkan ke dalam <strong>stand akrilik meja loket (ukuran A5 / A6)</strong> di loket penerimaan dan pengambilan CSSD.
                Petugas unit rumah sakit cukup mengarahkan kamera smartphone untuk memantau status alat secara online atau langsung melakukan transaksi serah terima dengan tanda tangan digital di layar HP.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Kartu Loket */}
      {activeTab === 'TRANSAKSI' && (
        <div>
          <div className="no-print mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
              Daftar 6 Barcode Transaksi Loket CSSD SMART
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              6 Kartu Transaksi Tersedia
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-4">
            {transactionCards.map((card) => (
              <CounterCard
                key={card.number}
                number={card.number}
                title={card.title}
                subtitle={card.subtitle}
                category="TRANSAKSI LOKET"
                barcodeValue={card.barcodeValue}
                targetUrl={card.targetUrl}
                instructions={card.instructions}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'UNITS' && (
        <div>
          <div className="no-print mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
              Barcode Monitoring Online per Unit Rumah Sakit
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {filteredUnits.length} Unit Ditemukan
            </span>
          </div>

          {unitsLoading && !units.length ? (
            <div className="card p-8 text-center text-sm text-slate-500">
              Memuat daftar unit rumah sakit...
            </div>
          ) : !filteredUnits.length ? (
            <div className="card p-8 text-center text-sm text-slate-500">
              Tidak ada unit yang sesuai dengan pencarian &quot;{searchUnit}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-4">
              {filteredUnits.map((u, idx) => {
                const targetUrl = `${origin}${ROUTES.UNIT_TRACKING}?unit_id=${u.id}&unit_name=${encodeURIComponent(u.name)}`;
                return (
                  <CounterCard
                    key={u.id}
                    number={idx + 1}
                    title={u.name}
                    subtitle="Monitoring Status Alat Steril & DTT"
                    category="MONITORING UNIT"
                    barcodeValue={`UNIT-${u.code || String(u.id).padStart(3, '0')}`}
                    targetUrl={targetUrl}
                    instructions={`Scan QR Code ini untuk memantau status alat kotor, proses sterilisasi, dan kesiapan pengambilan alat khusus unit ${u.name}.`}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

