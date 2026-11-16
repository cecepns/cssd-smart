import { Boxes, Sparkles } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, todayISO } from '@/utils/format';
import { badge, bold, date, expiry, mono, qty } from '@/config/cells';
import { officerSelectField } from '@/config/officerField';
import { GAUZE_TYPES } from '@/config/resources/distribution';

/**
 * Konfigurasi menu: Stok & Produksi Kasa Steril (Khusus Admin/Petugas CSSD).
 * Memungkinkan input saldo awal kasa steril dan pencatatan produksi kasa steril langsung
 * tanpa harus melalui rantai alur penerimaan alat kotor.
 */
export const gauzeStockConfig = {
  key: 'stok-kasa',
  title: 'Stok & Produksi Kasa Steril',
  subtitle: 'Input saldo awal dan pencatatan produksi kasa steril CSSD siap didistribusikan ke unit',
  icon: Boxes,
  endpoint: API_ENDPOINTS.GAUZE_STOCK,
  searchPlaceholder: 'Cari barcode, jenis kasa, batch, petugas...',
  createLabel: 'Input Stok Kasa',
  dateFilter: true,
  filters: [
    {
      name: 'status',
      label: 'Status',
      options: [
        { value: 'Tersedia', label: 'Tersedia' },
        { value: 'Terdistribusi', label: 'Terdistribusi' },
        { value: 'Kedaluwarsa', label: 'Kedaluwarsa' },
      ],
    },
    {
      name: 'origin_unit_id',
      label: 'Unit Tujuan Khusus',
      optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS,
    },
  ],
  columns: [
    { key: 'barcode', label: 'Barcode', sortable: true, render: mono('barcode') },
    { key: 'item_name', label: 'Jenis Kasa', sortable: true, render: bold('item_name') },
    { key: 'quantity', label: 'Sisa Stok', sortable: true, render: qty() },
    { key: 'unit_label', label: 'Satuan', render: (r) => <span className="text-xs text-slate-600">{r.unit_label || 'pouch'}</span> },
    { key: 'batch_no', label: 'No. Batch', sortable: true, render: mono('batch_no') },
    { key: 'sterile_date', label: 'Tgl Steril', sortable: true, render: date('sterile_date') },
    { key: 'expiry_date', label: 'Kedaluwarsa', sortable: true, render: expiry },
    { key: 'origin_unit_name', label: 'Peruntukan Unit', render: (r) => <span className="text-xs font-medium text-slate-700">{r.origin_unit_name || 'Umum / Stok CSSD'}</span> },
    { key: 'officer', label: 'Petugas CSSD' },
    { key: 'display_status', label: 'Status', render: badge('display_status') },
  ],
  canEdit: true,
  canDelete: true,
  deleteMessage: (row) => `Hapus stok kasa steril ${row.barcode} (${row.item_name})? Data stok akan dihapus permanen.`,
  canDeleteRow: (row) => row.status === 'Tersedia',
  traceField: 'barcode',
  label: (row) => ({
    code: row.barcode,
    title: row.item_name,
    subtitle: `Steril: ${formatDate(row.sterile_date)} • Exp: ${formatDate(row.expiry_date)} • Batch: ${row.batch_no || '-'}`,
  }),
  form: {
    size: 'lg',
    createTitle: 'Input Stok / Produksi Kasa Steril',
    editTitle: 'Edit Data Stok Kasa Steril',
    subtitle: 'Barcode resmi (KS-...) dibuat otomatis setelah disimpan dan siap dicetak labelnya.',
    fields: [
      {
        name: 'item_name',
        label: 'Jenis Kasa Steril',
        type: 'custom',
        required: true,
        span: 2,
        render: ({ values, setValue }) => {
          const current = values.item_name || '';
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Sparkles size={13} className="text-brand-600" />
                <span>Pilih cepat jenis kasa standar:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {GAUZE_TYPES.map((gt) => {
                  const isSelected = current === gt;
                  return (
                    <button
                      key={gt}
                      type="button"
                      onClick={() => setValue('item_name', gt)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
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
              <input
                type="text"
                value={current}
                onChange={(e) => setValue('item_name', e.target.value)}
                placeholder="Atau ketik nama jenis kasa lain..."
                className="input-base text-xs font-medium"
              />
            </div>
          );
        },
      },
      {
        name: 'quantity',
        label: 'Jumlah Stok (Paket/Pouch)',
        type: 'number',
        required: true,
        min: 1,
        default: 50,
      },
      {
        name: 'unit_label',
        label: 'Satuan',
        type: 'select',
        required: true,
        options: ['pouch', 'paket', 'lembar', 'roll', 'box'],
        default: 'pouch',
      },
      {
        name: 'batch_no',
        label: 'No. Batch Sterilisasi',
        type: 'text',
        maxLength: 50,
        placeholder: 'Otomatis: KS-BATCH-YYYYMMDD (atau input manual)',
        help: 'Kosongkan jika ingin digenerate otomatis sesuai tanggal steril.',
      },
      {
        name: 'sterile_date',
        label: 'Tanggal Sterilisasi',
        type: 'date',
        required: true,
        default: todayISO,
      },
      {
        name: 'expiry_date',
        label: 'Tanggal Kedaluwarsa',
        type: 'date',
        help: 'Otomatis terhitung +6 bulan dari tanggal steril jika dikosongkan.',
      },
      {
        name: 'unit_id',
        label: 'Peruntukan Unit Khusus (Opsional)',
        type: 'remote-select',
        optionsEndpoint: API_ENDPOINTS.LOOKUPS.UNITS,
        optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
        placeholder: 'Umum / Semua Unit (Stok CSSD)',
        help: 'Pilih unit jika stok ini dipersiapkan khusus untuk unit tertentu (misal: OK / IGD). Kosongkan jika untuk umum.',
      },
      officerSelectField({
        name: 'officer',
        label: 'Petugas CSSD',
        required: true,
        placeholder: 'Pilih petugas penanggung jawab...',
      }),
      {
        name: 'notes',
        label: 'Catatan Stok',
        type: 'textarea',
        maxLength: 500,
        placeholder: 'Contoh: Saldo awal stok rak CSSD / Produksi mandiri kamar bersih...',
        span: 2,
      },
    ],
  },
};
