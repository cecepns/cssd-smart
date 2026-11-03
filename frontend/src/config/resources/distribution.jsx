import { Boxes, Truck } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getList } from '@/utils/request';
import { formatDate, todayISO } from '@/utils/format';
import { badge, bold, date, mono, qty } from '@/config/cells';
import { officerSelectField } from '@/config/officerField';
import SterileSetSelector from '@/components/distribution/SterileSetSelector';

/**
 * Scan barcode paket di stok steril: validasi cepat di form
 * Mendukung barcode paket steril (ST-... / AS-...) maupun barcode bukti serah terima kotor (AK-...).
 */
const lookupStock = (expectedGauze) => async (code, { setValue }) => {
  try {
    const clean = (code || '').trim();
    if (!clean) return;
    const body = await getList(API_ENDPOINTS.STERILE_STOCK.LOOKUP, { code: clean });
    const stock = body.data;
    if (!stock) return { error: `Barcode ${clean} tidak ditemukan di stok steril` };
    if (stock.display_status !== 'Tersedia') return { error: `Barcode ${clean} berstatus ${stock.display_status}` };

    const isGauze = stock.category === 'Kasa Steril';
    if (expectedGauze !== isGauze) {
      return {
        error: isGauze
          ? 'Barcode ini adalah Kasa Steril, gunakan menu Distribusi Kasa Steril'
          : 'Barcode ini adalah Alat Steril, gunakan menu Distribusi Alat Steril',
      };
    }

    // Auto-fill form fields
    setValue('barcode', stock.barcode);
    if (stock.origin_unit_id) {
      setValue('unit_id', stock.origin_unit_id);
    }
    setValue('quantity', 1);
    if (stock.origin_sender) {
      setValue('receiver_name', stock.origin_sender);
    }

    const setInfo = stock.category === 'Set Instrumen' ? ` [${stock.completeness_status || 'Set'}]` : '';
    const unitInfo = stock.origin_unit_name ? ` • Asal: ${stock.origin_unit_name}` : '';
    return {
      hint: `${stock.item_name}${setInfo}${unitInfo} • batch ${stock.batch_no} • sisa ${stock.quantity} ${stock.unit_label} • exp ${formatDate(stock.expiry_date)}`,
    };
  } catch (err) {
    return { error: err?.message || `Barcode ${code} tidak ditemukan` };
  }
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
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus distribusi ${row.barcode} ke ${row.unit_name}? Stok steril akan dikembalikan ke CSSD.`,
  traceField: 'barcode',
  form: {
    size: 'lg',
    subtitle: 'Pilih dari daftar set siap ambil atau scan barcode (ST-... / AK-...). Rincian set otomatis keluar.',
    fields: [
      {
        name: '_set_selector',
        type: 'custom',
        span: 2,
        render: ({ values, setValue, setValues }) => (
          <SterileSetSelector values={values} setValue={setValue} setValues={setValues} gauze={gauze} />
        ),
      },
      {
        name: 'barcode',
        label: 'Kode barcode paket steril',
        type: 'barcode',
        required: true,
        placeholder: gauze ? 'Scan barcode kasa (KS-...)' : 'Scan barcode alat (ST-... / AS-... / AK-...)',
        onScan: lookupStock(gauze),
      },
      {
        type: 'remote-select',
        name: 'unit_id',
        label: 'Unit tujuan / pengambil',
        required: true,
        placeholder: 'Pilih unit...',
        optionsEndpoint: API_ENDPOINTS.UNITS.LIST,
        optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
      },
      { name: 'quantity', label: 'Jumlah', type: 'number', required: true, min: 1, default: 1 },
      officerSelectField({ name: 'officer', label: 'Petugas CSSD', required: true, placeholder: 'Pilih petugas CSSD...' }),
      { name: 'receiver_name', label: 'Penerima di unit', maxLength: 100, placeholder: 'Nama perawat / petugas unit' },
      { name: 'dist_date', label: 'Tanggal', type: 'date', required: true, default: todayISO },
      { name: 'notes', label: 'Catatan', type: 'textarea', maxLength: 500, placeholder: 'Catatan tambahan...' },
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
