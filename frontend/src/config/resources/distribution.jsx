import { Boxes, Truck } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getList } from '@/utils/request';
import { formatDate, todayISO, fileUrl } from '@/utils/format';
import { badge, bold, date, mono, qty } from '@/config/cells';
import { officerSelectField } from '@/config/officerField';
import SterileSetSelector from '@/components/distribution/SterileSetSelector';

export const GAUZE_TYPES = [
  'Kasa Lipat OK',
  'Kasa Lipat Umum',
  'Kasa Rol 6 cm',
  'Kasa Rol 10 cm',
  'Kasa Rol 12 cm',
];

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

const renderSignatureCell = (key) => (r) => {
  const val = r[key];
  if (!val) return <span className="text-xs text-slate-400">-</span>;
  const src = val.startsWith('data:') ? val : fileUrl(val);
  return (
    <div className="flex items-center gap-1.5">
      <img src={src} alt="TTD" className="h-8 max-w-[80px] object-contain rounded border border-slate-200 bg-white p-0.5" />
    </div>
  );
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
    ...(gauze
      ? [{ key: 'gauze_type', label: 'Jenis Kasa', sortable: true, render: (r) => <b className="font-bold text-brand-700">{r.gauze_type || r.item_name}</b> }]
      : [{ key: 'item_name', label: 'Alat', sortable: true, render: bold('item_name') }]),
    { key: 'batch_no', label: 'Batch', render: mono('batch_no') },
    { key: 'unit_name', label: 'Unit Tujuan', sortable: true },
    { key: 'quantity', label: 'Jumlah', sortable: true, render: qty() },
    { key: 'officer', label: 'Petugas CSSD' },
    { key: 'officer_signature', label: 'TTD CSSD', render: renderSignatureCell('officer_signature') },
    { key: 'receiver_name', label: 'Penerima Unit' },
    { key: 'receiver_signature', label: 'TTD Unit', render: renderSignatureCell('receiver_signature') },
    { key: 'type', label: 'Jenis', render: badge('type') },
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus distribusi ${row.barcode} ke ${row.unit_name}? Stok steril akan dikembalikan ke CSSD.`,
  traceField: 'barcode',
  form: {
    size: 'lg',
    subtitle: gauze
      ? 'Pilih jenis kasa, unit pengambil, dan tanda tangan langsung di layar HP petugas unit.'
      : 'Pilih dari daftar set siap ambil atau scan barcode (ST-... / AK-...). Rincian set otomatis keluar.',
    fields: [
      {
        name: '_set_selector',
        type: 'custom',
        span: 2,
        render: ({ values, setValue, setValues }) => (
          <SterileSetSelector values={values} setValue={setValue} setValues={setValues} gauze={gauze} />
        ),
      },
      ...(gauze
        ? [
            {
              name: 'gauze_type',
              label: 'Pilihan Jenis Kasa Steril',
              type: 'custom',
              required: true,
              span: 2,
              render: ({ values, setValue }) => {
                const current = values.gauze_type || '';
                return (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Klik jenis kasa yang didistribusikan:</p>
                    <div className="flex flex-wrap gap-2">
                      {GAUZE_TYPES.map((gt) => {
                        const isSelected = current === gt;
                        return (
                          <button
                            key={gt}
                            type="button"
                            onClick={() => {
                              setValue('gauze_type', gt);
                              if (!values.item_name) setValue('item_name', gt);
                            }}
                            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                              isSelected
                                ? 'bg-brand-700 text-white shadow-sm ring-2 ring-brand-700 ring-offset-1'
                                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800'
                            }`}
                          >
                            {gt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              },
            },
          ]
        : []),
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
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS,
        optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
        default: ({ user }) => (user?.role === 'unit' && user?.unit_id ? String(user.unit_id) : ''),
      },
      { name: 'quantity', label: 'Jumlah', type: 'number', required: true, min: 1, default: 1 },
      officerSelectField({
        name: 'officer',
        label: 'Petugas CSSD',
        required: true,
        placeholder: 'Pilih petugas CSSD...',
        onSignatureField: 'officer_signature',
      }),
      { name: 'officer_signature', label: 'TTD Petugas CSSD (Otomatis)', type: 'signature' },
      { name: 'receiver_name', label: 'Petugas Pengambil (Unit)', required: true, maxLength: 100, placeholder: 'Nama perawat / petugas unit' },
      { name: 'receiver_signature', label: 'TTD Petugas Unit (Layar HP)', type: 'signature' },
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

/** Laporan khusus Distribusi Kasa Steril. */
export const distGauzeReportConfig = {
  ...distGauzeConfig,
  key: 'laporan-distribusi-kasa',
  title: 'Laporan Distribusi Kasa Steril',
  subtitle: 'Rekap otomatis distribusi kasa lengkap dengan jenis kasa, unit, dan tanda tangan',
  readOnly: true,
  report: true,
  dateFilter: true,
};
