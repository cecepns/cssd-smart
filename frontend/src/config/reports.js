import { receiptsConfig, washingsConfig, dryingsConfig, packagingsConfig, sterilizationsConfig, verificationsConfig } from '@/config/resources/process';
import { sterileStockConfig, quarantinesConfig, bmhpItemsConfig, bmhpMutationConfig } from '@/config/resources/stock';
import { distAllConfig } from '@/config/resources/distribution';

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
  'alat-kotor': asReport(receiptsConfig, { key: 'laporan-alat-kotor', title: 'Laporan Alat Kotor', subtitle: 'Rekap penerimaan alat kotor dari unit' }),
  pencucian: asReport(washingsConfig, { key: 'laporan-pencucian', title: 'Laporan Pencucian', subtitle: 'Rekap proses pencucian alat' }),
  pengeringan: asReport(dryingsConfig, { key: 'laporan-pengeringan', title: 'Laporan Pengeringan & Pemeriksaan', subtitle: 'Rekap hasil pengeringan dan pemeriksaan alat' }),
  pengemasan: asReport(packagingsConfig, { key: 'laporan-pengemasan', title: 'Laporan Pengemasan', subtitle: 'Rekap pengemasan beserta label barcode' }),
  sterilisasi: asReport(sterilizationsConfig, { key: 'laporan-sterilisasi', title: 'Laporan Sterilisasi', subtitle: 'Rekap siklus sterilisasi per mesin' }),
  verifikasi: asReport(verificationsConfig, { key: 'laporan-verifikasi', title: 'Laporan Verifikasi Sterilisasi', subtitle: 'Rekap indikator dan hasil verifikasi' }),
  'stok-steril': asReport(sterileStockConfig, { key: 'laporan-stok-alat-steril', title: 'Laporan Stok Alat Steril', subtitle: 'Stok alat steril beserta masa kedaluwarsa' }),
  'stok-bmhp': asReport(bmhpItemsConfig, { key: 'laporan-stok-bmhp', title: 'Laporan Stok BMHP', subtitle: 'Posisi stok dan stok minimum BMHP', dateFilter: false, filters: bmhpItemsConfig.filters }),
  'mutasi-bmhp': asReport(bmhpMutationConfig, { key: 'laporan-mutasi-bmhp', title: 'Laporan Mutasi BMHP', subtitle: 'Barang masuk, keluar, dan sisa stok', fixedParams: undefined }),
  karantina: asReport(quarantinesConfig, { key: 'laporan-karantina-gagal', title: 'Laporan Karantina / Gagal', subtitle: 'Paket yang tidak lulus verifikasi' }),
  distribusi: asReport(distAllConfig, { key: 'laporan-distribusi', title: 'Laporan Distribusi Steril', subtitle: 'Distribusi alat dan kasa steril ke unit' }),
};

/** Metadata untuk halaman hub laporan. */
export const REPORT_LIST = [
  { slug: 'alat-kotor', group: 'Proses CSSD' },
  { slug: 'pencucian', group: 'Proses CSSD' },
  { slug: 'pengeringan', group: 'Proses CSSD' },
  { slug: 'pengemasan', group: 'Proses CSSD' },
  { slug: 'sterilisasi', group: 'Proses CSSD' },
  { slug: 'verifikasi', group: 'Proses CSSD' },
  { slug: 'stok-steril', group: 'Stok & Distribusi' },
  { slug: 'distribusi', group: 'Stok & Distribusi' },
  { slug: 'karantina', group: 'Stok & Distribusi' },
  { slug: 'stok-bmhp', group: 'BMHP' },
  { slug: 'mutasi-bmhp', group: 'BMHP' },
];
