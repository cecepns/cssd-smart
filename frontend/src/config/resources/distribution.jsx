import { Boxes, Truck } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getList } from '@/utils/request';
import { formatDate, todayISO, fileUrl } from '@/utils/format';
import { badge, bold, date, durationBadge, mono, qty, timeWindow } from '@/config/cells';
import { officerSelectField } from '@/config/officerField';
import SterileSetSelector from '@/components/distribution/SterileSetSelector';

export const GAUZE_TYPES = [
  'Kasa Lipat OK',
  'Kasa Lipat Umum',
  'Kasa Rol 6 cm',
  'Kasa Rol 10 cm',
  'Kasa Rol 12 cm',
  'Kasa Tampon Bulat VK',
  'Kasa Tampon X-Ray OK',
  'Kasa Buntut X-Ray 8 Ply OK',
];

export const GAUZE_DEFAULTS = {
  'Kasa Lipat OK': { size: '10 x 10 cm (Lipat OK)', unit: 'pouch' },
  'Kasa Lipat Umum': { size: '7.5 x 7.5 cm (Lipat Umum)', unit: 'pouch' },
  'Kasa Rol 6 cm': { size: 'Lebar 6 cm', unit: 'roll' },
  'Kasa Rol 10 cm': { size: 'Lebar 10 cm', unit: 'roll' },
  'Kasa Rol 12 cm': { size: 'Lebar 12 cm', unit: 'roll' },
  'Kasa Tampon Bulat VK': { size: 'Tampon Bulat VK', unit: 'pouch' },
  'Kasa Tampon X-Ray OK': { size: 'Tampon X-Ray OK', unit: 'pouch' },
  'Kasa Buntut X-Ray 8 Ply OK': { size: '8 Ply Buntut X-Ray OK', unit: 'pouch' },
};

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
          ? 'Barcode ini adalah Kasa Steril, gunakan menu Pengambilan Kasa Steril'
          : 'Barcode ini adalah Alat Steril, gunakan menu Pengambilan Alat Steril',
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
  subtitle: subtitle || (gauze
    ? 'Pencatatan serah terima kasa steril bersih & siap pakai dari CSSD ke unit'
    : 'Alat steril siap diambil unit — pakai barcode'),
  icon,
  endpoint: API_ENDPOINTS.DISTRIBUTIONS,
  fixedParams: { type },
  fixedBody: { type },
  searchPlaceholder: gauze ? 'Cari jenis kasa, barcode, unit penerima...' : 'Cari barcode, nama, unit tujuan...',
  createLabel: gauze ? 'Catat Pengambilan Kasa' : 'Pengambilan Alat Steril',
  dateFilter: true,
  timeFilter: true,
  filters: [{ name: 'unit_id', label: 'Unit Tujuan', optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS }],
  columns: [
    { key: 'barcode', label: gauze ? 'Barcode Bukti' : 'Barcode', sortable: true, render: mono('barcode') },
    { key: 'dist_date', label: 'Tanggal', sortable: true, render: date('dist_date') },
    { key: 'started_at', label: gauze ? 'Jam Pengambilan' : 'Jam Proses', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Lama / Tunggu', render: durationBadge },
    ...(gauze
      ? [{ key: 'gauze_type', label: 'Jenis Kasa', sortable: true, render: (r) => <b className="font-bold text-brand-700">{r.gauze_type || r.item_name}</b> }]
      : [{ key: 'item_name', label: 'Alat', sortable: true, render: bold('item_name') }, { key: 'batch_no', label: 'Batch', render: mono('batch_no') }]),
    { key: 'unit_name', label: 'Unit Tujuan', sortable: true },
    { key: 'quantity', label: 'Jumlah', sortable: true, render: qty() },
    { key: 'officer', label: 'Petugas CSSD' },
    { key: 'officer_signature', label: 'TTD CSSD', render: renderSignatureCell('officer_signature') },
    { key: 'receiver_name', label: 'Penerima Unit' },
    { key: 'receiver_signature', label: 'TTD Unit', render: renderSignatureCell('receiver_signature') },
    {
      key: 'proof_image',
      label: 'Foto Bukti',
      render: (r) => r.proof_image ? (
        <a
          href={r.proof_image.startsWith('data:') ? r.proof_image : fileUrl(r.proof_image)}
          target="_blank"
          rel="noreferrer"
          title="Lihat Foto Bukti Serah Terima"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 hover:border-brand-400 shadow-xs"
        >
          <img src={r.proof_image.startsWith('data:') ? r.proof_image : fileUrl(r.proof_image)} alt="Bukti" className="h-7 w-7 rounded object-cover" />
        </a>
      ) : <span className="text-xs text-slate-300">-</span>,
    },
    ...(!gauze ? [{ key: 'type', label: 'Jenis', render: badge('type') }] : []),
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus pengambilan ${row.barcode} ke ${row.unit_name}?`,
  traceField: 'barcode',
  form: {
    size: 'lg',
    title: gauze ? 'Pengambilan Kasa Steril' : 'Pengambilan Alat Steril',
    createTitle: gauze ? 'Pengambilan Kasa Steril' : 'Pengambilan Alat Steril',
    subtitle: gauze
      ? 'Pilih jenis kasa steril, jumlah, unit penerima, serta tanda tangan dan foto serah terima.'
      : 'Pilih Set Instrumen atau Alat Satuan dari Master Data unit penerima. Rincian alat otomatis keluar.',
    fields: gauze
      ? [
        {
          name: 'gauze_type',
          label: 'Pilihan Jenis Kasa Steril',
          type: 'custom',
          required: true,
          span: 2,
          render: ({ values, setValue }) => {
            const current = values.gauze_type || values.item_name || '';
            return (
              <div className="space-y-2 rounded-2xl border border-brand-200/90 bg-brand-50/40 p-3.5 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-900">
                    Jenis Kasa Steril Siap Pakai <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Klik pilihan di bawah</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GAUZE_TYPES.map((gt) => {
                    const isSelected = current === gt;
                    return (
                      <button
                        key={gt}
                        type="button"
                        onClick={() => {
                          setValue('gauze_type', gt);
                          setValue('item_name', gt);
                        }}
                        className={`rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-xs ${isSelected
                            ? 'bg-brand-700 text-white shadow-sm ring-2 ring-brand-700 ring-offset-1'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800'
                          }`}
                      >
                        {gt}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={values.gauze_type || ''}
                  onChange={(e) => {
                    setValue('gauze_type', e.target.value);
                    setValue('item_name', e.target.value);
                  }}
                  placeholder="Atau ketik nama / ukuran jenis kasa lainnya..."
                  className="input-base text-xs mt-2 bg-white"
                />
              </div>
            );
          },
        },
        {
          name: 'quantity',
          label: 'Jumlah Pengambilan (Pouch / Bungkus)',
          type: 'number',
          required: true,
          min: 1,
          default: 1,
        },
        {
          type: 'remote-select',
          name: 'unit_id',
          label: 'Unit Penerima / Pengambil',
          required: true,
          placeholder: 'Pilih unit ruangan...',
          optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS,
          optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
          default: ({ user }) => (user?.role === 'unit' && user?.unit_id ? String(user.unit_id) : ''),
        },
        officerSelectField({
          name: 'officer',
          label: 'Petugas Penyerah (CSSD)',
          required: true,
          placeholder: 'Pilih petugas CSSD...',
          onSignatureField: 'officer_signature',
        }),
        { name: 'officer_signature', label: 'TTD Petugas Penyerah (Otomatis / Layar)', type: 'signature' },
        {
          name: 'receiver_name',
          label: 'Petugas Pengambil (Unit)',
          required: true,
          maxLength: 100,
          placeholder: 'Nama perawat / petugas ruangan',
          default: ({ user }) => (user?.role === 'unit' ? user.name : ''),
        },
        { name: 'receiver_signature', label: 'TTD Petugas Pengambil (Layar HP)', type: 'signature' },
        { name: 'proof_image', label: 'Foto Bukti Serah Terima (Kamera HP)', type: 'image' },
        { name: 'dist_date', label: 'Tanggal Pengambilan', type: 'date', required: true, default: todayISO },
        {
          name: 'barcode',
          label: 'Kode Barcode (Opsional)',
          type: 'text',
          placeholder: 'Otomatis dibuat oleh sistem (mis. DK-...) jika dikosongkan',
          maxLength: 50,
        },
        { name: 'notes', label: 'Catatan Pengambilan', type: 'textarea', maxLength: 500, placeholder: 'Catatan kebutuhan unit (opsional)...', span: 2 },
      ]
      : [
        {
          name: '_set_selector',
          type: 'custom',
          span: 2,
          render: ({ values, setValue, setValues }) => (
            <SterileSetSelector values={values} setValue={setValue} setValues={setValues} gauze={gauze} />
          ),
        },
        { name: 'item_name', type: 'hidden' },
        { name: 'item_category', type: 'hidden' },
        { name: 'unit_label', type: 'hidden' },
        {
          name: 'barcode',
          label: 'Kode barcode paket steril (Otomatis / Scan)',
          type: 'barcode',
          required: false,
          placeholder: 'Otomatis dibuat (DS-...) saat simpan, atau scan (ST-... / AK-...)',
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
        {
          name: 'receiver_name',
          label: 'Petugas Pengambil (Unit)',
          required: true,
          maxLength: 100,
          placeholder: 'Nama perawat / petugas unit',
          default: ({ user }) => (user?.role === 'unit' ? user.name : ''),
        },
        { name: 'receiver_signature', label: 'TTD Petugas Unit (Layar HP)', type: 'signature' },
        { name: 'proof_image', label: 'Foto Bukti Serah Terima (Kamera HP)', type: 'image' },
        { name: 'dist_date', label: 'Tanggal', type: 'date', required: true, default: todayISO },
        { name: 'notes', label: 'Catatan', type: 'textarea', maxLength: 500, placeholder: 'Catatan tambahan...' },
      ],
  },
});

export const distToolsConfig = buildConfig({
  key: 'distribusi-alat-steril',
  title: 'Pengambilan Alat Steril',
  subtitle: 'Alat steril siap diambil unit — pakai barcode',
  icon: Truck,
  type: 'ALAT',
  gauze: false,
});

export const distGauzeConfig = buildConfig({
  key: 'distribusi-kasa-steril',
  title: 'Pengambilan Kasa Steril',
  subtitle: 'Pengambilan kasa steril oleh unit — pakai barcode',
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
  filters: [
    { name: 'type', label: 'Jenis', options: [{ value: 'ALAT', label: 'Alat' }, { value: 'KASA', label: 'Kasa' }] },
    { name: 'unit_id', label: 'Unit Tujuan', optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS },
  ],
};

/** Laporan khusus Distribusi Kasa Steril. */
export const distGauzeReportConfig = {
  ...distGauzeConfig,
  key: 'laporan-distribusi-kasa',
  title: 'Laporan Pengambilan Kasa Steril',
  subtitle: 'Rekap otomatis pengambilan kasa lengkap dengan jenis kasa, unit, dan tanda tangan',
  readOnly: true,
  report: true,
  dateFilter: true,
};
