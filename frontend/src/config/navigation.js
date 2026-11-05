import {
  AlertOctagon,
  Archive,
  BookOpen,
  Boxes,
  Building2,
  ClipboardList,
  Droplets,
  FileText,
  Flame,
  History,
  Home,
  Layers,
  Package,
  RefreshCw,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Truck,
  Wind,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';

/**
 * Struktur sidebar CSSD SMART.
 * allowUnit: true menandakan menu dapat diakses oleh akun Unit Luar.
 * Menu tanpa allowUnit: true hanya dapat diakses oleh Petugas CSSD & Admin.
 */
export const NAV_SECTIONS = [
  { title: null, items: [{ label: 'Beranda', to: ROUTES.HOME, icon: Home, end: true, allowUnit: true }] },
  {
    title: 'Transaksi Barcode Steril',
    items: [
      { label: 'Alat Kotor Masuk', to: ROUTES.RECEIPTS, icon: ScanLine, allowUnit: true },
      { label: 'Monitoring Set Instrumen', to: ROUTES.INSTRUMENT_SETS, icon: Layers },
      { label: 'Distribusi Alat Steril', to: ROUTES.DIST_TOOLS, icon: Truck, allowUnit: true },
      { label: 'Distribusi Kasa Steril', to: ROUTES.DIST_GAUZE, icon: Boxes, allowUnit: true },
    ],
  },
  {
    title: 'Transaksi Barcode DTT (RIUS)',
    items: [
      { label: 'Penerimaan Alat DTT', to: ROUTES.DTT_RECEIPTS, icon: Sparkles, allowUnit: true },
      { label: 'Distribusi Hasil DTT', to: ROUTES.DTT_DISTRIBUTIONS, icon: Truck, allowUnit: true },
      { label: 'Buku Kontrol Reuse DTT', to: ROUTES.DTT_CONTROL, icon: BookOpen },
    ],
  },
  {
    title: 'Proses CSSD (Tanpa Barcode)',
    items: [
      { label: 'Pencucian', to: ROUTES.WASHINGS, icon: Droplets },
      { label: 'Pengeringan & Pemeriksaan', to: ROUTES.DRYINGS, icon: Wind },
      { label: 'Pengemasan', to: ROUTES.PACKAGINGS, icon: Package },
      { label: 'Sterilisasi', to: ROUTES.STERILIZATIONS, icon: Flame },
      { label: 'Verifikasi Sterilisasi', to: ROUTES.VERIFICATIONS, icon: ShieldCheck },
      { label: 'Manajemen Stok BMHP', to: ROUTES.BMHP, icon: Archive },
    ],
  },
  {
    title: 'Laporan',
    items: [
      { label: 'Pusat Laporan Terpadu', to: ROUTES.REPORTS, icon: FileText },
      { label: 'Laporan Alat Kotor', to: ROUTES.REPORT('alat-kotor'), icon: FileText },
      { label: 'Laporan Distribusi Kasa', to: ROUTES.REPORT('distribusi-kasa'), icon: Boxes },
      { label: 'Laporan DTT (RIUS)', to: ROUTES.REPORT('dtt-rius'), icon: Sparkles },
      { label: 'Laporan Ketertelusuran', to: ROUTES.TRACE, icon: History, allowUnit: true },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { label: 'Master Data', to: ROUTES.MASTER_UNITS, icon: Building2, match: '/master', adminOnly: true },
      { label: 'Pengaturan', to: ROUTES.SETTINGS, icon: Settings, allowUnit: true },
    ],
  },
];

/** Kartu "Menu Utama" pada beranda. */
export const MENU_CARDS = [
  { title: 'Penerimaan Alat Kotor Barcode', desc: 'Penerimaan dari unit dengan scan barcode dan TTD digital', to: ROUTES.RECEIPTS, icon: ScanLine, tone: 'red', allowUnit: true },
  { title: 'Dekontaminasi Alat Kotor', desc: 'Pencucian, pembilasan, pengeringan dan pemeriksaan alat', to: ROUTES.WASHINGS, icon: Droplets, tone: 'pink' },
  { title: 'Pengemasan Alat', desc: 'Pemeriksaan, penyusunan dan pengemasan alat steril', to: ROUTES.PACKAGINGS, icon: Package, tone: 'amber' },
  { title: 'Proses Sterilisasi', desc: 'Pencatatan siklus, suhu, waktu (Autoclave, Steam, Plasma)', to: ROUTES.STERILIZATIONS, icon: Flame, tone: 'blue' },
  { title: 'Pengambilan Alat Steril Barcode', desc: 'Alat steril siap diambil unit dengan tanda tangan HP', to: ROUTES.DIST_TOOLS, icon: Truck, tone: 'green', allowUnit: true },
  { title: 'Distribusi Kasa Steril Barcode', desc: 'Distribusi kasa lipat dan rol steril ke unit memakai barcode', to: ROUTES.DIST_GAUZE, icon: Boxes, tone: 'green', allowUnit: true },
  { title: 'Penerimaan Alat Kotor DTT (RIUS)', desc: 'Barcode penerimaan alat kotor DTT unit ke CSSD dengan TTD HP', to: ROUTES.DTT_RECEIPTS, icon: Sparkles, tone: 'purple', allowUnit: true },
  { title: 'Distribusi Alat Hasil DTT (RIUS)', desc: 'Barcode serah terima alat hasil DTT CSSD ke unit dengan TTD HP', to: ROUTES.DTT_DISTRIBUTIONS, icon: RefreshCw, tone: 'blue', allowUnit: true },
  { title: 'Buku Kontrol Reuse DTT', desc: 'Buku kontrol riwayat pemakaian ulang dan batas siklus alat medis', to: ROUTES.DTT_CONTROL, icon: BookOpen, tone: 'purple' },
  { title: 'Indikator Sterilisasi', desc: 'Bowie-Dick, indikator kimia, biologi, dan verifikasi batch', to: ROUTES.VERIFICATIONS, icon: ShieldCheck, tone: 'purple' },
  { title: 'Stok BMHP Barcode', desc: 'Barang masuk, keluar, kedaluwarsa dan mutasi stok BMHP', to: ROUTES.BMHP, icon: Archive, tone: 'amber' },
  { title: 'Pusat Laporan', desc: 'Rekap otomatis seluruh transaksi dan unduh PDF/Excel', to: ROUTES.REPORTS, icon: ClipboardList, tone: 'blue' },
  { title: 'Monitoring Set Instrumen', desc: 'Monitoring kelengkapan instrumen dan riwayat alat rusak/hilang', to: ROUTES.INSTRUMENT_SETS, icon: Layers, tone: 'green' },
  { title: 'Ketertelusuran', desc: 'Lacak riwayat perjalanan alat lengkap dari barcode / batch', to: ROUTES.TRACE, icon: History, tone: 'purple', allowUnit: true },
  { title: 'Master Data & Satuan', desc: 'Pengelolaan unit, master satuan, jenis alat medis, dan mesin', to: ROUTES.MASTER_UNITS, icon: Building2, tone: 'red', adminOnly: true },
];

/** Navigasi bawah pada layar mobile. */
export const BOTTOM_NAV = [
  { label: 'Beranda', to: ROUTES.HOME, icon: Home, end: true },
  { label: 'Riwayat', to: ROUTES.TRACE, icon: History },
  { label: 'Panduan', to: ROUTES.GUIDE, icon: ClipboardList },
  { label: 'Unduhan', to: ROUTES.REPORTS, icon: FileText },
  { label: 'Pengaturan', to: ROUTES.SETTINGS, icon: Settings },
];
