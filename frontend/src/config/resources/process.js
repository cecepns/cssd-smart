import { Droplets, Flame, Package, ScanLine, ShieldCheck, Wind } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { INDICATOR_OPTIONS, PACKAGE_TYPES, STAGE_LABELS, UNIT_LABELS, WASH_METHODS } from '@/utils/constants';
import { todayISO, formatDate } from '@/utils/format';
import { badge, bold, date, durationBadge, mono, qty, timeWindow, yesNo } from '@/config/cells.jsx';
import { officerSelectField } from '@/config/officerField';

const fieldDate = (name = 'date', label = 'Tanggal') => ({ name, label, type: 'date', required: true, default: todayISO });
const fieldOfficer = officerSelectField({ name: 'officer', label: 'Petugas CSSD', required: true, placeholder: 'Pilih petugas...' });
const fieldNotes = { name: 'notes', label: 'Catatan', type: 'textarea', maxLength: 500, span: 2 };

/** Opsi alat kotor yang sedang berada di tahap tertentu (otomatis terkunci per tahap). */
const receiptOptions = (stages, extra = {}) => ({
  type: 'remote-select',
  name: 'receipt_id',
  label: 'Alat kotor (barcode)',
  required: true,
  span: 2,
  placeholder: 'Pilih alat kotor...',
  optionsEndpoint: API_ENDPOINTS.RECEIPTS.LIST,
  optionsParams: { stage: stages, status: 'Diterima,Proses' },
  optionLabel: (r) => `${r.barcode} — ${r.item_name} (${r.quantity} ${r.unit_label}) • ${r.unit_name || '-'}`,
  help: 'Hanya alat yang sudah menyelesaikan tahap sebelumnya yang tampil di sini.',
  ...extra,
});

const labelOf = (code, title, subtitle) => ({ code, title, subtitle });

