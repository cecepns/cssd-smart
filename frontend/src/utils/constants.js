export const TOKEN_KEY = 'cssd_smart_token';
export const SIDEBAR_KEY = 'cssd_smart_sidebar_collapsed';

export const PAGE_LIMITS = [10, 25, 50, 100];
export const DEFAULT_LIMIT = 10;
export const SEARCH_DEBOUNCE_MS = 400;

export const PACKAGE_TYPES = ['Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril'];
export const UNIT_LABELS = ['set', 'pcs', 'tabung', 'sungkup', 'pasang', 'lembar', 'rol', 'paket', 'pouch'];
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
  pink: {
    soft: 'bg-pink-50 border-pink-200 hover:border-pink-300',
    text: 'text-pink-700',
    solid: 'bg-pink-600',
    chip: 'bg-pink-100 text-pink-700',
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
  cyan: {
    soft: 'bg-cyan-50 border-cyan-200 hover:border-cyan-300',
    text: 'text-cyan-700',
    solid: 'bg-cyan-600',
    chip: 'bg-cyan-100 text-cyan-700',
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

/** Alur proses CSSD 8 tahap sesuai referensi live workflow. */
export const FLOW_STAGES = [
  { no: 1, label: 'Penerimaan Alat Kotor', sub: 'Barcode Unit → CSSD', barcode: true, tone: 'red', to: '/alat-kotor' },
  { no: 2, label: 'Dekontaminasi Alat Kotor', sub: 'Pencucian & DTT', tone: 'pink', to: '/pencucian' },
  { no: 3, label: 'Pengemasan Alat', sub: 'Pemeriksaan & Packing', tone: 'amber', to: '/pengemasan' },
  { no: 4, label: 'Proses Sterilisasi', sub: 'Autoclave / Plasma', tone: 'blue', to: '/sterilisasi' },
  { no: 5, label: 'Verifikasi Sterilisasi', sub: 'Uji Indikator & Batch', tone: 'green', to: '/verifikasi' },
  { no: 6, label: 'Penyimpanan Alat Steril', sub: 'Stok Siap Pakai', tone: 'cyan', to: '/laporan?jenis=stok-steril' },
  { no: 7, label: 'Pengambilan Alat Steril', sub: 'Barcode CSSD → Unit', barcode: true, tone: 'green', to: '/distribusi-alat' },
  { no: 8, label: 'Distribusi Kasa Steril', sub: 'Barcode CSSD → Unit', barcode: true, tone: 'green', to: '/distribusi-kasa' },
];
