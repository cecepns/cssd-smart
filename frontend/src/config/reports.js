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
  'alat-kotor': asReport(receiptsConfig, { key: 'laporan-alat-kotor', title: '1. Laporan Alat Kotor', subtitle: 'Rekap penerimaan alat kotor dari unit rumah sakit' }),
  pencucian: asReport(washingsConfig, { key: 'laporan-pencucian', title: '2. Laporan Pencucian', subtitle: 'Rekap proses dekontaminasi dan pencucian alat (Washer & DTT)' }),
  pengeringan: asReport(dryingsConfig, { key: 'laporan-pengeringan', title: '3. Laporan Pengeringan', subtitle: 'Rekap hasil pengeringan, cek karat, dan pemeriksaan fungsi alat' }),
  pengemasan: asReport(packagingsConfig, { key: 'laporan-pengemasan', title: '4. Laporan Pengemasan', subtitle: 'Rekap pengemasan beserta label barcode paket instrumen' }),
  sterilisasi: asReport(sterilizationsConfig, { key: 'laporan-sterilisasi', title: '5. Laporan Sterilisasi', subtitle: 'Rekap siklus sterilisasi Autoclave 1, 2, Steam, dan Plasma' }),
  verifikasi: asReport(verificationsConfig, { key: 'laporan-verifikasi', title: '6. Laporan Verifikasi', subtitle: 'Rekap hasil indikator kimia, biologi, Bowie-Dick, dan verifikasi mutu' }),
  'stok-steril': asReport(sterileStockConfig, { key: 'laporan-stok-alat-steril', title: '7. Laporan Stok Alat Steril', subtitle: 'Stok alat steril tersedia beserta masa kedaluwarsa' }),
  'distribusi-alat': asReport(distToolsConfig, { key: 'laporan-distribusi-alat', title: '8. Laporan Distribusi Alat Steril', subtitle: 'Rekap penyerahan alat steril ke unit beserta bukti tanda tangan layar HP' }),
  'distribusi-kasa': asReport(distGauzeConfig, { key: 'laporan-distribusi-kasa', title: '9. Laporan Distribusi Kasa Steril', subtitle: 'Rekap distribusi kasa steril lengkap jenis kasa, jumlah, unit, dan tanda tangan digital' }),
  'distribusi-dtt': asReport(dttDistributionsConfig, { key: 'laporan-distribusi-dtt', title: '10. Laporan Distribusi Alat DTT', subtitle: 'Rekap serah terima kembali alat hasil DTT ke unit dengan tanda tangan' }),
  'stok-bmhp': asReport(bmhpItemsConfig, { key: 'laporan-stok-bmhp', title: '11. Laporan Stok BMHP', subtitle: 'Posisi stok dan stok minimum barang medis habis pakai', dateFilter: false, filters: bmhpItemsConfig.filters }),
  karantina: asReport(quarantinesConfig, { key: 'laporan-karantina-gagal', title: '12. Laporan Karantina/Gagal', subtitle: 'Paket tidak lulus verifikasi dan riwayat penanganan' }),
  'dtt-rius': asReport(dttReceiptsConfig, { key: 'laporan-dtt-rius', title: 'Laporan Penerimaan DTT (RIUS)', subtitle: 'Buku kontrol digital penggunaan ulang alat medis (reuse count), kondisi fisik, dan serah terima' }),
  distribusi: asReport(distAllConfig, { key: 'laporan-distribusi-gabungan', title: 'Laporan Distribusi Gabungan', subtitle: 'Rekap gabungan distribusi alat dan kasa steril ke seluruh unit' }),
  'mutasi-bmhp': asReport(bmhpMutationConfig, { key: 'laporan-mutasi-bmhp', title: 'Laporan Mutasi BMHP', subtitle: 'Barang masuk, keluar, dan kartu stok BMHP', fixedParams: undefined }),
};

/** Metadata untuk halaman hub laporan sesuai susunan referensi client. */
export const REPORT_LIST = [
  { slug: 'alat-kotor', label: '1. Laporan Alat Kotor', group: 'Alur Proses CSSD' },
  { slug: 'pencucian', label: '2. Laporan Pencucian', group: 'Alur Proses CSSD' },
  { slug: 'pengeringan', label: '3. Laporan Pengeringan', group: 'Alur Proses CSSD' },
  { slug: 'pengemasan', label: '4. Laporan Pengemasan', group: 'Alur Proses CSSD' },
  { slug: 'sterilisasi', label: '5. Laporan Sterilisasi', group: 'Alur Proses CSSD' },
  { slug: 'verifikasi', label: '6. Laporan Verifikasi', group: 'Alur Proses CSSD' },
  { slug: 'stok-steril', label: '7. Laporan Stok Alat Steril', group: 'Stok & Distribusi' },
  { slug: 'distribusi-alat', label: '8. Laporan Distribusi Alat Steril', group: 'Stok & Distribusi' },
  { slug: 'distribusi-kasa', label: '9. Laporan Distribusi Kasa Steril', group: 'Stok & Distribusi' },
  { slug: 'distribusi-dtt', label: '10. Laporan Distribusi Alat DTT', group: 'DTT (RIUS)' },
  { slug: 'stok-bmhp', label: '11. Laporan Stok BMHP', group: 'Inventaris BMHP' },
  { slug: 'karantina', label: '12. Laporan Karantina/Gagal', group: 'Alur Proses CSSD' },
  { slug: 'ketertelusuran', label: '13. Laporan Ketertelusuran', group: 'Pelacakan Digital' },
];
