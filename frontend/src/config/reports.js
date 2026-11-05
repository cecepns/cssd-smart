import { receiptsConfig, washingsConfig, dryingsConfig, packagingsConfig, sterilizationsConfig, verificationsConfig } from '@/config/resources/process';
import { sterileStockConfig, quarantinesConfig, bmhpItemsConfig, bmhpMutationConfig } from '@/config/resources/stock';
import { distAllConfig, distToolsConfig, distGauzeConfig } from '@/config/resources/distribution';
import { dttReceiptsConfig, dttDistributionsConfig, dttControlConfig } from '@/config/resources/dtt';

/** Ubah konfigurasi data menjadi konfigurasi laporan (read-only, bisa dicetak & diunduh). */
const asReport = (config, overrides = {}) => ({
  ...config,
  readOnly: true,
  report: true,
  tabs: undefined,
  dateFilter: true,
  ...overrides,
});

export const REPORTS = {
  'alat-kotor': asReport(receiptsConfig, { key: 'laporan-alat-kotor', title: 'Laporan Penerimaan Alat Kotor', subtitle: 'Rekap penerimaan alat kotor dari unit rumah sakit' }),
  pencucian: asReport(washingsConfig, { key: 'laporan-pencucian', title: 'Laporan Pencucian', subtitle: 'Rekap proses pencucian alat (Washer & DTT)' }),
  pengeringan: asReport(dryingsConfig, { key: 'laporan-pengeringan', title: 'Laporan Pengeringan & Pemeriksaan', subtitle: 'Rekap hasil pengeringan, cek karat, dan uji fungsi alat' }),
  pengemasan: asReport(packagingsConfig, { key: 'laporan-pengemasan', title: 'Laporan Pengemasan', subtitle: 'Rekap pengemasan beserta label barcode paket' }),
  sterilisasi: asReport(sterilizationsConfig, { key: 'laporan-sterilisasi', title: 'Laporan Sterilisasi', subtitle: 'Rekap siklus sterilisasi Autoclave 1, 2, Steam, dan Plasma' }),
  verifikasi: asReport(verificationsConfig, { key: 'laporan-verifikasi', title: 'Laporan Verifikasi Sterilisasi', subtitle: 'Rekap indikator kimia, biologi, Bowie-Dick, dan kelulusan' }),
  karantina: asReport(quarantinesConfig, { key: 'laporan-karantina-gagal', title: 'Laporan Karantina / Gagal', subtitle: 'Paket tidak lulus verifikasi dan riwayat penanganan' }),
  'distribusi-alat': asReport(distToolsConfig, { key: 'laporan-distribusi-alat', title: 'Laporan Distribusi Alat Steril', subtitle: 'Rekap penyerahan alat steril ke unit beserta bukti tanda tangan layar HP' }),
  'distribusi-kasa': asReport(distGauzeConfig, { key: 'laporan-distribusi-kasa', title: 'Laporan Distribusi Kasa Steril', subtitle: 'Rekap distribusi kasa steril lengkap jenis kasa, jumlah, unit, dan tanda tangan digital' }),
  distribusi: asReport(distAllConfig, { key: 'laporan-distribusi', title: 'Laporan Distribusi Steril (Alat & Kasa)', subtitle: 'Rekap gabungan distribusi alat dan kasa steril ke seluruh unit' }),
  'dtt-rius': asReport(dttReceiptsConfig, { key: 'laporan-dtt-rius', title: 'Laporan DTT (RIUS) & Buku Kontrol', subtitle: 'Buku kontrol digital penggunaan ulang alat medis (reuse count), kondisi fisik, dan serah terima' }),
  'dtt-distribusi': asReport(dttDistributionsConfig, { key: 'laporan-dtt-distribusi', title: 'Laporan Distribusi Alat Hasil DTT (RIUS)', subtitle: 'Rekap serah terima kembali alat hasil DTT ke unit dengan tanda tangan' }),
  'stok-steril': asReport(sterileStockConfig, { key: 'laporan-stok-alat-steril', title: 'Laporan Stok Alat Steril', subtitle: 'Stok alat steril tersedia beserta masa kedaluwarsa' }),
  'stok-bmhp': asReport(bmhpItemsConfig, { key: 'laporan-stok-bmhp', title: 'Laporan Stok BMHP', subtitle: 'Posisi stok dan stok minimum barang medis habis pakai', dateFilter: false, filters: bmhpItemsConfig.filters }),
  'mutasi-bmhp': asReport(bmhpMutationConfig, { key: 'laporan-mutasi-bmhp', title: 'Laporan Mutasi BMHP', subtitle: 'Barang masuk, keluar, dan kartu stok BMHP', fixedParams: undefined }),
};

/** Metadata untuk halaman hub laporan. */
export const REPORT_LIST = [
  { slug: 'alat-kotor', label: '1. Penerimaan Alat Kotor', group: 'Proses CSSD' },
  { slug: 'pencucian', label: '2. Pencucian', group: 'Proses CSSD' },
  { slug: 'pengeringan', label: '3. Pengeringan & Pemeriksaan', group: 'Proses CSSD' },
  { slug: 'pengemasan', label: '4. Pengemasan', group: 'Proses CSSD' },
  { slug: 'sterilisasi', label: '5. Sterilisasi', group: 'Proses CSSD' },
  { slug: 'verifikasi', label: '6. Verifikasi Sterilisasi', group: 'Proses CSSD' },
  { slug: 'karantina', label: '7. Karantina / Gagal', group: 'Proses CSSD' },
  { slug: 'distribusi-alat', label: '8. Distribusi Alat Steril', group: 'Distribusi & Serah Terima' },
  { slug: 'distribusi-kasa', label: '9. Distribusi Kasa Steril', group: 'Distribusi & Serah Terima' },
  { slug: 'dtt-rius', label: '10. DTT (RIUS) & Buku Kontrol', group: 'DTT & Penggunaan Ulang' },
  { slug: 'dtt-distribusi', label: '11. Distribusi Hasil DTT', group: 'DTT & Penggunaan Ulang' },
  { slug: 'stok-steril', label: '12. Stok Alat Steril', group: 'Stok & Inventaris' },
  { slug: 'stok-bmhp', label: '13. Stok BMHP', group: 'Stok & Inventaris' },
  { slug: 'mutasi-bmhp', label: '14. Mutasi BMHP', group: 'Stok & Inventaris' },
];
