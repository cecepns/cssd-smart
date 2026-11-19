import { RefreshCw, Sparkles, Truck, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getList } from '@/utils/request';
import { formatDateTime, fileUrl, wibDateTimeNow } from '@/utils/format';
import { bold, durationBadge, mono, qty, timeWindow } from '@/config/cells';
import { officerSelectField } from '@/config/officerField';
import DttSetSelector from '@/components/distribution/DttSetSelector';

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
 * 1. Barcode Penerimaan Alat Kotor DTT (Reuse) (Unit -> CSSD)
 * ------------------------------------------------------------ */
export const dttReceiptsConfig = {
  key: 'dtt-penerimaan',
  title: 'Penerimaan Alat Kotor DTT (Reuse)',
  subtitle: 'Penerimaan alat medis reuse dari unit ke CSSD — barcode otomatis (RD-...)',
  icon: Sparkles,
  endpoint: API_ENDPOINTS.DTT_RECEIPTS,
  searchPlaceholder: 'Cari barcode RD, alat, unit, petugas...',
  createLabel: 'Terima Alat Kotor DTT',
  defaultSort: 'id',
  dateFilter: true,
  timeFilter: true,
  filters: [
    { name: 'unit_id', label: 'Unit Pengirim', optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS },
    { name: 'tool_condition', label: 'Kondisi Alat', options: TOOL_CONDITIONS },
    { name: 'process_stage', label: 'Tahap Proses', options: DTT_PROCESS_STAGES },
    { name: 'verification_result', label: 'Verifikasi', options: DTT_VERIFY_RESULTS },
  ],
  columns: [
    { key: 'barcode', label: 'Barcode RD', sortable: true, render: mono('barcode') },
    { key: 'receipt_datetime', label: 'Waktu Diterima', sortable: true, render: (r) => formatDateTime(r.receipt_datetime) },
    { key: 'started_at', label: 'Jam Proses', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Lama / Tunggu', render: durationBadge },
    { key: 'unit_name', label: 'Unit Pengirim', sortable: true },
    { key: 'item_name', label: 'Nama Alat Medis', sortable: true, render: bold('item_name') },
    { key: 'quantity', label: 'Jumlah', sortable: true, render: qty() },
    {
      key: 'reuse_count',
      label: 'Reuse Ke-',
      render: (r) => {
        const limit = Number(r.max_reuse_limit) >= 1 && Number(r.max_reuse_limit) <= 6 ? Number(r.max_reuse_limit) : 4;
        const count = Number(r.reuse_count || 1);
        const isDanger = count >= limit;
        const isWarning = !isDanger && count === limit - 1;
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`font-bold ${isDanger ? 'text-rose-700' : isWarning ? 'text-amber-700' : 'text-slate-800'}`}>
              Ke-{count} <span className="text-xs font-normal text-slate-400">/ max {limit}x</span>
            </span>
            {isDanger && (
              <span className="inline-flex w-fit items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-700">
                <AlertTriangle size={10} /> BATAS MAKSIMAL
              </span>
            )}
            {isWarning && (
              <span className="inline-flex w-fit items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                <AlertTriangle size={10} /> WARNING (Sisa 1x)
              </span>
            )}
          </div>
        );
      },
    },
    { key: 'tool_condition', label: 'Kondisi', render: (r) => conditionBadge(r.tool_condition) },
    { key: 'process_stage', label: 'Tahap DTT', render: (r) => <span className="badge badge-info">{r.process_stage}</span> },
    { key: 'sender_name', label: 'Penyerah Unit' },
    { key: 'sender_signature', label: 'TTD Unit', render: renderSignatureCell('sender_signature') },
    { key: 'receiver_name', label: 'Penerima CSSD' },
    { key: 'receiver_signature', label: 'TTD CSSD', render: renderSignatureCell('receiver_signature') },
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
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus penerimaan DTT ${row.barcode}?`,
  traceField: 'barcode',
  form: {
    size: 'lg',
    createTitle: 'Penerimaan Alat Kotor DTT (Reuse)',
    subtitle: 'Barcode penerimaan dibuat otomatis (format RD-DDMMYY-001) dan jam mulai/selesai dicatat otomatis. Pilih Unit Pengirim agar daftar alat sesuai unit.',
    fields: [
      {
        name: 'receipt_datetime',
        label: 'Tanggal & Jam Otomatis',
        type: 'datetime-local',
        required: true,
        default: () => wibDateTimeNow().slice(0, 16).replace(' ', 'T'),
      },
      {
        type: 'remote-select',
        name: 'unit_id',
        label: 'Unit Pengirim',
        required: true,
        placeholder: 'Pilih unit pengirim...',
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS,
        optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
        default: ({ user }) => (user?.role === 'unit' && user?.unit_id ? String(user.unit_id) : ''),
        onChange: (next, { values, setValues }) => {
          if (String(next || '') !== String(values?.unit_id || '')) {
            setValues({ _item_lookup: '', item_code: '', item_name: '' });
          }
        },
      },
      {
        type: 'remote-select',
        name: '_item_lookup',
        label: 'Pilih Alat / Set Medis DTT',
        span: 2,
        noSubmit: true,
        placeholder: 'Pilih alat atau set DTT terdaftar...',
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.ITEMS,
        optionsParams: (vals) => ({
          is_active: 1,
          sort_by: 'name',
          order: 'asc',
          process_type: 'DTT',
          unit_id: vals?.unit_id || '',
        }),
        optionLabel: (r) => `${r.code} — ${r.name}${r.unit_name ? ` [${r.unit_name}]` : ''}${r.unit_label ? ` (${r.unit_label})` : ''}`,
        onChange: async (_, { option, values, setValues }) => {
          if (!option) return;
          const nextUnitId = option.unit_id ? String(option.unit_id) : (values?.unit_id || '');
          const patch = {
            item_code: option.code || '',
            item_name: option.name || '',
            unit_label: option.unit_label || 'Pcs',
            ...(option.unit_id ? { unit_id: String(option.unit_id) } : {}),
          };
          setValues(patch);
          try {
            const res = await getList(API_ENDPOINTS.DTT_RECEIPTS.REUSE_STATUS, {
              item_name: option.name,
              unit_id: nextUnitId,
            });
            const st = res?.data;
            if (st) {
              setValues({
                reuse_count: st.next_reuse || 1,
                max_reuse_limit: st.max_reuse_limit || 4,
              });
            }
          } catch (e) {}
        },
      },
      {
        name: 'item_code',
        label: 'Kode Alat (Opsional)',
        maxLength: 50,
        placeholder: 'mis. DTT-TB-01 / LMA-OK',
      },
      {
        name: 'item_name',
        label: 'Nama Alat Medis DTT / Reuse',
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
        help: 'Otomatis terhitung dari riwayat penerimaan DTT sebelumnya',
      },
      {
        name: 'max_reuse_limit',
        label: 'Batas Maksimal Reuse (3x / 4x)',
        type: 'custom',
        default: 4,
        render: ({ values, setValue }) => {
          const limit = Number(values?.max_reuse_limit || 4);
          const count = Number(values?.reuse_count || 1);
          const isDanger = count >= limit;
          const isWarning = !isDanger && count === limit - 1;
          return (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Batas Maksimal Reuse (Ketentuan Alat)
              </label>
              <div className="flex items-center gap-2">
                {[3, 4].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setValue('max_reuse_limit', preset)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                      limit === preset
                        ? 'bg-brand-700 text-white shadow-sm ring-2 ring-brand-700 ring-offset-1'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Maks {preset}x
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={limit}
                  onChange={(e) => setValue('max_reuse_limit', Math.max(1, parseInt(e.target.value, 10) || 4))}
                  className="input-base w-20 text-center text-xs font-bold"
                />
              </div>
              {isDanger && (
                <div className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-800">
                  <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                  <span>PERINGATAN: Alat sudah mencapai batas maksimal reuse ({count}/{limit}x)! Wajib evaluasi afkir/ganti baru.</span>
                </div>
              )}
              {isWarning && (
                <div className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                  <span>WARNING: Mendekati batas maksimal reuse ({count}/{limit}x — sisa 1x pemakaian lagi).</span>
                </div>
              )}
            </div>
          );
        },
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
        name: 'proof_image',
        label: 'Foto Bukti Serah Terima Alat Kotor DTT (Kamera HP)',
        type: 'image',
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
 * 2. Barcode Distribusi Alat Hasil DTT (Reuse) (CSSD -> Unit)
 * ------------------------------------------------------------ */
export const dttDistributionsConfig = {
  key: 'dtt-distribusi',
  title: 'Pengambilan Alat DTT (Reuse)',
  subtitle: 'Penyerahan kembali alat hasil DTT ke unit — barcode otomatis (DDTT-...)',
  icon: Truck,
  endpoint: API_ENDPOINTS.DTT_DISTRIBUTIONS,
  searchPlaceholder: 'Cari barcode DDTT, alat, unit, petugas...',
  createLabel: 'Pengambilan Alat DTT',
  defaultSort: 'id',
  dateFilter: true,
  timeFilter: true,
  filters: [
    { name: 'unit_id', label: 'Unit Penerima', optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS },
    { name: 'tool_condition', label: 'Kondisi Alat', options: TOOL_CONDITIONS },
  ],
  columns: [
    { key: 'barcode', label: 'Barcode DDTT', sortable: true, render: mono('barcode') },
    { key: 'dist_datetime', label: 'Waktu Pengambilan', sortable: true, render: (r) => formatDateTime(r.dist_datetime) },
    { key: 'started_at', label: 'Jam Proses', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Lama / Tunggu', render: durationBadge },
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
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus pengambilan DTT ${row.barcode}?`,
  traceField: 'barcode',
  form: {
    size: 'lg',
    createTitle: 'Pengambilan Alat DTT (Reuse)',
    subtitle: 'Pilih Set DTT dari Master Data unit penerima. Barcode pengambilan dibuat otomatis (DDTT-DDMMYY-001).',
    fields: [
      {
        name: '_dtt_set_selector',
        type: 'custom',
        span: 2,
        render: ({ values, setValue, setValues }) => (
          <DttSetSelector values={values} setValue={setValue} setValues={setValues} />
        ),
      },
      { name: 'dtt_receipt_id', type: 'hidden' },
      { name: 'item_name', type: 'hidden' },
      { name: 'unit_label', type: 'hidden', default: 'pcs' },
      { name: 'tool_condition', type: 'hidden', default: 'Baik' },
      { name: 'reuse_count', type: 'hidden', default: 1 },
      {
        name: 'dist_datetime',
        label: 'Waktu Pengambilan (Otomatis)',
        type: 'datetime-local',
        required: true,
        default: () => wibDateTimeNow().slice(0, 16).replace(' ', 'T'),
      },
      {
        type: 'remote-select',
        name: 'unit_id',
        label: 'Unit Penerima',
        required: true,
        placeholder: 'Pilih unit penerima...',
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS,
        optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
        default: ({ user }) => (user?.role === 'unit' && user?.unit_id ? String(user.unit_id) : ''),
      },
      { name: 'quantity', label: 'Jumlah', type: 'number', required: true, min: 1, default: 1 },
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
        default: ({ user }) => (user?.role === 'unit' ? user.name : ''),
      },
      {
        name: 'receiver_signature',
        label: 'Tanda Tangan Petugas Unit (Layar HP)',
        type: 'signature',
        required: true,
      },
      {
        name: 'proof_image',
        label: 'Foto Bukti Serah Terima (Kamera HP)',
        type: 'image',
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
 * 3. Laporan Reuse DTT (Otomatis Terintegrasi)
 * ------------------------------------------------------------ */
export const dttControlConfig = {
  ...dttReceiptsConfig,
  key: 'dtt-buku-kontrol',
  title: 'Laporan Reuse DTT',
  subtitle: 'Laporan otomatis siklus reuse alat medis DTT terintegrasi dari Penerimaan & Pengambilan Alat DTT',
  icon: BookOpen,
  readOnly: true,
  report: true,
  dateFilter: true,
};

