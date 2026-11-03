import {
  AlertOctagon,
  Archive,
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
  ScanLine,
  Settings,
  ShieldCheck,
  Truck,
  Wind,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';

/** Struktur sidebar (mengikuti alur: transaksi barcode, proses tanpa barcode, laporan). */
export const NAV_SECTIONS = [
  { title: null, items: [{ label: 'Beranda', to: ROUTES.HOME, icon: Home, end: true }] },
  {
    title: 'Transaksi Utama (Pakai Barcode)',
    items: [
      { label: 'Alat Kotor Masuk', to: ROUTES.RECEIPTS, icon: ScanLine },
      { label: 'Monitoring Set Instrumen', to: ROUTES.INSTRUMENT_SETS, icon: Layers },
      { label: 'Distribusi Alat Steril', to: ROUTES.DIST_TOOLS, icon: Truck },
      { label: 'Distribusi Kasa Steril', to: ROUTES.DIST_GAUZE, icon: Boxes },
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
      { label: 'Laporan Alat Kotor', to: ROUTES.REPORT('alat-kotor'), icon: FileText },
      { label: 'Laporan Pencucian', to: ROUTES.REPORT('pencucian'), icon: FileText },
      { label: 'Laporan Pengeringan', to: ROUTES.REPORT('pengeringan'), icon: FileText },
      { label: 'Laporan Pengemasan', to: ROUTES.REPORT('pengemasan'), icon: FileText },
      { label: 'Laporan Sterilisasi', to: ROUTES.REPORT('sterilisasi'), icon: FileText },
      { label: 'Laporan Verifikasi', to: ROUTES.REPORT('verifikasi'), icon: FileText },
      { label: 'Laporan Stok Alat Steril', to: ROUTES.REPORT('stok-steril'), icon: Layers },
      { label: 'Laporan Stok BMHP', to: ROUTES.REPORT('stok-bmhp'), icon: Archive },
      { label: 'Laporan Karantina / Gagal', to: ROUTES.REPORT('karantina'), icon: AlertOctagon },
      { label: 'Laporan Ketertelusuran', to: ROUTES.TRACE, icon: History },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { label: 'Master Data', to: ROUTES.MASTER_UNITS, icon: Building2, match: '/master', adminOnly: true },
      { label: 'Pengaturan', to: ROUTES.SETTINGS, icon: Settings },
    ],
  },
];

/** Kartu "Menu Utama" pada beranda. `tone` merujuk ke TONES di utils/constants. */
export const MENU_CARDS = [
  { title: 'Alat Kotor Masuk', desc: 'Penerimaan dari unit memakai barcode / kamera HP', to: ROUTES.RECEIPTS, icon: ScanLine, tone: 'red' },
  { title: 'Monitoring Set Instrumen', desc: 'Monitoring stok, kelengkapan, dan riwayat alat hilang/rusak per set', to: ROUTES.INSTRUMENT_SETS, icon: Layers, tone: 'green' },
  { title: 'Pencucian', desc: 'Pencucian dengan Washer / DTT, cairan dan waktu', to: ROUTES.WASHINGS, icon: Droplets, tone: 'blue' },
  { title: 'Pengeringan & Pemeriksaan', desc: 'Cek kering, bebas karat, dan fungsi alat', to: ROUTES.DRYINGS, icon: Wind, tone: 'amber' },
  { title: 'Pengemasan', desc: 'Penyusunan, kemasan, dan label barcode paket', to: ROUTES.PACKAGINGS, icon: Package, tone: 'amber' },
  { title: 'Sterilisasi', desc: 'Siklus, suhu, waktu Autoclave 1, 2, dan Plasma', to: ROUTES.STERILIZATIONS, icon: Flame, tone: 'red' },
  { title: 'Verifikasi Sterilisasi', desc: 'Indikator kimia, biologi, Bowie-Dick', to: ROUTES.VERIFICATIONS, icon: ShieldCheck, tone: 'purple' },
  { title: 'Distribusi Alat Steril', desc: 'Alat steril siap diambil unit memakai barcode', to: ROUTES.DIST_TOOLS, icon: Truck, tone: 'green' },
  { title: 'Distribusi Kasa Steril', desc: 'Distribusi kasa steril ke unit memakai barcode', to: ROUTES.DIST_GAUZE, icon: Boxes, tone: 'green' },
  { title: 'Stok BMHP Barcode', desc: 'Barang masuk, keluar, dan kedaluwarsa', to: ROUTES.BMHP, icon: Archive, tone: 'amber' },
  { title: 'Laporan', desc: 'Rekap otomatis transaksi dan stok', to: ROUTES.REPORTS, icon: ClipboardList, tone: 'blue' },
  { title: 'Ketertelusuran', desc: 'Lacak riwayat alat dari barcode atau batch', to: ROUTES.TRACE, icon: History, tone: 'purple' },
  { title: 'Data Unit', desc: 'Daftar unit, penanggung jawab dan riwayat', to: ROUTES.MASTER_UNITS, icon: Building2, tone: 'red', adminOnly: true },
];

/** Navigasi bawah pada layar mobile. */
export const BOTTOM_NAV = [
  { label: 'Beranda', to: ROUTES.HOME, icon: Home, end: true },
  { label: 'Riwayat', to: ROUTES.TRACE, icon: History },
  { label: 'Panduan', to: ROUTES.GUIDE, icon: ClipboardList },
  { label: 'Unduhan', to: ROUTES.REPORTS, icon: FileText },
  { label: 'Pengaturan', to: ROUTES.SETTINGS, icon: Settings },
];
