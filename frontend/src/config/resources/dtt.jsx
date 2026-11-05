import { RefreshCw, Sparkles, Truck, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getList } from '@/utils/request';
import { formatDateTime, fileUrl, todayISO } from '@/utils/format';
import { bold, mono, qty } from '@/config/cells';
import { officerSelectField } from '@/config/officerField';

export const TOOL_CONDITIONS = ['Baik', 'Perlu Perbaikan', 'Rusak / Afkir'];
export const DTT_PROCESS_STAGES = ['Diterima', 'Pencucian DTT', 'Penyimpanan DTT', 'Siap Distribusi', 'Selesai'];
export const DTT_VERIFY_RESULTS = ['Belum Diverifikasi', 'Lolos', 'Gagal / Cuci Ulang'];

/** Badge warna kondisi alat medis reuse */
export const conditionBadge = (condition) => {
  if (condition === 'Baik') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
        <CheckCircle2 size={12} /> Baik
      </span>
    );
  }
  if (condition === 'Perlu Perbaikan') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
        <AlertTriangle size={12} /> Perlu Perbaikan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
      <AlertTriangle size={12} /> Rusak / Afkir
    </span>
  );
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

/* ------------------------------------------------------------
 * 1. Barcode Penerimaan Alat Kotor DTT (RIUS) (Unit -> CSSD)
 * ------------------------------------------------------------ */
