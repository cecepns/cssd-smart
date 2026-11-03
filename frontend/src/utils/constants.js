export const TOKEN_KEY = 'cssd_smart_token';
export const SIDEBAR_KEY = 'cssd_smart_sidebar_collapsed';

export const PAGE_LIMITS = [10, 25, 50, 100];
export const DEFAULT_LIMIT = 10;
export const SEARCH_DEBOUNCE_MS = 400;

export const PACKAGE_TYPES = ['Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril'];
export const UNIT_LABELS = ['set', 'pcs', 'paket', 'lembar', 'pouch'];
export const INDICATOR_OPTIONS = ['Sesuai', 'Tidak Sesuai'];
export const WASH_METHODS = ['Washer', 'Manual', 'Ultrasonik'];

export const STAGE_LABELS = {
  1: 'Alat Kotor Masuk',
  2: 'Pencucian',
  3: 'Pengeringan',
  4: 'Pengemasan',
  5: 'Sterilisasi',
  6: 'Verifikasi',
};

/** Kelas Tailwind ditulis lengkap agar tidak terhapus oleh purge. */
export const TONES = {
  red: {
    soft: 'bg-rose-50 border-rose-200 hover:border-rose-300',
    text: 'text-rose-700',
    solid: 'bg-rose-600',
    chip: 'bg-rose-100 text-rose-700',
  },
  amber: {
    soft: 'bg-amber-50 border-amber-200 hover:border-amber-300',
    text: 'text-amber-700',
    solid: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-700',
  },
  blue: {
    soft: 'bg-sky-50 border-sky-200 hover:border-sky-300',
    text: 'text-sky-700',
    solid: 'bg-sky-600',
    chip: 'bg-sky-100 text-sky-700',
  },
  green: {
    soft: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300',
    text: 'text-emerald-700',
    solid: 'bg-emerald-600',
    chip: 'bg-emerald-100 text-emerald-700',
  },
  purple: {
    soft: 'bg-violet-50 border-violet-200 hover:border-violet-300',
    text: 'text-violet-700',
    solid: 'bg-violet-600',
    chip: 'bg-violet-100 text-violet-700',
  },
};

/** Alur proses CSSD (9 tahap). Barcode hanya pada 3 transaksi utama. */
export const FLOW_STAGES = [
  { no: 1, label: 'Alat Kotor Masuk', sub: 'pakai barcode', barcode: true, tone: 'blue', to: '/alat-kotor' },
  { no: 2, label: 'Pencucian', sub: 'DTT / Washer', tone: 'green', to: '/pencucian' },
  { no: 3, label: 'Pengeringan & Pemeriksaan', sub: 'Cek kering, karat, fungsi', tone: 'amber', to: '/pengeringan' },
  { no: 4, label: 'Pengemasan', sub: 'Duk & Jas, Kasa, Instrumen', tone: 'amber', to: '/pengemasan' },
  { no: 5, label: 'Sterilisasi', sub: 'Autoclave 1, 2, Plasma', tone: 'red', to: '/sterilisasi' },
  { no: 6, label: 'Verifikasi Sterilisasi', sub: 'Indikator & Bowie-Dick', tone: 'green', to: '/verifikasi' },
  { no: 7, label: 'Stok Alat Steril', sub: 'hanya verifikasi lulus', tone: 'purple', to: '/laporan/stok-steril' },
  { no: 8, label: 'Distribusi Alat Steril', sub: 'pakai barcode', barcode: true, tone: 'blue', to: '/distribusi-alat' },
  { no: 9, label: 'Distribusi Kasa Steril', sub: 'pakai barcode', barcode: true, tone: 'purple', to: '/distribusi-kasa' },
];
