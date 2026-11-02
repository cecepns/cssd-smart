import { AlertOctagon, ArrowDownToLine, ArrowUpFromLine, Archive, ClipboardList, Layers } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { PACKAGE_TYPES } from '@/utils/constants';
import { getList } from '@/utils/request';
import { formatDate, todayISO } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { badge, bold, date, dateTime, expiry, mono, qty } from '@/config/cells';
import { ROUTES } from '@/config/routes';
import { officerSelectField } from '@/config/officerField';

/* ---------------------------------- Stok Alat Steril ---------------------------------- */
export const sterileStockConfig = {
  key: 'stok-alat-steril',
  title: 'Stok Alat Steril',
  subtitle: 'Terisi otomatis hanya dari verifikasi yang LULUS',
  icon: Layers,
  endpoint: API_ENDPOINTS.STERILE_STOCK,
  readOnly: true,
  searchPlaceholder: 'Cari nama alat, barcode, batch...',
  dateFilter: true,
  filters: [
    { name: 'category', label: 'Kategori', options: PACKAGE_TYPES },
    { name: 'status', label: 'Status', options: ['Tersedia', 'Terdistribusi', 'Kedaluwarsa'] },
  ],
  columns: [
    { key: 'item_name', label: 'Nama Alat', sortable: true, render: bold('item_name') },
    { key: 'category', label: 'Kategori', sortable: true },
    { key: 'barcode', label: 'Barcode', sortable: true, render: mono('barcode') },
    { key: 'batch_no', label: 'Batch', sortable: true, render: mono('batch_no') },
    { key: 'sterile_date', label: 'Tgl Steril', sortable: true, render: date('sterile_date') },
    { key: 'expiry_date', label: 'Kedaluwarsa', sortable: true, render: expiry },
    { key: 'quantity', label: 'Sisa', sortable: true, render: qty() },
    { key: 'display_status', label: 'Status', render: badge('display_status') },
  ],
  traceField: 'barcode',
  label: (row) => ({ code: row.barcode, title: row.item_name, subtitle: `Steril ${formatDate(row.sterile_date)} • Exp ${formatDate(row.expiry_date)}` }),
};

/* ---------------------------------- Karantina / Gagal ---------------------------------- */
export const quarantinesConfig = {
  key: 'karantina-gagal',
  title: 'Karantina / Gagal',
  subtitle: 'Otomatis dari verifikasi sterilisasi yang tidak lulus',
  icon: AlertOctagon,
  endpoint: API_ENDPOINTS.QUARANTINES,
  noCreate: true,
  canEdit: true,
  searchPlaceholder: 'Cari barcode, batch, alasan...',
  dateFilter: true,
  filters: [{ name: 'status', label: 'Status', options: ['Karantina', 'Diproses ulang', 'Dimusnahkan'] }],
  columns: [
    { key: 'barcode', label: 'Barcode', sortable: true, render: mono('barcode') },
    { key: 'created_at', label: 'Waktu', sortable: true, render: dateTime('created_at') },
    { key: 'batch_no', label: 'Batch / Siklus', sortable: true, render: mono('batch_no') },
    { key: 'reason', label: 'Alasan Gagal' },
    { key: 'status', label: 'Status', sortable: true, render: badge('status') },
    { key: 'notes', label: 'Catatan' },
  ],
  traceField: 'barcode',
  form: {
    editTitle: 'Tindak Lanjut Karantina',
    subtitle: 'Pilih "Diproses ulang" agar paket kembali ke tahap Pengemasan untuk disterilkan ulang.',
    fields: [
      { name: 'status', label: 'Status', type: 'select', required: true, options: ['Karantina', 'Diproses ulang', 'Dimusnahkan'], span: 2 },
      { name: 'notes', label: 'Catatan', type: 'textarea', maxLength: 500 },
    ],
  },
};

/* ---------------------------------- BMHP ---------------------------------- */
export const BMHP_TABS = [
  { label: 'Ringkasan', to: ROUTES.BMHP },
  { label: 'Barang Masuk', to: ROUTES.BMHP_IN, icon: ArrowDownToLine },
  { label: 'Pengambilan', to: ROUTES.BMHP_OUT, icon: ArrowUpFromLine },
  { label: 'Stok BMHP', to: ROUTES.BMHP_STOCK, icon: Archive },
  { label: 'Laporan', to: ROUTES.BMHP_REPORT, icon: ClipboardList },
];

const stockStatus = (row) => {
  if (row.stock <= 0) return <Badge tone="rose">Habis</Badge>;
  return row.is_low ? <Badge tone="amber">Menipis</Badge> : <Badge tone="emerald">Aman</Badge>;
};

