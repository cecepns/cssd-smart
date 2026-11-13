import {
  AlertOctagon,
  Archive,
  BookOpen,
  Boxes,
  Building2,
  ClipboardList,
  Clock,
  Cpu,
  Droplets,
  FilePlus2,
  FileText,
  Flame,
  History,
  Home,
  Layers,
  Package,
  QrCode,
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
      { label: 'Permintaan Alat Unit', to: ROUTES.UNIT_REQUISITIONS, icon: ClipboardList, allowUnit: true },
      { label: 'Monitoring Set Instrumen', to: ROUTES.INSTRUMENT_SETS, icon: Layers, allowUnit: true },
      { label: 'Distribusi Alat Steril', to: ROUTES.DIST_TOOLS, icon: Truck, allowUnit: true },
      { label: 'Distribusi Kasa Steril', to: ROUTES.DIST_GAUZE, icon: Boxes, allowUnit: true },
    ],
  },
  {
    title: 'Transaksi Barcode DTT (Reuse)',
    items: [
      { label: 'Penerimaan Alat DTT', to: ROUTES.DTT_RECEIPTS, icon: Sparkles, allowUnit: true },
      { label: 'Distribusi Hasil DTT', to: ROUTES.DTT_DISTRIBUTIONS, icon: Truck, allowUnit: true },
      { label: 'Buku Kontrol Reuse DTT', to: ROUTES.DTT_CONTROL, icon: BookOpen },
    ],
  },
  {
    title: 'Proses CSSD (Tanpa Barcode)',
    items: [
      { label: 'Pencucian', to: ROUTES.WASHINGS, icon: Droplets, adminOnly: true },
      { label: 'Pengeringan & Pemeriksaan', to: ROUTES.DRYINGS, icon: Wind, adminOnly: true },
      { label: 'Pengemasan', to: ROUTES.PACKAGINGS, icon: Package, adminOnly: true },
      { label: 'Sterilisasi', to: ROUTES.STERILIZATIONS, icon: Flame, adminOnly: true },
      { label: 'Verifikasi Sterilisasi', to: ROUTES.VERIFICATIONS, icon: ShieldCheck, adminOnly: true },
      { label: 'Log Mesin Washer & Steam', to: ROUTES.MACHINE_LOGS, icon: Cpu, adminOnly: true },
      { label: 'Log Waktu Pengerjaan', to: ROUTES.PROCESS_TIMINGS, icon: Clock, adminOnly: true },
      { label: 'Manajemen Stok BMHP', to: ROUTES.BMHP, icon: Archive, adminOnly: true },
    ],
  },
  {
    title: 'Laporan',
    items: [
      { label: 'Pusat Laporan Terpadu', to: ROUTES.REPORTS, icon: FileText, adminOnly: true },
      { label: 'Laporan Alat Kotor', to: ROUTES.REPORT('alat-kotor'), icon: FileText, adminOnly: true },
      { label: 'Laporan Distribusi Kasa', to: ROUTES.REPORT('distribusi-kasa'), icon: Boxes, adminOnly: true },
      { label: 'Laporan DTT (Reuse)', to: ROUTES.REPORT('dtt-reuse'), icon: Sparkles, adminOnly: true },
      { label: 'Laporan Ketertelusuran', to: ROUTES.TRACE, icon: History, allowUnit: true },
      { label: 'Pantau Status Alat Unit', to: ROUTES.UNIT_TRACKING, icon: ScanLine, allowUnit: true },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { label: 'Cetak Barcode Loket', to: ROUTES.COUNTER_BARCODE, icon: QrCode, adminOnly: true },
      { label: 'Master Data', to: ROUTES.MASTER_UNITS, icon: Building2, match: '/master', adminOnly: true },
      { label: 'Pengaturan', to: ROUTES.SETTINGS, icon: Settings, allowUnit: true },
    ],
  },
];

