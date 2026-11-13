/** Daftar route halaman frontend (hindari string path di komponen). */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',

  RECEIPTS: '/alat-kotor',
  WASHINGS: '/pencucian',
  DRYINGS: '/pengeringan',
  PACKAGINGS: '/pengemasan',
  STERILIZATIONS: '/sterilisasi',
  VERIFICATIONS: '/verifikasi',
  DIST_TOOLS: '/distribusi-alat',
  DIST_GAUZE: '/distribusi-kasa',
  DTT_RECEIPTS: '/dtt-penerimaan',
  DTT_DISTRIBUTIONS: '/dtt-distribusi',
  DTT_CONTROL: '/dtt-buku-kontrol',
  INSTRUMENT_SETS: '/set-instrumen',

  // Monitoring Log & SLA
  PROCESS_TIMINGS: '/log-waktu-pengerjaan',
  MACHINE_LOGS: '/log-mesin',
  UNIT_REQUISITIONS: '/kebutuhan-alat-unit',

  BMHP: '/bmhp',
  BMHP_IN: '/bmhp/masuk',
  BMHP_OUT: '/bmhp/keluar',
  BMHP_STOCK: '/bmhp/stok',
  BMHP_REPORT: '/bmhp/laporan',

  REPORTS: '/laporan',
  REPORT: (slug) => `/laporan/${slug}`,
  TRACE: '/ketertelusuran',
  COUNTER_BARCODE: '/cetak-barcode-loket',
  UNIT_TRACKING: '/pantau-unit',

  MASTER_UNITS: '/master/unit',
  MASTER_ITEMS: '/master/jenis-alat',
  MASTER_ITEMS_STERIL: '/master/alat-steril',
  MASTER_ITEMS_DTT: '/master/alat-dtt',
  MASTER_MACHINES: '/master/mesin',
  MASTER_OFFICERS: '/master/petugas',
  MASTER_PACKAGING_MATERIALS: '/master/bahan-kemasan',
  MASTER_ITEM_UNITS: '/master/satuan',
  MASTER_USERS: '/master/pengguna',

  GUIDE: '/panduan',
  SETTINGS: '/pengaturan',
};