export const bmhpItemsConfig = {
  key: 'stok-bmhp',
  title: 'Stok BMHP',
  subtitle: 'Barang Medis Habis Pakai — stok berubah otomatis dari transaksi masuk & keluar',
  icon: Archive,
  endpoint: API_ENDPOINTS.BMHP_ITEMS,
  tabs: BMHP_TABS,
  adminOnlyWrite: true,
  canEdit: true,
  canDelete: true,
  createLabel: 'Tambah BMHP',
  searchPlaceholder: 'Cari kode, barcode, nama BMHP...',
  exportable: true,
  filters: [{ name: 'is_low', label: 'Stok', options: [{ value: '1', label: 'Menipis / habis' }, { value: '0', label: 'Aman' }] }],
  columns: [
    { key: 'code', label: 'Kode', sortable: true, render: mono('code') },
    { key: 'name', label: 'Nama BMHP', sortable: true, render: bold('name') },
    { key: 'barcode', label: 'Barcode', render: mono('barcode') },
    { key: 'stock', label: 'Stok', sortable: true, render: qty('stock', 'unit_label') },
    { key: 'min_stock', label: 'Minimum', sortable: true },
    { key: 'status', label: 'Status', render: stockStatus },
  ],
  deleteMessage: (row) => `Hapus BMHP "${row.name}"? Hanya bisa jika stok kosong.`,
  form: {
    subtitle: 'Stok awal 0. Tambahkan stok melalui menu Barang Masuk.',
    fields: [
      { name: 'code', label: 'Kode', required: true, maxLength: 30, placeholder: 'BMHP-006' },
      { name: 'barcode', label: 'Barcode produk', maxLength: 50 },
      { name: 'name', label: 'Nama BMHP', required: true, maxLength: 150, span: 2 },
      { name: 'unit_label', label: 'Satuan', required: true, maxLength: 30, default: 'pcs' },
      { name: 'min_stock', label: 'Stok minimum', type: 'number', min: 0, default: 0, help: 'Peringatan muncul saat stok ≤ nilai ini.' },
      { name: 'is_active', label: 'Aktif', type: 'checkbox', checkboxLabel: 'BMHP aktif', default: true },
    ],
  },
};

const bmhpItemField = {
  type: 'remote-select',
  name: 'bmhp_item_id',
  label: 'BMHP',
  required: true,
  span: 2,
  placeholder: 'Pilih BMHP atau scan barcode di atas...',
  optionsEndpoint: API_ENDPOINTS.BMHP_ITEMS.LIST,
  optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
  optionLabel: (r) => `${r.code} — ${r.name} (stok ${r.stock} ${r.unit_label})`,
};

/** Scan barcode BMHP -> isi pilihan BMHP otomatis. */
const bmhpScanField = {
  name: 'scan',
  label: 'Scan barcode BMHP',
  type: 'barcode',
  span: 2,
  noSubmit: true,
  onScan: async (code, { setValue }) => {
    const body = await getList(API_ENDPOINTS.BMHP_ITEMS.LIST, { barcode: code.trim(), is_active: 1 });
    const item = body.data?.[0];
    if (!item) return { error: `Barcode ${code} tidak terdaftar di master BMHP` };
    setValue('bmhp_item_id', item.id);
    return { hint: `${item.name} • stok ${item.stock} ${item.unit_label}` };
  },
};

const transactionColumns = [
  { key: 'trx_date', label: 'Tanggal', sortable: true, render: date('trx_date') },
  { key: 'item_name', label: 'Nama BMHP', sortable: true, render: bold('item_name') },
  { key: 'type', label: 'Jenis', sortable: true, render: badge('type') },
  { key: 'quantity', label: 'Jumlah', sortable: true, render: qty('quantity', 'unit_label') },
  { key: 'batch_no', label: 'Batch', render: mono('batch_no') },
  { key: 'unit_name', label: 'Unit Pemakai' },
  { key: 'stock_after', label: 'Stok Akhir' },
  { key: 'officer', label: 'Petugas' },
];

const baseTransaction = {
  endpoint: API_ENDPOINTS.BMHP_TRANSACTIONS,
  tabs: BMHP_TABS,
  dateFilter: true,
  searchPlaceholder: 'Cari nama, kode, batch, petugas...',
  columns: transactionColumns,
};

const officerField = officerSelectField({ name: 'officer', label: 'Petugas', required: true, placeholder: 'Pilih petugas...' });
const dateField = { name: 'trx_date', label: 'Tanggal', type: 'date', required: true, default: todayISO };
const notesField = { name: 'notes', label: 'Catatan', type: 'textarea', maxLength: 500 };

export const bmhpInConfig = {
  ...baseTransaction,
  key: 'bmhp-masuk',
  title: 'Barang Masuk BMHP',
  subtitle: 'Scan barcode, input jumlah dan batch',
  icon: ArrowDownToLine,
  fixedParams: { type: 'MASUK' },
  fixedBody: { type: 'MASUK' },
  createLabel: 'Barang Masuk',
  form: {
    fields: [
      bmhpScanField,
      bmhpItemField,
      { name: 'quantity', label: 'Jumlah masuk', type: 'number', required: true, min: 1, default: 1 },
      { name: 'batch_no', label: 'No. batch / lot', maxLength: 50 },
      officerField,
      dateField,
      notesField,
    ],
  },
};

export const bmhpOutConfig = {
  ...baseTransaction,
  key: 'bmhp-keluar',
  title: 'Pengambilan BMHP',
  subtitle: 'Scan barcode, input jumlah dan unit pemakai',
  icon: ArrowUpFromLine,
  fixedParams: { type: 'KELUAR' },
  fixedBody: { type: 'KELUAR' },
  createLabel: 'Ambil BMHP',
  form: {
    fields: [
      bmhpScanField,
      bmhpItemField,
      { name: 'quantity', label: 'Jumlah diambil', type: 'number', required: true, min: 1, default: 1 },
      {
        type: 'remote-select', name: 'unit_id', label: 'Unit pemakai', placeholder: 'Pilih unit (opsional)...',
        optionsEndpoint: API_ENDPOINTS.UNITS.LIST, optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
      },
      officerField,
      dateField,
      notesField,
    ],
  },
};

/** Laporan mutasi BMHP (masuk, keluar, sisa stok). */
export const bmhpMutationConfig = {
  ...baseTransaction,
  key: 'laporan-bmhp',
  title: 'Laporan BMHP',
  subtitle: 'Barang masuk, keluar, dan sisa stok',
  icon: ClipboardList,
  readOnly: true,
  report: true,
  filters: [{ name: 'type', label: 'Jenis', options: [{ value: 'MASUK', label: 'Masuk' }, { value: 'KELUAR', label: 'Keluar' }] }],
};