/** Kartu "Menu Utama" pada beranda. */
export const MENU_CARDS = [
  { title: 'Penerimaan Alat Kotor Barcode', desc: 'Penerimaan dari unit dengan scan barcode dan TTD digital', to: ROUTES.RECEIPTS, icon: ScanLine, tone: 'red', allowUnit: true },
  { title: 'Permintaan Alat & Set Unit', desc: 'Input kebutuhan alat untuk beberapa operasi dan pengajuan alat/set baru', to: ROUTES.UNIT_REQUISITIONS, icon: ClipboardList, tone: 'amber', allowUnit: true },
  { title: 'Dekontaminasi Alat Kotor', desc: 'Pencucian, pembilasan, pengeringan dan pemeriksaan alat', to: ROUTES.WASHINGS, icon: Droplets, tone: 'pink', adminOnly: true },
  { title: 'Pengemasan Alat', desc: 'Pemeriksaan, penyusunan dan pengemasan alat steril', to: ROUTES.PACKAGINGS, icon: Package, tone: 'amber', adminOnly: true },
  { title: 'Proses Sterilisasi', desc: 'Pencatatan siklus, suhu, waktu (Autoclave, Steam, Plasma)', to: ROUTES.STERILIZATIONS, icon: Flame, tone: 'blue', adminOnly: true },
  { title: 'Log Mesin Washer & Steam', desc: 'Pencatatan siklus, operator, waktu proses, serta catatan kendala mesin', to: ROUTES.MACHINE_LOGS, icon: Cpu, tone: 'blue', adminOnly: true },
  { title: 'Log Waktu Pengerjaan Alat', desc: 'Pemantauan durasi proses, waktu tunggu, dan ketepatan SLA tiap tahapan CSSD', to: ROUTES.PROCESS_TIMINGS, icon: Clock, tone: 'purple', adminOnly: true },
  { title: 'Pengambilan Alat Steril Barcode', desc: 'Alat steril siap diambil unit dengan tanda tangan HP', to: ROUTES.DIST_TOOLS, icon: Truck, tone: 'green', allowUnit: true },
  { title: 'Distribusi Kasa Steril Barcode', desc: 'Distribusi kasa lipat dan rol steril ke unit memakai barcode', to: ROUTES.DIST_GAUZE, icon: Boxes, tone: 'green', allowUnit: true },
  { title: 'Penerimaan Alat Kotor DTT (Reuse)', desc: 'Barcode penerimaan alat kotor DTT unit ke CSSD dengan TTD HP', to: ROUTES.DTT_RECEIPTS, icon: Sparkles, tone: 'purple', allowUnit: true },
  { title: 'Distribusi Alat Hasil DTT (Reuse)', desc: 'Barcode serah terima alat hasil DTT CSSD ke unit dengan TTD HP', to: ROUTES.DTT_DISTRIBUTIONS, icon: RefreshCw, tone: 'blue', allowUnit: true },
  { title: 'Buku Kontrol Reuse DTT', desc: 'Buku kontrol riwayat pemakaian ulang dan batas siklus alat medis', to: ROUTES.DTT_CONTROL, icon: BookOpen, tone: 'purple', adminOnly: true },
  { title: 'Indikator Sterilisasi', desc: 'Bowie-Dick, indikator kimia, biologi, dan verifikasi batch', to: ROUTES.VERIFICATIONS, icon: ShieldCheck, tone: 'purple', adminOnly: true },
  { title: 'Stok BMHP Barcode', desc: 'Barang masuk, keluar, kedaluwarsa dan mutasi stok BMHP', to: ROUTES.BMHP, icon: Archive, tone: 'amber', adminOnly: true },
  { title: 'Pusat Laporan', desc: 'Rekap otomatis seluruh transaksi dan unduh PDF/Excel', to: ROUTES.REPORTS, icon: ClipboardList, tone: 'blue', adminOnly: true },
  { title: 'Generate & Cetak Barcode Loket', desc: 'Cetak 6 barcode transaksi dan barcode monitoring khusus unit untuk ditempel di loket CSSD', to: ROUTES.COUNTER_BARCODE, icon: QrCode, tone: 'amber', adminOnly: true },
  { title: 'Monitoring Set Instrumen', desc: 'Monitoring kelengkapan instrumen dan riwayat alat rusak/hilang', to: ROUTES.INSTRUMENT_SETS, icon: Layers, tone: 'green', allowUnit: true },
  { title: 'Ketertelusuran', desc: 'Lacak riwayat perjalanan alat lengkap dari barcode / batch', to: ROUTES.TRACE, icon: History, tone: 'purple', allowUnit: true },
  { title: 'Master Data & Satuan', desc: 'Pengelolaan unit, master satuan, jenis alat medis, dan mesin', to: ROUTES.MASTER_UNITS, icon: Building2, tone: 'red', adminOnly: true },
];

/** Navigasi bawah pada layar mobile. */
export const BOTTOM_NAV = [
  { label: 'Beranda', to: ROUTES.HOME, icon: Home, end: true, allowUnit: true },
  { label: 'Riwayat', to: ROUTES.TRACE, icon: History, allowUnit: true },
  { label: 'Panduan', to: ROUTES.GUIDE, icon: ClipboardList, allowUnit: true },
  { label: 'Unduhan', to: ROUTES.REPORTS, icon: FileText, adminOnly: true },
  { label: 'Pengaturan', to: ROUTES.SETTINGS, icon: Settings, allowUnit: true },
];
