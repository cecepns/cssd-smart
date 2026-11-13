import { AlertTriangle, CheckCircle2, Clock, Cpu, Flame, Info, Wrench } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { todayISO, wibDateTimeNow } from '@/utils/format';
import { badge, bold, date, durationBadge, mono, timeWindow } from '@/config/cells.jsx';
import { officerSelectField } from '@/config/officerField';

export const machineLogsConfig = {
  key: 'machine-logs',
  title: 'Log Penggunaan Mesin Washer & Steam',
  subtitle: 'Pencatatan siklus, nomor batch, waktu mulai-selesai, dan kendala mesin Washer & Steam',
  icon: Cpu,
  endpoint: API_ENDPOINTS.MACHINE_LOGS,
  searchPlaceholder: 'Cari kode, nomor mesin, siklus, petugas, muatan...',
  createLabel: 'Catat Penggunaan Mesin',
  defaultSort: 'id',
  dateFilter: true,
  timeFilter: true,
  filters: [
    {
      name: 'machine_type',
      label: 'Tipe Mesin',
      options: [
        { value: 'Washer', label: 'Washer Disinfector' },
        { value: 'Steam', label: 'Steam Sterilizer' },
      ],
    },
    {
      name: 'process_result',
      label: 'Hasil Proses',
      options: [
        { value: 'Berhasil', label: 'Berhasil' },
        { value: 'Gagal', label: 'Gagal' },
      ],
    },
    {
      name: 'has_delay_issue',
      label: 'Kendala Mesin',
      options: [
        { value: '1', label: 'Ada Kendala / Delay' },
        { value: '0', label: 'Lancar Tanpa Kendala' },
      ],
    },
  ],
  columns: [
    { key: 'log_code', label: 'Kode Log', sortable: true, render: mono('log_code') },
    { key: 'log_date', label: 'Tanggal', sortable: true, render: date('log_date') },
    {
      key: 'machine_type',
      label: 'Tipe Mesin',
      sortable: true,
      render: (r) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            r.machine_type === 'Washer' ? 'bg-cyan-100 text-cyan-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {r.machine_type === 'Washer' ? <Cpu size={12} /> : <Flame size={12} />}
          {r.machine_type}
        </span>
      ),
    },
    { key: 'machine_name', label: 'Nama / No. Mesin', sortable: true, render: bold('machine_name') },
    { key: 'cycle_batch_no', label: 'Siklus / Batch', sortable: true },
    { key: 'started_at', label: 'Jam Proses', sortable: true, render: timeWindow },
    { key: 'process_seconds', label: 'Durasi', render: durationBadge },
    {
      key: 'load_description',
      label: 'Muatan Alat',
      render: (r) => (
        <span className="line-clamp-2 max-w-xs text-xs text-slate-700" title={r.load_description}>
          {r.load_description || '-'}
        </span>
      ),
    },
    { key: 'officer', label: 'Operator', sortable: true },
    {
      key: 'process_result',
      label: 'Hasil',
      sortable: true,
      render: (r) => (
        <div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              r.process_result === 'Berhasil' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
          >
            {r.process_result === 'Berhasil' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {r.process_result}
          </span>
          {Boolean(r.has_delay_issue) && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700 font-semibold">
              <AlertTriangle size={10} /> Ada Kendala
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'delay_reason',
      label: 'Kendala & Tindakan',
      render: (r) => {
        if (!r.delay_reason && !r.action_taken) return <span className="text-slate-400">-</span>;
        return (
          <div className="max-w-xs text-[11px] space-y-0.5">
            {r.delay_reason && (
              <p className="text-rose-700 truncate" title={r.delay_reason}>
                <b>Kendala:</b> {r.delay_reason}
              </p>
            )}
            {r.action_taken && (
              <p className="text-slate-600 truncate" title={r.action_taken}>
                <b>Tindakan:</b> {r.action_taken}
              </p>
            )}
          </div>
        );
      },
    },
  ],
  canEdit: true,
  canDelete: true,
  form: {
    size: 'lg',
    fields: [
      {
        type: 'select',
        name: 'machine_type',
        label: 'Tipe Mesin',
        required: true,
        default: 'Washer',
        options: [
          { value: 'Washer', label: 'Washer Disinfector' },
          { value: 'Steam', label: 'Steam Sterilizer / Autoclave' },
        ],
      },
      {
        type: 'remote-select',
        name: 'machine_id',
        label: 'Pilih Mesin dari Master Data',
        required: false,
        placeholder: 'Pilih mesin...',
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.MACHINES,
        optionLabel: (m) => `${m.code} - ${m.name} (${m.type})`,
        autoFillOnMatch: true,
        onChange: (val, ctx) => {
          if (ctx.option?.name) {
            ctx.setValues({ machine_name: ctx.option.name });
          }
        },
      },
      {
        name: 'machine_name',
        label: 'Nama / Nomor Mesin',
        required: true,
        placeholder: 'Contoh: Washer Disinfector 1 / Autoclave Steam 1',
      },
      officerSelectField({
        name: 'officer',
        label: 'Petugas Operator Mesin',
        required: true,
        placeholder: 'Pilih petugas CSSD...',
      }),
      {
        name: 'cycle_batch_no',
        label: 'Nomor Siklus / Batch',
        required: true,
        placeholder: 'Contoh: Siklus 2 / Batch STM-2611-01',
      },
      {
        name: 'log_date',
        label: 'Tanggal Proses',
        type: 'date',
        required: true,
        default: todayISO,
      },
      {
        name: 'started_at',
        label: 'Waktu Mulai Aktual',
        type: 'datetime-local',
        required: true,
        default: () => wibDateTimeNow().slice(0, 16),
      },
      {
        name: 'completed_at',
        label: 'Waktu Selesai Aktual',
        type: 'datetime-local',
        required: true,
        default: () => wibDateTimeNow().slice(0, 16),
      },
      {
        name: 'load_description',
        label: 'Daftar Muatan Instrumen / Set Alat',
        type: 'textarea',
        required: true,
        span: 2,
        placeholder: 'Rincian set alat atau instrumen yang dimasukkan dalam siklus ini (misal: 2 Set Bedah Umum, 1 Set SC, 3 Set Partus)...',
      },
      {
        name: 'temperature',
        label: 'Suhu Mesin (°C)',
        type: 'number',
        placeholder: 'Contoh: 93 (Washer) atau 134 (Steam)',
      },
      {
        name: 'pressure_bar',
        label: 'Tekanan Mesin (Bar)',
        type: 'number',
        placeholder: 'Contoh: 2.1',
      },
      {
        type: 'select',
        name: 'process_result',
        label: 'Hasil Proses Siklus',
        required: true,
        default: 'Berhasil',
        options: [
          { value: 'Berhasil', label: 'Berhasil (Memenuhi Syarat)' },
          { value: 'Gagal', label: 'Gagal / Karantina' },
        ],
      },
      {
        type: 'checkbox',
        name: 'has_delay_issue',
        label: 'Status Kendala',
        checkboxLabel: 'Terdapat kendala mesin atau keterlambatan proses',
        default: false,
      },
      {
        name: 'delay_reason',
        label: 'Catatan Alasan Kendala / Keterlambatan',
        type: 'textarea',
        span: 2,
        placeholder: 'Wajib diisi jika hasil Gagal atau terdapat kendala/keterlambatan (misal: suhu drop, siklus tertunda 30 menit karena pemadaman genset)...',
        help: 'Wajib diisi jika hasil gagal atau opsi kendala dicentang.',
      },
      {
        name: 'action_taken',
        label: 'Tindakan yang Dilakukan (Perbaikan / Penanganan)',
        type: 'textarea',
        span: 2,
        placeholder: 'Wajib diisi jika ada kendala (misal: kalibrasi ulang teknisi, cuci ulang muatan, restart siklus)...',
        help: 'Wajib diisi jika hasil gagal atau opsi kendala dicentang.',
      },
      {
        name: 'notes',
        label: 'Catatan Tambahan',
        type: 'textarea',
        span: 2,
        placeholder: 'Catatan teknis lainnya...',
      },
    ],
  },
};

