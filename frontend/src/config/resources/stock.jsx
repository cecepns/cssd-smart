import { AlertOctagon, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Archive, CalendarX, ClipboardList, Layers, PackageCheck, PackageX } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { PACKAGE_TYPES } from '@/utils/constants';
import { getList } from '@/utils/request';
import { formatDate, formatDateTime, formatNumber, todayISO } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { badge, bold, date, dateTime, durationBadge, expiry, mono, qty, timeWindow } from '@/config/cells';
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
  timeFilter: true,
  filters: [
    { name: 'origin_unit_id', label: 'Unit Asal', optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS },
    { name: 'category', label: 'Kategori', options: PACKAGE_TYPES },
    { name: 'status', label: 'Status', options: ['Tersedia', 'Terdistribusi', 'Kedaluwarsa'] },
  ],
  columns: [
    { key: 'item_name', label: 'Nama Alat', sortable: true, render: bold('item_name') },
    { key: 'origin_unit_name', label: 'Unit Asal', render: (r) => r.origin_unit_name || '-' },
    { key: 'category', label: 'Kategori', sortable: true },
    { key: 'barcode', label: 'Barcode', sortable: true, render: mono('barcode') },
    { key: 'batch_no', label: 'Batch', sortable: true, render: mono('batch_no') },
    { key: 'sterile_date', label: 'Tgl Steril', sortable: true, render: date('sterile_date') },
    { key: 'started_at', label: 'Masuk / Diambil', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Lama / Tunggu', render: durationBadge },
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
  { label: 'Laporan', to: ROUTES.BMHP_REPORT, icon: ClipboardList, adminOnly: true },
];

export const BMHP_CATEGORIES = [
  'Kemasan Steril',
  'Indikator Kimia & Biologi',
  'Desinfektan & Pembersih',
  'Kassa & Linen Steril',
  'APD & Perlindungan Diri',
  'Alat & Aksesoris',
  'Lainnya',
];

export const BMHP_UNITS = [
  'pcs',
  'roll',
  'box',
  'pack',
  'lembar',
  'botol',
  'liter',
  'galon',
  'ampul',
  'strip',
  'set',
];

const bmhpStockCell = (row) => {
  const stock = Number(row.stock || 0);
  const min = Number(row.min_stock || 0);
  const tone = stock <= 0 ? 'rose' : stock <= min ? 'amber' : 'emerald';
  const label = stock <= 0 ? 'Habis (0)' : stock <= min ? 'Menipis' : 'Aman';

  return (
    <div className="leading-tight">
      <div className="font-bold text-slate-900 text-sm">
        {formatNumber(stock)}{' '}
        <span className="text-xs font-normal text-slate-500">{row.unit_label || ''}</span>
      </div>
      <div className="mt-0.5">
        <Badge tone={tone}>{label}</Badge>
      </div>
    </div>
  );
};

const bmhpExpiryCell = (row) => {
  if (!row.expiry_date) {
    return <span className="text-xs text-slate-400 italic">Tanpa exp</span>;
  }
  const left = Number(row.days_left);
  const isExp = left < 0;
  const isSoon = left >= 0 && left <= 30;

  return (
    <div className="leading-tight">
      <div className="text-xs font-semibold text-slate-800">{formatDate(row.expiry_date)}</div>
      <div className="mt-0.5">
        {isExp ? (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700">
            Lewat {Math.abs(left)} hr
          </span>
        ) : isSoon ? (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800">
            {left === 0 ? 'Hari ini' : `${left} hr lagi`}
          </span>
        ) : (
          <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            Aman ({left} hr)
          </span>
        )}
      </div>
    </div>
  );
};

export const bmhpItemsConfig = {
  key: 'stok-bmhp',
  title: 'Stok BMHP',
  subtitle: 'Barang Medis Habis Pakai — spesifikasi lengkap, stok otomatis, peringatan minimum & kedaluwarsa',
  icon: Archive,
  endpoint: API_ENDPOINTS.BMHP_ITEMS,
  tabs: BMHP_TABS,
  adminOnlyWrite: true,
  canEdit: true,
  canDelete: true,
  createLabel: 'Tambah BMHP',
  searchPlaceholder: 'Cari kode, barcode, nama, kategori, batch...',
  exportable: true,
  filters: [
    { name: 'category', label: 'Kategori', options: BMHP_CATEGORIES },
    {
      name: 'stock_status',
      label: 'Status Stok',
      options: [
        { value: 'empty', label: 'Stok Habis (0)' },
        { value: 'low', label: 'Stok Menipis (≤ Min)' },
        { value: 'safe', label: 'Stok Aman' },
      ],
    },
    {
      name: 'expiry_status',
      label: 'Status Expired',
      options: [
        { value: 'expired', label: 'Kedaluwarsa' },
        { value: 'expiring', label: 'Mendekati Expired (≤30 hari)' },
        { value: 'safe', label: 'Aman' },
      ],
    },
    {
      name: 'is_active',
      label: 'Status',
      options: [
        { value: '1', label: 'Aktif' },
        { value: '0', label: 'Non-aktif' },
      ],
    },
  ],
  columns: [
    {
      key: 'code',
      label: 'Kode',
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-900">{r.code}</span>
          {r.barcode && <div className="font-mono text-[10px] text-slate-400">{r.barcode}</div>}
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Nama Barang & Spesifikasi',
      sortable: true,
      render: (r) => (
        <div className="max-w-[240px]">
          <div className="font-bold text-slate-900 leading-snug">{r.name}</div>
          {r.specification ? (
            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{r.specification}</div>
          ) : r.item_type ? (
            <div className="text-[11px] text-slate-400 mt-0.5">Jenis: {r.item_type}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Kategori',
      sortable: true,
      render: (r) => (
        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap">
          {r.category || '-'}
        </span>
      ),
    },
    { key: 'item_type', label: 'Jenis', sortable: true, render: (r) => r.item_type || '-' },
    { key: 'package_volume', label: 'Volume Kemasan', render: (r) => r.package_volume || '-' },
    { key: 'unit_label', label: 'Satuan', render: (r) => <span className="font-semibold text-slate-600 text-xs">{r.unit_label}</span> },
    { key: 'initial_stock', label: 'Stok Awal', sortable: true, render: (r) => <span className="font-mono text-xs text-slate-600">{formatNumber(r.initial_stock || 0)}</span> },
    {
      key: 'total_in',
      label: 'Masuk',
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs font-bold text-emerald-600">
          +{formatNumber(r.total_in || 0)}
        </span>
      ),
    },
    {
      key: 'total_out',
      label: 'Keluar',
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs font-bold text-sky-600">
          -{formatNumber(r.total_out || 0)}
        </span>
      ),
    },
    {
      key: 'stock',
      label: 'Stok Akhir',
      sortable: true,
      render: bmhpStockCell,
    },
    { key: 'min_stock', label: 'Min', sortable: true, render: (r) => <span className="font-mono text-xs text-slate-600">{formatNumber(r.min_stock || 0)}</span> },
    { key: 'batch_no', label: 'No. Batch', sortable: true, render: mono('batch_no') },
    { key: 'expiry_date', label: 'Expired', sortable: true, render: bmhpExpiryCell },
  ],
  deleteMessage: (row) => `Hapus BMHP "${row.name}"? Hanya bisa jika stok kosong.`,
  form: {
    subtitle: 'Lengkapi spesifikasi, stok awal, serta tanggal kedaluwarsa BMHP.',
    fields: [
      { name: 'code', label: 'Kode Barang', required: true, maxLength: 30, placeholder: 'mis. BMHP-POUCH-01' },
      { name: 'barcode', label: 'Barcode Produk (opsional)', maxLength: 50, placeholder: 'mis. 899123456789' },
      { name: 'name', label: 'Nama Barang', required: true, maxLength: 150, span: 2, placeholder: 'mis. Sterilization Flat Roll Pouch 75mm x 200m' },
      {
        name: 'category',
        label: 'Kategori',
        type: 'select',
        required: true,
        options: BMHP_CATEGORIES,
        default: 'Kemasan Steril',
      },
      { name: 'item_type', label: 'Jenis Barang', maxLength: 100, placeholder: 'mis. Pouch Roll, Strip Indikator, Cairan Enzimatik' },
      {
        name: 'specification',
        label: 'Spesifikasi Barang',
        type: 'textarea',
        span: 2,
        maxLength: 255,
        placeholder: 'mis. Medical paper 60gsm + laminated film, dual indicator steam & EO, ukuran 75mm x 200m',
      },
      { name: 'package_volume', label: 'Volume Kemasan', maxLength: 100, placeholder: 'mis. 1 Roll @ 200 Meter, 1 Box isi 250 pcs, Galon 5L' },
      {
        name: 'unit_label',
        label: 'Satuan Unit',
        type: 'select',
        required: true,
        options: BMHP_UNITS,
        default: 'pcs',
      },
      {
        name: 'initial_stock',
        label: 'Jumlah Stok Awal',
        type: 'number',
        min: 0,
        default: 0,
        help: 'Stok awal saat barang didaftarkan. Stok akhir dihitung otomatis: Stok Awal + Masuk - Keluar.',
      },
      {
        name: 'min_stock',
        label: 'Stok Minimum',
        type: 'number',
        min: 0,
        default: 10,
        help: 'Peringatan otomatis muncul di sistem jika stok akhir ≤ batas minimum ini.',
      },
      { name: 'batch_no', label: 'Nomor Batch / Lot', maxLength: 50, placeholder: 'mis. LOT-202611-01' },
      {
        name: 'expiry_date',
        label: 'Tanggal Expired',
        type: 'date',
        help: 'Peringatan otomatis aktif saat barang mendekati kedaluwarsa (≤30 hari) atau sudah lewat.',
      },
      { name: 'is_active', label: 'Status Aktif', type: 'checkbox', checkboxLabel: 'BMHP aktif digunakan', default: true },
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
  { key: 'expiry_date', label: 'Expired', render: (r) => (r.expiry_date ? formatDate(r.expiry_date) : '-') },
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
  subtitle: 'Scan barcode, input jumlah, nomor batch dan tanggal kedaluwarsa',
  icon: ArrowDownToLine,
  fixedParams: { type: 'MASUK' },
  fixedBody: { type: 'MASUK' },
  createLabel: 'Barang Masuk',
  form: {
    fields: [
      bmhpScanField,
      bmhpItemField,
      { name: 'quantity', label: 'Jumlah masuk', type: 'number', required: true, min: 1, default: 1 },
      { name: 'batch_no', label: 'No. batch / lot', maxLength: 50, placeholder: 'mis. LOT-202611-01' },
      { name: 'expiry_date', label: 'Tanggal expired', type: 'date', help: 'Tanggal kedaluwarsa batch ini. Otomatis memperbarui data master BMHP.' },
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
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS, optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
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
