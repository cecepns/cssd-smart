export const TOKEN_KEY = 'cssd_smart_token';
export const SIDEBAR_KEY = 'cssd_smart_sidebar_collapsed';

export const PAGE_LIMITS = [10, 25, 50, 100];
export const DEFAULT_LIMIT = 10;
export const SEARCH_DEBOUNCE_MS = 400;

export const PACKAGE_TYPES = ['Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril'];
export const UNIT_LABELS = ['set', 'pcs', 'buah', 'tabung', 'sungkup', 'pasang', 'lembar', 'rol', 'paket', 'pouch'];
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
    soft: 'bg-gradient-to-br from-white via-rose-50/90 to-rose-100/80 border-rose-200 hover:border-rose-400 hover:shadow-rose-500/15',
    text: 'text-rose-600',
    hoverText: 'group-hover:text-rose-700',
    solid: 'bg-gradient-to-br from-rose-500 to-red-600 shadow-sm shadow-rose-500/30',
    chip: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  pink: {
    soft: 'bg-gradient-to-br from-white via-pink-50/90 to-pink-100/80 border-pink-200 hover:border-pink-400 hover:shadow-pink-500/15',
    text: 'text-pink-600',
    hoverText: 'group-hover:text-pink-700',
    solid: 'bg-gradient-to-br from-pink-500 to-rose-500 shadow-sm shadow-pink-500/30',
    chip: 'bg-pink-100 text-pink-700 border border-pink-200',
  },
  amber: {
    soft: 'bg-gradient-to-br from-white via-amber-50/90 to-amber-100/80 border-amber-200 hover:border-amber-400 hover:shadow-amber-500/15',
    text: 'text-amber-600',
    hoverText: 'group-hover:text-amber-700',
    solid: 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm shadow-amber-500/30',
    chip: 'bg-amber-100 text-amber-800 border border-amber-200',
  },
  blue: {
    soft: 'bg-gradient-to-br from-white via-sky-50/90 to-blue-100/80 border-sky-200 hover:border-sky-400 hover:shadow-sky-500/15',
    text: 'text-sky-600',
    hoverText: 'group-hover:text-blue-700',
    solid: 'bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm shadow-sky-500/30',
    chip: 'bg-sky-100 text-sky-700 border border-sky-200',
  },
  cyan: {
    soft: 'bg-gradient-to-br from-white via-cyan-50/90 to-teal-100/80 border-cyan-200 hover:border-cyan-400 hover:shadow-cyan-500/15',
    text: 'text-cyan-600',
    hoverText: 'group-hover:text-cyan-700',
    solid: 'bg-gradient-to-br from-cyan-400 to-teal-500 shadow-sm shadow-cyan-500/30',
    chip: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  },
  green: {
    soft: 'bg-gradient-to-br from-white via-emerald-50/90 to-emerald-100/80 border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-500/15',
    text: 'text-emerald-600',
    hoverText: 'group-hover:text-emerald-700',
    solid: 'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-sm shadow-emerald-500/30',
    chip: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  purple: {
    soft: 'bg-gradient-to-br from-white via-violet-50/90 to-purple-100/80 border-violet-200 hover:border-violet-400 hover:shadow-violet-500/15',
    text: 'text-violet-600',
    hoverText: 'group-hover:text-violet-700',
    solid: 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm shadow-violet-500/30',
    chip: 'bg-violet-100 text-violet-700 border border-violet-200',
  },
};

/** Alur proses CSSD 8 tahap sesuai referensi live workflow. */
export const FLOW_STAGES = [
  { no: 1, label: 'Penerimaan Alat Kotor', sub: 'Barcode Unit → CSSD', barcode: true, tone: 'red', to: '/alat-kotor' },
  { no: 2, label: 'Dekontaminasi Alat Kotor', sub: 'Pencucian & DTT', tone: 'pink', to: '/pencucian', cssdOnly: true },
  { no: 3, label: 'Pengemasan Alat', sub: 'Pemeriksaan & Packing', tone: 'amber', to: '/pengemasan', cssdOnly: true },
  { no: 4, label: 'Proses Sterilisasi', sub: 'Autoclave / Plasma', tone: 'blue', to: '/sterilisasi', cssdOnly: true },
  { no: 5, label: 'Verifikasi Sterilisasi', sub: 'Uji Indikator & Batch', tone: 'green', to: '/verifikasi', cssdOnly: true },
  { no: 6, label: 'Penyimpanan Alat Steril', sub: 'Stok Siap Pakai', tone: 'cyan', to: '/laporan/stok-steril', adminOnly: true },
  { no: 7, label: 'Pengambilan Alat Steril', sub: 'Barcode CSSD → Unit', barcode: true, tone: 'green', to: '/distribusi-alat' },
  { no: 8, label: 'Pengambilan Kasa Steril', sub: 'Barcode CSSD → Unit', barcode: true, tone: 'green', to: '/distribusi-kasa' },
];