/* ---------------------------------- 1. Alat Kotor Masuk ---------------------------------- */
export const receiptsConfig = {
  key: 'alat-kotor',
  title: 'Alat Kotor Masuk',
  subtitle: 'Penerimaan alat kotor dari unit menggunakan barcode',
  icon: ScanLine,
  endpoint: API_ENDPOINTS.RECEIPTS,
  searchPlaceholder: 'Cari barcode, alat, unit, petugas...',
  createLabel: 'Terima Alat Kotor',
  defaultSort: 'id',
  dateFilter: true,
  timeFilter: true,
  filters: [
    { name: 'unit_id', label: 'Unit Asal', optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS },
    { name: 'status', label: 'Status', options: ['Diterima', 'Proses', 'Selesai', 'Karantina'] },
    { name: 'stage', label: 'Tahap', options: Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label })) },
  ],
  columns: [
    { key: 'barcode', label: 'Barcode', sortable: true, render: mono('barcode') },
    { key: 'receipt_date', label: 'Tanggal', sortable: true, render: date('receipt_date') },
    { key: 'started_at', label: 'Jam Proses', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Lama / Tunggu', render: durationBadge },
    { key: 'unit_name', label: 'Unit Asal', sortable: true },
    { key: 'item_name', label: 'Jenis Alat', sortable: true, render: bold('item_name') },
    { key: 'quantity', label: 'Jumlah', sortable: true, render: qty() },
    { key: 'sender_name', label: 'Penyerah' },
    { key: 'receiver_name', label: 'Penerima' },
    { key: 'stage', label: 'Tahap', sortable: true, render: (r) => STAGE_LABELS[r.stage] || '-' },
    { key: 'status', label: 'Status', sortable: true, render: badge('status') },
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus penerimaan alat kotor ${row.barcode}? Data proses terkait akan ikut dibersihkan.`,
  traceField: 'barcode',
  label: (row) => labelOf(row.barcode, row.item_name, `${row.quantity} ${row.unit_label} • ${row.unit_name || ''} • ${formatDate(row.receipt_date)}`),
  form: {
    size: 'lg',
    createTitle: 'Terima Alat Kotor',
    subtitle: 'Barcode dibuat otomatis (format AK-DDMMYY-001) dan jam mulai/selesai dicatat otomatis. Pilih Unit Asal terlebih dahulu agar daftar alat sesuai unit.',
    fields: [
      fieldDate('receipt_date'),
      {
        type: 'remote-select', name: 'unit_id', label: 'Unit asal', required: true, placeholder: 'Pilih unit...',
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS, optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
        default: ({ user }) => (user?.role === 'unit' && user?.unit_id ? String(user.unit_id) : ''),
        onChange: (next, { values, setValues }) => {
          if (String(next || '') !== String(values?.unit_id || '')) {
            setValues({ item_id: '', item_name: '' });
          }
        },
      },
      {
        type: 'remote-select',
        name: 'item_id',
        label: 'Pilih jenis alat / set instrumen (sesuai unit)',
        placeholder: 'Pilih alat atau set instrumen unit...',
        disabledPlaceholder: 'Pilih Unit Asal terlebih dahulu...',
        emptyText: 'Belum ada alat terdaftar untuk unit ini di Master Alat',
        enabledWhen: (vals) => Boolean(vals?.unit_id),
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.ITEMS,
        optionsParams: (vals) => ({
          is_active: 1,
          sort_by: 'name',
          order: 'asc',
          process_type: 'Steril',
          require_unit: 1,
          unit_id: vals?.unit_id || '',
        }),
        optionLabel: (r) => `${r.name} (${r.category})`,
        onChange: (_, { option, setValues }) => {
          if (!option) return;
          const lower = String(option.unit_label || '').toLowerCase();
          const unitLabel = UNIT_LABELS.includes(lower)
            ? lower
            : option.category === 'Set Instrumen'
              ? 'set'
              : option.category === 'Alat Satuan'
                ? 'pcs'
                : 'paket';
          setValues({ item_name: option.name, unit_label: unitLabel });
        },
      },
      { name: 'item_name', label: 'Nama alat / set', required: true, maxLength: 150, placeholder: 'mis. SET LAPAROTOMI' },
      { name: 'quantity', label: 'Jumlah', type: 'number', required: true, min: 1, default: 1 },
      { name: 'unit_label', label: 'Satuan', type: 'select', required: true, options: UNIT_LABELS, default: 'set' },
      { name: 'sender_name', label: 'Petugas penyerah (unit)', required: true, maxLength: 100 },
      officerSelectField({
        name: 'receiver_name',
        label: 'Petugas penerima (CSSD)',
        required: true,
        placeholder: 'Pilih petugas penerima...',
        onSignatureField: 'receiver_signature',
      }),
      { name: 'sender_signature', label: 'TTD penyerah', type: 'signature' },
      { name: 'receiver_signature', label: 'TTD penerima (otomatis terisi)', type: 'signature' },
      fieldNotes,
    ],
  },
};

/* ---------------------------------- 2. Pencucian ---------------------------------- */
export const washingsConfig = {
  key: 'pencucian',
  title: 'Pencucian',
  subtitle: 'Pencucian alat kotor (DTT / Washer) — tanpa barcode, otomatis terhubung',
  icon: Droplets,
  endpoint: API_ENDPOINTS.WASHINGS,
  searchPlaceholder: 'Cari barcode, alat, petugas...',
  createLabel: 'Catat Pencucian',
  dateFilter: true,
  timeFilter: true,
  filters: [
    { name: 'unit_id', label: 'Unit Asal', optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS },
    { name: 'method', label: 'Metode', options: WASH_METHODS },
  ],
  columns: [
    { key: 'wash_date', label: 'Tanggal', sortable: true, render: date('wash_date') },
    { key: 'started_at', label: 'Jam Proses', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Lama / Tunggu', render: durationBadge },
    { key: 'receipt_barcode', label: 'Barcode Alat Kotor', sortable: true, render: mono('receipt_barcode') },
    { key: 'item_name', label: 'Jenis Alat', sortable: true, render: bold('item_name') },
    { key: 'unit_name', label: 'Unit Asal' },
    { key: 'method', label: 'Metode', sortable: true },
    { key: 'liquid', label: 'Cairan' },
    { key: 'duration_min', label: 'Waktu', render: (r) => (r.duration_min ? `${r.duration_min} menit` : '-') },
    { key: 'officer', label: 'Petugas', sortable: true },
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus data pencucian ${row.receipt_barcode}?`,
  traceField: 'receipt_barcode',
  form: {
    fields: [
      receiptOptions('1,2'),
      { name: 'method', label: 'Metode', type: 'select', required: true, options: WASH_METHODS, default: 'Washer' },
      { name: 'liquid', label: 'Cairan', maxLength: 100, placeholder: 'mis. Prozim Aktif' },
      { name: 'duration_min', label: 'Waktu (menit)', type: 'number', min: 1, max: 600, default: 10 },
      fieldOfficer,
      { ...fieldDate('wash_date') },
      fieldNotes,
    ],
  },
};

/* ---------------------------------- 3. Pengeringan & Pemeriksaan ---------------------------------- */
const dryingPassed = (v) => v.is_dry && v.no_rust && v.function_ok;

export const dryingsConfig = {
  key: 'pengeringan',
  title: 'Pengeringan & Pemeriksaan',
  subtitle: 'Cek alat kering sempurna, bebas karat/noda, dan fungsi baik',
  icon: Wind,
  endpoint: API_ENDPOINTS.DRYINGS,
  searchPlaceholder: 'Cari barcode, alat, petugas...',
  createLabel: 'Catat Pemeriksaan',
  dateFilter: true,
  timeFilter: true,
  filters: [
    { name: 'unit_id', label: 'Unit Asal', optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS },
    { name: 'function_ok', label: 'Fungsi', options: [{ value: '1', label: 'Fungsi baik' }, { value: '0', label: 'Fungsi tidak baik' }] },
  ],
  columns: [
    { key: 'dry_date', label: 'Tanggal', sortable: true, render: date('dry_date') },
    { key: 'started_at', label: 'Jam Proses', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Lama / Tunggu', render: durationBadge },
    { key: 'receipt_barcode', label: 'Barcode Alat Kotor', sortable: true, render: mono('receipt_barcode') },
    { key: 'item_name', label: 'Jenis Alat', sortable: true, render: bold('item_name') },
    { key: 'unit_name', label: 'Unit Asal' },
    { key: 'is_dry', label: 'Kering', render: yesNo('is_dry', 'Ya', 'Tidak') },
    { key: 'no_rust', label: 'Bebas Karat/Noda', render: yesNo('no_rust', 'Ya', 'Tidak') },
    { key: 'function_ok', label: 'Fungsi Baik', render: yesNo('function_ok', 'Ya', 'Tidak') },
    { key: 'officer', label: 'Petugas', sortable: true },
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus data pemeriksaan/pengeringan ${row.receipt_barcode}?`,
  traceField: 'receipt_barcode',
  form: {
    createTitle: 'Pengeringan & Pemeriksaan',
    fields: [
      receiptOptions('2,3', { help: 'Hanya alat yang sudah dicuci yang tampil di sini.' }),
      { name: 'is_dry', label: 'Alat kering sempurna', type: 'checkbox', checkboxLabel: 'Alat kering sempurna', default: true },
      { name: 'no_rust', label: 'Tidak ada karat / noda', type: 'checkbox', checkboxLabel: 'Tidak ada karat / noda', default: true },
      { name: 'function_ok', label: 'Fungsi alat baik', type: 'checkbox', checkboxLabel: 'Fungsi alat baik', default: true },
      fieldOfficer,
      fieldDate('dry_date'),
      fieldNotes,
    ],
    preview: (v) =>
      dryingPassed(v)
        ? { tone: 'ok', text: 'Lolos pemeriksaan: alat lanjut ke tahap Pengemasan.' }
        : { tone: 'fail', text: 'Tidak lolos pemeriksaan: alat otomatis kembali ke tahap Pencucian (cuci ulang).' },
  },
};

/* ---------------------------------- 4. Pengemasan ---------------------------------- */
export const packagingsConfig = {
  key: 'pengemasan',
  title: 'Pengemasan',
  subtitle: 'Pemeriksaan, penyusunan, dan pengemasan alat steril — label barcode dibuat otomatis',
  icon: Package,
  endpoint: API_ENDPOINTS.PACKAGINGS,
  searchPlaceholder: 'Cari label, alat, bahan, petugas...',
  createLabel: 'Catat Pengemasan',
  dateFilter: true,
  timeFilter: true,
  filters: [
    { name: 'unit_id', label: 'Unit Asal', optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS },
    { name: 'package_type', label: 'Jenis', options: PACKAGE_TYPES },
    { name: 'status', label: 'Status', options: ['Dikemas', 'Disterilkan', 'Lulus', 'Karantina', 'Terdistribusi'] },
  ],
  columns: [
    { key: 'barcode', label: 'Label Barcode', sortable: true, render: mono('barcode') },
    { key: 'pack_date', label: 'Tanggal', sortable: true, render: date('pack_date') },
    { key: 'started_at', label: 'Jam Proses', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Lama / Tunggu', render: durationBadge },
    { key: 'item_name', label: 'Jenis Alat', sortable: true, render: bold('item_name') },
    { key: 'unit_name', label: 'Unit Asal' },
    { key: 'package_type', label: 'Jenis Kemasan', sortable: true },
    { key: 'material', label: 'Bahan' },
    { key: 'quantity', label: 'Jumlah', sortable: true, render: qty() },
    { key: 'officer', label: 'Petugas' },
    { key: 'status', label: 'Status', sortable: true, render: badge('status') },
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus kemasan ${row.barcode}?`,
  traceField: 'barcode',
  label: (row) => labelOf(row.barcode, row.item_name, `${row.package_type} • ${row.quantity} ${row.unit_label} • ${formatDate(row.pack_date)}`),
  form: {
    subtitle: 'Label barcode paket dibuat otomatis setelah disimpan.',
    fields: [
      receiptOptions('3', {
        help: 'Hanya alat yang sudah lolos pengeringan & pemeriksaan yang tampil di sini.',
        onChange: (_, { option, setValues }) => option && setValues({ quantity: option.quantity }),
      }),
      {
        name: 'package_type',
        label: 'Jenis kemasan',
        type: 'select',
        required: true,
        options: PACKAGE_TYPES,
        placeholder: 'Pilih jenis...',
        onChange: (val, { setValues }) => {
          if (val === 'Alat Satuan') setValues({ unit_label: 'pcs', material: 'Pouch' });
          else if (val === 'Set Instrumen') setValues({ unit_label: 'set', material: 'SMS Wrap' });
          else if (val === 'Duk & Jas Operasi') setValues({ unit_label: 'paket', material: 'SMS Wrap' });
          else if (val === 'Kasa Steril') setValues({ unit_label: 'pouch', material: 'Pouch' });
        },
      },
      {
        name: 'material',
        label: 'Bahan kemasan',
        type: 'remote-select',
        required: true,
        placeholder: 'Pilih bahan kemasan...',
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.PACKAGING_MATERIALS,
        optionsParams: { is_active: 1, sort_by: 'name', order: 'asc', limit: 100 },
        optionValue: (r) => r.name,
        optionLabel: (r) => r.code ? `${r.name} (${r.code})` : r.name,
        help: 'Dapat ditambah atau diedit di menu Master Data > Bahan Kemasan.',
        default: 'SMS Wrap',
      },
      { name: 'quantity', label: 'Jumlah paket', type: 'number', required: true, min: 1, default: 1 },
      { name: 'unit_label', label: 'Satuan', type: 'select', required: true, options: ['set', 'pcs', 'paket', 'pouch', 'lembar'], default: 'set' },
      fieldOfficer,
      fieldDate('pack_date'),
    ],
  },
};

/* ---------------------------------- 5. Sterilisasi ---------------------------------- */
export const sterilizationsConfig = {
  key: 'sterilisasi',
  title: 'Sterilisasi',
  subtitle: 'Pencatatan siklus Autoclave 1, Autoclave 2, dan Plasma',
  icon: Flame,
  endpoint: API_ENDPOINTS.STERILIZATIONS,
  searchPlaceholder: 'Cari batch, siklus, mesin, petugas...',
  createLabel: 'Catat Sterilisasi',
  dateFilter: true,
  timeFilter: true,
  filters: [{ name: 'status', label: 'Status', options: ['Menunggu Verifikasi', 'Lulus', 'Gagal'] }],
  columns: [
    { key: 'batch_no', label: 'No. Batch', sortable: true, render: mono('batch_no') },
    { key: 'steril_date', label: 'Tanggal', sortable: true, render: date('steril_date') },
    { key: 'started_at', label: 'Jam Proses', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Lama / Tunggu', render: durationBadge },
    { key: 'machine_name', label: 'Mesin', sortable: true },
    { key: 'cycle_no', label: 'Siklus', sortable: true },
    { key: 'temperature', label: 'Suhu', render: (r) => `${r.temperature} °C` },
    { key: 'duration_min', label: 'Waktu', render: (r) => `${r.duration_min} menit` },
    { key: 'total_packages', label: 'Paket' },
    { key: 'officer', label: 'Petugas' },
    { key: 'status', label: 'Status', sortable: true, render: badge('status') },
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus siklus sterilisasi ${row.batch_no}? Status paket akan dikembalikan ke status Dikemas.`,
  traceField: 'batch_no',
  form: {
    size: 'lg',
    subtitle: 'No. batch dibuat otomatis: KODE MESIN-DDMMYY-SIKLUS.',
    fields: [
      {
        type: 'remote-select', name: 'machine_id', label: 'Mesin', required: true, placeholder: 'Pilih mesin...',
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.MACHINES, optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
        optionLabel: (r) => `${r.name} (${r.code})${r.type ? ` • ${r.type}` : ''}`,
        onChange: (_, { option, setValues }) => {
          if (!option) return;
          const t = (option.type || '').toLowerCase();
          if (t.includes('plasma')) {
            setValues({ temperature: 50, duration_min: 45 });
          } else if (t.includes('dtt')) {
            setValues({ temperature: 90, duration_min: 20 });
          } else if (t.includes('washer')) {
            setValues({ temperature: 60, duration_min: 30 });
          } else if (t.includes('eto')) {
            setValues({ temperature: 55, duration_min: 120 });
          } else if (t.includes('dry') || t.includes('oven')) {
            setValues({ temperature: 160, duration_min: 120 });
          } else {
            setValues({ temperature: 134, duration_min: 40 });
          }
        },
      },
      { name: 'cycle_no', label: 'No. siklus', maxLength: 20, placeholder: 'Otomatis', help: 'Kosongkan agar dibuat otomatis.' },
      { name: 'temperature', label: 'Suhu (°C)', type: 'number', required: true, min: 50, max: 200, default: 134 },
      { name: 'duration_min', label: 'Waktu (menit)', type: 'number', required: true, min: 1, max: 600, default: 40 },
      {
        type: 'multicheck', name: 'package_ids', label: 'Paket yang disterilkan', required: true,
        optionsEndpoint: API_ENDPOINTS.PACKAGINGS.LIST, optionsParams: { status: 'Dikemas', sort_by: 'id', order: 'asc' },
        optionLabel: (p) => `${p.barcode} — ${p.item_name} (${p.quantity} ${p.unit_label})`,
        emptyText: 'Belum ada paket dengan status Dikemas. Selesaikan tahap Pengemasan lebih dulu.',
      },
      fieldOfficer,
      fieldDate('steril_date'),
      fieldNotes,
    ],
  },
};

/* ---------------------------------- 6. Verifikasi Sterilisasi ---------------------------------- */
const indicatorField = (name, label) => ({ name, label, type: 'select', required: true, options: INDICATOR_OPTIONS, default: 'Sesuai' });

const verificationReasons = (v) => {
  const reasons = [];
  if (v.condition_packaging === 'Rusak') reasons.push('kondisi kemasan rusak');
  if (v.chem_internal !== 'Sesuai') reasons.push('indikator kimia internal tidak sesuai');
  if (v.chem_external !== 'Sesuai') reasons.push('indikator kimia eksternal tidak sesuai');
  if (v.bio_indicator !== 'Sesuai') reasons.push('indikator biologi tidak sesuai');
  if (v.bowie_dick !== 'Sesuai') reasons.push('Bowie-Dick test tidak sesuai');
  return reasons;
};

export const verificationsConfig = {
  key: 'verifikasi',
  title: 'Verifikasi Sterilisasi',
  subtitle: 'Hasil LULUS masuk Stok Alat Steril, GAGAL otomatis masuk Karantina',
  icon: ShieldCheck,
  endpoint: API_ENDPOINTS.VERIFICATIONS,
  searchPlaceholder: 'Cari batch, siklus, petugas...',
  createLabel: 'Verifikasi Batch',
  dateFilter: true,
  timeFilter: true,
  filters: [{ name: 'result', label: 'Hasil', options: ['LULUS', 'GAGAL'] }],
  columns: [
    { key: 'batch_no', label: 'No. Batch', sortable: true, render: mono('batch_no') },
    { key: 'verify_date', label: 'Tanggal', sortable: true, render: date('verify_date') },
    { key: 'started_at', label: 'Jam Proses', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Lama / Tunggu', render: durationBadge },
    { key: 'machine_name', label: 'Mesin' },
    { key: 'condition_packaging', label: 'Kemasan', render: badge('condition_packaging') },
    { key: 'chem_internal', label: 'Kimia Internal', render: badge('chem_internal') },
    { key: 'chem_external', label: 'Kimia Eksternal', render: badge('chem_external') },
    { key: 'bio_indicator', label: 'Biologi (BI)', render: badge('bio_indicator') },
    { key: 'bowie_dick', label: 'Bowie-Dick', render: badge('bowie_dick') },
    { key: 'result', label: 'Hasil', sortable: true, render: badge('result') },
    { key: 'officer', label: 'Petugas' },
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus verifikasi batch ${row.batch_no}? Status sterilisasi akan dikembalikan ke Menunggu Verifikasi.`,
  traceField: 'batch_no',
  onCreated: (row, { toast }) => {
    if (row?.result === 'GAGAL') toast.error(`Batch ${row.batch_no} GAGAL dan masuk Karantina: ${row.fail_reason}`, { duration: 7000 });
  },
  form: {
    size: 'lg',
    subtitle: 'Hasil dihitung otomatis dari seluruh indikator.',
    fields: [
      {
        type: 'remote-select', name: 'sterilization_id', label: 'Batch sterilisasi', required: true, span: 2, placeholder: 'Pilih batch...',
        optionsEndpoint: API_ENDPOINTS.STERILIZATIONS.LIST, optionsParams: { status: 'Menunggu Verifikasi' },
        optionLabel: (s) => `${s.batch_no} — ${s.machine_name} • ${s.total_packages} paket`,
        help: 'Hanya batch yang belum diverifikasi yang tampil di sini.',
      },
      { name: 'condition_packaging', label: 'Kondisi kemasan', type: 'select', required: true, options: ['Baik', 'Rusak'], default: 'Baik' },
      indicatorField('chem_internal', 'Indikator kimia internal'),
      indicatorField('chem_external', 'Indikator kimia eksternal'),
      indicatorField('bio_indicator', 'Indikator biologi (BI)'),
      indicatorField('bowie_dick', 'Bowie-Dick test'),
      officerSelectField({
        name: 'officer',
        label: 'Petugas verifikasi',
        required: true,
        placeholder: 'Pilih petugas verifikasi...',
        onSignatureField: 'signature',
      }),
      fieldDate('verify_date'),
      { name: 'signature', label: 'TTD verifikasi (otomatis terisi)', type: 'signature' },
      fieldNotes,
    ],
    preview: (v) => {
      const reasons = verificationReasons(v);
      return reasons.length
        ? { tone: 'fail', text: `GAGAL — otomatis masuk Karantina (${reasons.join('; ')}).` }
        : { tone: 'ok', text: 'LULUS — otomatis masuk Stok Alat Steril.' };
    },
  },
};
