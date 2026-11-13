import { BookOpen, Lock, ScanLine } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { FLOW_STAGES, TONES } from '@/utils/constants';

const DETAILS = {
  1: 'Scan/ketik barcode atau terima alat dari unit. Isi unit asal, jenis alat, jumlah, petugas penyerah & penerima, lalu tanda tangan. Barcode AK-DDMMYY-001 dibuat otomatis.',
  2: 'Pilih alat kotor, isi metode (Washer / Manual / Ultrasonik), cairan, waktu, dan petugas.',
  3: 'Centang alat kering sempurna, tidak ada karat/noda, dan fungsi baik. Jika ada yang tidak terpenuhi, alat otomatis kembali ke Pencucian.',
  4: 'Pilih alat yang lolos pemeriksaan, tentukan jenis & bahan kemasan, lalu cetak label barcode paket (AS-/ST-/PG-/KS-).',
  5: 'Pilih mesin (Autoclave 1, 2, atau Plasma), suhu, waktu, dan paket yang disterilkan. No. siklus dan batch dibuat otomatis.',
  6: 'Isi kondisi kemasan, indikator kimia internal & eksternal, indikator biologi, dan Bowie-Dick. Semua sesuai = LULUS, selain itu = GAGAL.',
  7: 'Terisi otomatis hanya dari verifikasi LULUS, lengkap dengan tanggal kedaluwarsa. Verifikasi GAGAL otomatis masuk Karantina.',
  8: 'Scan barcode paket alat steril, pilih unit tujuan dan jumlah. Stok berkurang otomatis; alat kedaluwarsa ditolak.',
  9: 'Sama seperti distribusi alat, khusus untuk kasa steril (barcode KS-).',
};

const TIPS = [
  'Barcode hanya dipakai pada 3 transaksi utama: Alat Kotor Masuk, Pengambilan Alat Steril, dan Pengambilan Kasa Steril.',
  'Setiap tahap terkunci: tahap berikutnya hanya menampilkan data yang sudah selesai di tahap sebelumnya.',
  'Scan lewat kamera HP membutuhkan koneksi HTTPS (atau localhost) dan izin kamera pada browser. Scanner USB/Bluetooth juga didukung — cukup arahkan kursor ke kolom barcode.',
  'Gunakan menu Ketertelusuran untuk melihat seluruh riwayat sebuah alat dari barcode atau nomor batch.',
  'Laporan dapat difilter tanggal, dicetak, atau diunduh sebagai CSV.',
];

export default function GuidePage() {
  return (
    <div>
      <PageHeader title="Panduan" subtitle="Alur kerja CSSD SMART dari alat kotor masuk sampai distribusi alat steril" icon={BookOpen} />

      <ol className="space-y-3">
        {FLOW_STAGES.map((stage) => {
          const tone = TONES[stage.tone];
          return (
            <li key={stage.no} className={`flex gap-4 rounded-2xl border p-4 ${tone.soft}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white ${tone.solid}`}>{stage.no}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={`text-sm font-extrabold ${tone.text}`}>{stage.label}</h2>
                  {stage.barcode && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.chip}`}>
                      <ScanLine size={11} /> Pakai barcode
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{DETAILS[stage.no]}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="card mt-6 p-5">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <Lock size={16} className="text-brand-700" /> Catatan penting
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
