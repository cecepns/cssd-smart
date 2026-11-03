import { Boxes, Truck } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getList } from '@/utils/request';
import { formatDate, todayISO } from '@/utils/format';
import { badge, bold, date, mono, qty } from '@/config/cells';
import { officerSelectField } from '@/config/officerField';

/**
 * Scan barcode paket di stok steril: validasi cepat di form
 * (validasi final tetap dilakukan backend).
 */
const lookupStock = (expectedGauze) => async (code, { setValue }) => {
  const body = await getList(API_ENDPOINTS.STERILE_STOCK.LIST, { barcode: code.trim() });
  const stock = body.data?.[0];
  if (!stock) return { error: `Barcode ${code} tidak ditemukan di stok steril` };
  if (stock.display_status !== 'Tersedia') return { error: `Barcode ${code} berstatus ${stock.display_status}` };

  const isGauze = stock.category === 'Kasa Steril';
  if (expectedGauze !== isGauze) {
    return { error: isGauze ? 'Barcode ini kasa steril, gunakan menu Distribusi Kasa Steril' : 'Barcode ini alat steril, gunakan menu Distribusi Alat Steril' };
  }

  setValue('quantity', stock.quantity);
  return { hint: `${stock.item_name} • batch ${stock.batch_no} • sisa ${stock.quantity} ${stock.unit_label} • exp ${formatDate(stock.expiry_date)}` };
};

const buildConfig = ({ key, title, subtitle, icon, type, gauze }) => ({
  key,
  title,
  subtitle,
  icon,
  endpoint: API_ENDPOINTS.DISTRIBUTIONS,
  fixedParams: { type },
  fixedBody: { type },
  searchPlaceholder: 'Cari barcode, nama, unit tujuan...',
  createLabel: 'Distribusi Baru',
  dateFilter: true,
  columns: [
    { key: 'barcode', label: 'Barcode', sortable: true, render: mono('barcode') },
    { key: 'dist_date', label: 'Tanggal', sortable: true, render: date('dist_date') },
    { key: 'item_name', label: gauze ? 'Kasa' : 'Alat', sortable: true, render: bold('item_name') },
    { key: 'batch_no', label: 'Batch', render: mono('batch_no') },
    { key: 'unit_name', label: 'Unit Tujuan', sortable: true },
    { key: 'quantity', label: 'Jumlah', sortable: true, render: qty() },
    { key: 'officer', label: 'Petugas' },
    { key: 'receiver_name', label: 'Penerima' },
    { key: 'type', label: 'Jenis', render: badge('type') },
  ],
  traceField: 'barcode',
  form: {
    size: 'lg',
    subtitle: 'Scan barcode paket steril. Stok berkurang otomatis dan alat kedaluwarsa ditolak.',
    fields: [
      {
        name: 'barcode', label: 'Barcode paket steril', type: 'barcode', required: true, span: 2,
        placeholder: gauze ? 'Scan barcode kasa (KS-...)' : 'Scan barcode alat (AS-... / ST-... / PG-... / SM-...)',
        onScan: lookupStock(gauze),
      },
      {
        type: 'remote-select', name: 'unit_id', label: 'Unit tujuan', required: true, placeholder: 'Pilih unit...',
        optionsEndpoint: API_ENDPOINTS.UNITS.LIST, optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
      },
      { name: 'quantity', label: 'Jumlah', type: 'number', required: true, min: 1, default: 1 },
      officerSelectField({ name: 'officer', label: 'Petugas CSSD', required: true, placeholder: 'Pilih petugas CSSD...' }),
      { name: 'receiver_name', label: 'Penerima di unit', maxLength: 100 },
      { name: 'dist_date', label: 'Tanggal', type: 'date', required: true, default: todayISO },
      { name: 'notes', label: 'Catatan', type: 'textarea', maxLength: 500 },
    ],
  },
});

export const distToolsConfig = buildConfig({
  key: 'distribusi-alat-steril',
  title: 'Distribusi Alat Steril',
  subtitle: 'Alat steril siap diambil unit — pakai barcode',
  icon: Truck,
  type: 'ALAT',
  gauze: false,
});

export const distGauzeConfig = buildConfig({
  key: 'distribusi-kasa-steril',
  title: 'Distribusi Kasa Steril',
  subtitle: 'Distribusi kasa steril ke unit — pakai barcode',
  icon: Boxes,
  type: 'KASA',
  gauze: true,
});

/** Laporan gabungan distribusi alat & kasa. */
export const distAllConfig = {
  ...distToolsConfig,
  key: 'distribusi',
  title: 'Distribusi Steril',
  subtitle: 'Seluruh distribusi alat dan kasa steril ke unit',
  fixedParams: undefined,
  fixedBody: undefined,
  filters: [{ name: 'type', label: 'Jenis', options: [{ value: 'ALAT', label: 'Alat' }, { value: 'KASA', label: 'Kasa' }] }],
};