export const dttReceiptsConfig = {
  key: 'dtt-penerimaan',
  title: 'Penerimaan Alat Kotor DTT (RIUS)',
  subtitle: 'Penerimaan alat medis reuse dari unit ke CSSD — barcode otomatis (RD-...)',
  icon: Sparkles,
  endpoint: API_ENDPOINTS.DTT_RECEIPTS,
  searchPlaceholder: 'Cari barcode RD, alat, unit, petugas...',
  createLabel: 'Terima Alat Kotor DTT',
  defaultSort: 'id',
  dateFilter: true,
  filters: [
    { name: 'tool_condition', label: 'Kondisi Alat', options: TOOL_CONDITIONS },
    { name: 'process_stage', label: 'Tahap Proses', options: DTT_PROCESS_STAGES },
    { name: 'verification_result', label: 'Verifikasi', options: DTT_VERIFY_RESULTS },
  ],
  columns: [
    { key: 'barcode', label: 'Barcode RD', sortable: true, render: mono('barcode') },
    { key: 'receipt_datetime', label: 'Waktu Diterima', sortable: true, render: (r) => formatDateTime(r.receipt_datetime) },
    { key: 'unit_name', label: 'Unit Pengirim', sortable: true },
    { key: 'item_name', label: 'Nama Alat Medis', sortable: true, render: bold('item_name') },
    { key: 'quantity', label: 'Jumlah', sortable: true, render: qty() },
    {
      key: 'reuse_count',
      label: 'Reuse Ke-',
      render: (r) => (
        <span className="font-semibold text-slate-800">
          Ke-{r.reuse_count} <span className="text-xs text-slate-400">/ max {r.max_reuse_limit || 10}</span>
        </span>
      ),
    },
    { key: 'tool_condition', label: 'Kondisi', render: (r) => conditionBadge(r.tool_condition) },
    { key: 'process_stage', label: 'Tahap DTT', render: (r) => <span className="badge badge-info">{r.process_stage}</span> },
    { key: 'sender_name', label: 'Penyerah Unit' },
    { key: 'sender_signature', label: 'TTD Unit', render: renderSignatureCell('sender_signature') },
    { key: 'receiver_name', label: 'Penerima CSSD' },
    { key: 'receiver_signature', label: 'TTD CSSD', render: renderSignatureCell('receiver_signature') },
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus penerimaan DTT ${row.barcode}?`,
  traceField: 'barcode',
  form: {
    size: 'lg',
    createTitle: 'Penerimaan Alat Kotor DTT (RIUS)',
    subtitle: 'Barcode penerimaan dibuat otomatis (format RD-DDMMYY-001). Penyerah tanda tangan di layar HP.',
    fields: [
      {
        name: 'receipt_datetime',
        label: 'Tanggal & Jam Otomatis',
        type: 'datetime-local',
        required: true,
        default: () => new Date().toISOString().slice(0, 16),
      },
      {
        type: 'remote-select',
        name: 'unit_id',
        label: 'Unit Pengirim',
        required: true,
        placeholder: 'Pilih unit pengirim...',
        optionsEndpoint: API_ENDPOINTS.UNITS.LIST,
        optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
      },
      {
        name: 'item_code',
        label: 'Kode Alat (Opsional)',
        maxLength: 50,
        placeholder: 'mis. DTT-TB-01 / LMA-OK',
      },
      {
        name: 'item_name',
        label: 'Nama Alat Medis DTT / RIUS',
        required: true,
        maxLength: 150,
        placeholder: 'mis. Sungkup Laring (LMA) / Tabung Suction / Selang Ventilator',
      },
      { name: 'quantity', label: 'Jumlah Alat', type: 'number', required: true, min: 1, default: 1 },
      {
        name: 'unit_label',
        label: 'Satuan Alat DTT',
        type: 'custom',
        required: true,
        span: 2,
        render: ({ values, setValue }) => {
          const dttUnits = ['Pcs', 'Buah', 'Tabung', 'Sungkup', 'Set'];
          const currentVal = values?.unit_label || 'Pcs';
          return (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Satuan Alat DTT</label>
              <div className="flex flex-wrap items-center gap-1.5">
                {dttUnits.map((u) => {
                  const active = currentVal?.toLowerCase() === u.toLowerCase();
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setValue('unit_label', u)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? 'bg-[#0A192F] text-[#E5C07B] ring-1 ring-[#0A192F]'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {u}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={values?.unit_label || ''}
                onChange={(e) => setValue('unit_label', e.target.value)}
                placeholder="Pilih tombol di atas atau ketik satuan lain..."
                className="input input-sm w-full text-sm font-semibold"
              />
              <p className="text-[11px] text-slate-400">
                Tersedia pilihan satuan DTT: Pcs, Buah, Tabung, Sungkup, Set, dan satuan kustom dari Master Satuan.
              </p>
            </div>
          );
        },
      },
      {
        name: 'reuse_count',
        label: 'Riwayat Penggunaan Ulang (Pemakaian Ke-)',
        type: 'number',
        required: true,
        min: 1,
        default: 1,
        help: 'Catat siklus pemakaian ulang alat ini (mis. 1, 2, 3...)',
      },
      {
        name: 'max_reuse_limit',
        label: 'Batas Maksimum Penggunaan Ulang (Reuse)',
        type: 'number',
        min: 1,
        default: 10,
        help: 'Batas rekomendasi pabrik/kebijakan RS sebelum alat harus diafkir/diganti',
      },
      {
        name: 'tool_condition',
        label: 'Kondisi Fisik Alat (Penanda Warna)',
        type: 'select',
        required: true,
        options: TOOL_CONDITIONS,
        default: 'Baik',
        help: 'Hijau: Baik | Kuning: Perlu Perbaikan | Merah: Rusak/Afkir',
      },
      {
        name: 'sender_name',
        label: 'Petugas Unit yang Menyerahkan',
        required: true,
        maxLength: 100,
        placeholder: 'Nama perawat / petugas unit pengirim',
      },
      {
        name: 'sender_signature',
        label: 'Tanda Tangan Digital Petugas Unit (Layar HP)',
        type: 'signature',
        required: true,
      },
      officerSelectField({
        name: 'receiver_name',
        label: 'Petugas CSSD yang Menerima',
        required: true,
        placeholder: 'Pilih nama petugas CSSD penerima...',
        onSignatureField: 'receiver_signature',
      }),
      {
        name: 'receiver_signature',
        label: 'Tanda Tangan Petugas CSSD (Otomatis Terisi)',
        type: 'signature',
      },
      {
        name: 'process_stage',
        label: 'Tahap Proses DTT',
        type: 'select',
        options: DTT_PROCESS_STAGES,
        default: 'Diterima',
      },
      {
        name: 'dtt_method',
        label: 'Metode DTT',
        maxLength: 100,
        default: 'DTT Manual (Perendaman Enzimatik & Disinfektan Tingkat Tinggi)',
      },
      {
        name: 'dtt_liquid',
        label: 'Cairan DTT yang Digunakan',
        maxLength: 100,
        default: 'Glutaraldehyde 2%',
      },
      {
        name: 'dtt_duration_min',
        label: 'Durasi Perendaman DTT (menit)',
        type: 'number',
        min: 1,
        max: 300,
        default: 20,
      },
      {
        name: 'verification_result',
        label: 'Hasil Verifikasi Kebersihan & Kelayakan',
        type: 'select',
        options: DTT_VERIFY_RESULTS,
        default: 'Belum Diverifikasi',
      },
      {
        name: 'notes',
        label: 'Catatan Khusus Alat / Kondisi',
        type: 'textarea',
        maxLength: 500,
        span: 2,
        placeholder: 'Catatan kondisi fisik alat, bagian yang aus, atau instruksi khusus...',
      },
    ],
  },
};

/* ------------------------------------------------------------
 * 2. Barcode Distribusi Alat Hasil DTT (RIUS) (CSSD -> Unit)
 * ------------------------------------------------------------ */
export const dttDistributionsConfig = {
  key: 'dtt-distribusi',
  title: 'Distribusi Alat Hasil DTT (RIUS)',
  subtitle: 'Penyerahan kembali alat hasil DTT ke unit — barcode otomatis (DDTT-...)',
  icon: Truck,
  endpoint: API_ENDPOINTS.DTT_DISTRIBUTIONS,
  searchPlaceholder: 'Cari barcode DDTT, alat, unit, petugas...',
  createLabel: 'Distribusi Hasil DTT',
  defaultSort: 'id',
  dateFilter: true,
  filters: [{ name: 'tool_condition', label: 'Kondisi Alat', options: TOOL_CONDITIONS }],
  columns: [
    { key: 'barcode', label: 'Barcode DDTT', sortable: true, render: mono('barcode') },
    { key: 'dist_datetime', label: 'Waktu Distribusi', sortable: true, render: (r) => formatDateTime(r.dist_datetime) },
    { key: 'receipt_barcode', label: 'Barcode Penerimaan', render: mono('receipt_barcode') },
    { key: 'unit_name', label: 'Unit Penerima', sortable: true },
    { key: 'item_name', label: 'Nama Alat', sortable: true, render: bold('item_name') },
    { key: 'quantity', label: 'Jumlah', sortable: true, render: qty() },
    {
      key: 'reuse_count',
      label: 'Reuse Ke-',
      render: (r) => <span className="font-semibold text-slate-800">Ke-{r.reuse_count}</span>,
    },
    { key: 'tool_condition', label: 'Kondisi', render: (r) => conditionBadge(r.tool_condition) },
    { key: 'officer', label: 'Petugas CSSD' },
    { key: 'officer_signature', label: 'TTD CSSD', render: renderSignatureCell('officer_signature') },
    { key: 'receiver_name', label: 'Penerima Unit' },
    { key: 'receiver_signature', label: 'TTD Unit', render: renderSignatureCell('receiver_signature') },
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus distribusi DTT ${row.barcode}?`,
  traceField: 'barcode',
  form: {
    size: 'lg',
    createTitle: 'Distribusi Alat Hasil DTT (RIUS)',
    subtitle: 'Barcode distribusi dibuat otomatis (DDTT-DDMMYY-001). Petugas unit penerima menandatangani di layar HP.',
    fields: [
      {
        type: 'remote-select',
        name: 'dtt_receipt_id',
        label: 'Pilih Alat Hasil DTT yang Siap Didistribusikan',
        required: true,
        span: 2,
        placeholder: 'Pilih alat DTT siap serah...',
        optionsEndpoint: API_ENDPOINTS.DTT_RECEIPTS.READY,
        optionLabel: (r) =>
          `${r.barcode} — ${r.item_name} (${r.quantity} ${r.unit_label}) • Unit: ${r.unit_name} • Reuse ke-${r.reuse_count} • Kondisi: ${r.tool_condition}`,
        onChange: (_, { option, setValues }) => {
          if (!option) return;
          setValues({
            unit_id: option.unit_id,
            item_name: option.item_name,
            quantity: option.quantity,
            unit_label: option.unit_label,
            reuse_count: option.reuse_count,
            tool_condition: option.tool_condition,
            receiver_name: option.sender_name || '',
          });
        },
      },
      {
        name: 'dist_datetime',
        label: 'Waktu Distribusi (Otomatis)',
        type: 'datetime-local',
        required: true,
        default: () => new Date().toISOString().slice(0, 16),
      },
      {
        type: 'remote-select',
        name: 'unit_id',
        label: 'Unit Penerima',
        required: true,
        placeholder: 'Pilih unit penerima...',
        optionsEndpoint: API_ENDPOINTS.UNITS.LIST,
        optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
      },
      { name: 'item_name', label: 'Nama Alat', required: true, maxLength: 150 },
      { name: 'quantity', label: 'Jumlah', type: 'number', required: true, min: 1, default: 1 },
      { name: 'unit_label', label: 'Satuan', maxLength: 30, default: 'pcs' },
      { name: 'reuse_count', label: 'Penggunaan Ke-', type: 'number', required: true, min: 1, default: 1 },
      {
        name: 'tool_condition',
        label: 'Kondisi Alat saat Diserahkan',
        type: 'select',
        required: true,
        options: TOOL_CONDITIONS,
        default: 'Baik',
      },
      officerSelectField({
        name: 'officer',
        label: 'Petugas CSSD yang Menyerahkan',
        required: true,
        placeholder: 'Pilih petugas CSSD penyerah...',
        onSignatureField: 'officer_signature',
      }),
      {
        name: 'officer_signature',
        label: 'TTD Petugas CSSD (Otomatis Terisi)',
        type: 'signature',
      },
      {
        name: 'receiver_name',
        label: 'Nama Petugas Unit yang Menerima',
        required: true,
        maxLength: 100,
        placeholder: 'Nama perawat / petugas penerima unit',
      },
      {
        name: 'receiver_signature',
        label: 'Tanda Tangan Petugas Unit (Layar HP)',
        type: 'signature',
        required: true,
      },
      {
        name: 'notes',
        label: 'Catatan Serah Terima',
        type: 'textarea',
        maxLength: 500,
        span: 2,
        placeholder: 'Catatan kondisi alat saat diserahkan...',
      },
    ],
  },
};

/* ------------------------------------------------------------
 * 3. Buku Kontrol & Laporan Penggunaan Ulang Alat Medis DTT (RIUS)
 * ------------------------------------------------------------ */
export const dttControlConfig = {
  ...dttReceiptsConfig,
  key: 'dtt-buku-kontrol',
  title: 'Buku Kontrol Penggunaan Ulang Alat Medis DTT (RIUS)',
  subtitle: 'Pencatatan digital kontrol siklus pemakaian ulang alat medis, batas pakai, dan riwayat kondisi',
  icon: BookOpen,
  readOnly: true,
  report: true,
  dateFilter: true,
};

