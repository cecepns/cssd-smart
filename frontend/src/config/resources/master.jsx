import { Building2, Cog, Layers, Package, ShieldCheck, Tags, UserCheck, Users } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { PACKAGE_TYPES } from '@/utils/constants';
import { fileUrl } from '@/utils/format';
import { ActiveBadge, StatusBadge } from '@/components/ui/Badge';
import { bold, mono } from '@/config/cells';
import { ROUTES } from '@/config/routes';

export const MASTER_TABS = [
  { label: 'Unit', to: ROUTES.MASTER_UNITS, icon: Building2 },
  { label: 'Master Satuan', to: ROUTES.MASTER_ITEM_UNITS, icon: Layers },
  { label: 'Jenis Alat', to: ROUTES.MASTER_ITEMS, icon: Tags },
  { label: 'Mesin', to: ROUTES.MASTER_MACHINES, icon: Cog },
  { label: 'Bahan Kemasan', to: ROUTES.MASTER_PACKAGING_MATERIALS, icon: Package },
  { label: 'Petugas CSSD', to: ROUTES.MASTER_OFFICERS, icon: UserCheck },
  { label: 'Pengguna', to: ROUTES.MASTER_USERS, icon: Users },
];

const activeColumn = { key: 'is_active', label: 'Status', render: (r) => <ActiveBadge value={Boolean(r.is_active)} /> };
const activeField = { name: 'is_active', label: 'Aktif', type: 'checkbox', checkboxLabel: 'Data aktif', default: true };

const masterBase = {
  tabs: MASTER_TABS,
  adminOnlyWrite: true,
  canEdit: true,
  canDelete: true,
  createLabel: 'Tambah Data',
  filters: [{ name: 'is_active', label: 'Status', options: [{ value: '1', label: 'Aktif' }, { value: '0', label: 'Nonaktif' }] }],
};

export const unitsConfig = {
  ...masterBase,
  key: 'master-unit',
  title: 'Data Unit',
  subtitle: 'Daftar unit, penanggung jawab, dan riwayat transaksi',
  icon: Building2,
  endpoint: API_ENDPOINTS.UNITS,
  searchPlaceholder: 'Cari kode, nama unit, penanggung jawab...',
  columns: [
    { key: 'code', label: 'Kode', sortable: true, render: mono('code') },
    { key: 'name', label: 'Nama Unit', sortable: true, render: bold('name') },
    { key: 'pic_name', label: 'Penanggung Jawab', sortable: true },
    { key: 'phone', label: 'Telepon' },
    activeColumn,
  ],
  form: {
    fields: [
      { name: 'code', label: 'Kode unit', required: true, maxLength: 20, placeholder: 'OK' },
      { name: 'name', label: 'Nama unit', required: true, maxLength: 100, placeholder: 'Kamar Operasi' },
      { name: 'pic_name', label: 'Penanggung jawab', maxLength: 100 },
      { name: 'phone', label: 'Telepon', maxLength: 30, type: 'tel' },
      activeField,
    ],
  },
};

export const itemsConfig = {
  ...masterBase,
  key: 'master-jenis-alat',
  title: 'Jenis Alat',
  subtitle: 'Master data instrumen dan alat medis untuk Kategori Steril dan DTT',
  icon: Tags,
  endpoint: API_ENDPOINTS.ITEMS,
  searchPlaceholder: 'Cari kode, nama alat, satuan...',
  filters: [
    { name: 'process_type', label: 'Kategori Proses', options: ['Steril', 'DTT'] },
    { name: 'category', label: 'Kategori Kemasan', options: PACKAGE_TYPES },
    ...masterBase.filters,
  ],
  columns: [
    {
      key: 'photo',
      label: 'Foto',
      render: (r) =>
        r.photo ? (
          <img src={fileUrl(r.photo)} alt={r.name} className="h-10 w-10 rounded-lg border border-slate-200 object-cover" loading="lazy" />
        ) : (
          <span className="text-slate-300">-</span>
        ),
    },
    { key: 'code', label: 'Kode', sortable: true, render: mono('code') },
    { key: 'name', label: 'Nama Alat', sortable: true, render: bold('name') },
    {
      key: 'process_type',
      label: 'Kategori',
      sortable: true,
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
            r.process_type === 'DTT' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'
          }`}
        >
          {r.process_type || 'Steril'}
        </span>
      ),
    },
    { key: 'category', label: 'Jenis Kemasan', sortable: true },
    {
      key: 'unit_label',
      label: 'Satuan',
      render: (r) => <span className="font-semibold text-slate-700">{r.unit_label || 'Set'}</span>,
    },
    { key: 'shelf_life_months', label: 'Masa Steril', render: (r) => `${r.shelf_life_months} bulan` },
    activeColumn,
  ],
  form: {
    subtitle: 'Petugas memilih Kategori (Steril / DTT) kemudian memilih satuan sesuai jenis alat dari Master Satuan.',
    fields: [
      {
        name: 'process_type',
        label: 'Kategori Proses Layanan',
        type: 'select',
        required: true,
        options: ['Steril', 'DTT'],
        default: 'Steril',
        span: 2,
        help: 'Pilih "Steril" untuk instrumen sterilisasi (Autoclave/Plasma), atau "DTT" untuk alat medis reuse (Tabung, Sungkup, Trocar, dll.).',
      },
      { name: 'code', label: 'Kode Alat', required: true, maxLength: 30, placeholder: 'mis. SET-LAP / ALT-GNT / DTT-LMA' },
      { name: 'name', label: 'Nama Alat Medis', required: true, maxLength: 150, placeholder: 'mis. Set Laparotomi / Sungkup Laring / Gunting Hecting' },
      { name: 'category', label: 'Kategori Kemasan', type: 'select', required: true, options: PACKAGE_TYPES, placeholder: 'Pilih kategori kemasan...' },
      {
        name: 'unit_label',
        label: 'Satuan Sesuai Jenis Alat',
        type: 'custom',
        required: true,
        span: 2,
        render: ({ values, setValue }) => {
          const isDtt = values?.process_type === 'DTT';
          const sterilPresets = ['Pcs', 'Set', 'Buah', 'Pasang', 'Lembar', 'Rol', 'Pouch', 'Paket'];
          const dttPresets = ['Pcs', 'Buah', 'Tabung', 'Sungkup', 'Set', 'Paket'];
          const currentPresets = isDtt ? dttPresets : sterilPresets;
          const currentVal = values?.unit_label || (isDtt ? 'Pcs' : 'Set');

          return (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 mr-1">
                  Pilihan Satuan {isDtt ? 'Kategori DTT' : 'Kategori Steril'}:
                </span>
                {currentPresets.map((u) => {
                  const active = currentVal?.toLowerCase() === u.toLowerCase();
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setValue('unit_label', u)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? 'bg-[#0A192F] text-[#E5C07B] shadow-xs ring-1 ring-[#0A192F]'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {u}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={values?.unit_label || ''}
                  onChange={(e) => setValue('unit_label', e.target.value)}
                  placeholder="Ketik atau pilih dari tombol satuan di atas..."
                  className="input input-sm flex-1 text-sm font-semibold"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Satuan juga dapat ditambah atau diedit sewaktu-waktu melalui menu <b>Master Satuan</b>.
              </p>
            </div>
          );
        },
      },
      { name: 'shelf_life_months', label: 'Masa Steril / Exp (bulan)', type: 'number', required: true, min: 1, max: 60, default: 6, help: 'Dipakai menghitung tanggal kedaluwarsa otomatis.' },
      { name: 'description', label: 'Keterangan', maxLength: 255, span: 2 },
      { name: 'photo', label: 'Foto alat', type: 'image' },
      activeField,
    ],
  },
};

export const itemUnitsConfig = {
  ...masterBase,
  key: 'master-satuan',
  title: 'Master Satuan',
  subtitle: 'Pusat pengelolaan satuan alat medis untuk Kategori Steril dan DTT (Pcs, Set, Buah, Tabung, Sungkup, Pasang, Lembar, dll.)',
  icon: Layers,
  endpoint: API_ENDPOINTS.ITEM_UNITS,
  searchPlaceholder: 'Cari kode atau nama satuan...',
  filters: [
    { name: 'category', label: 'Kategori Penggunaan', options: ['Semua', 'Steril', 'DTT'] },
    ...masterBase.filters,
  ],
  columns: [
    { key: 'code', label: 'Kode', sortable: true, render: mono('code') },
    { key: 'name', label: 'Nama Satuan', sortable: true, render: bold('name') },
    {
      key: 'category',
      label: 'Kategori Penggunaan',
      sortable: true,
      render: (r) => {
        const cat = r.category || 'Semua';
        if (cat === 'Steril') {
          return <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">Steril</span>;
        }
        if (cat === 'DTT') {
          return <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800">DTT</span>;
        }
        return <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Semua (Steril & DTT)</span>;
      },
    },
    { key: 'description', label: 'Keterangan' },
    activeColumn,
  ],
  form: {
    subtitle: 'Anda dapat menambah atau mengedit satuan sendiri di sini. Satuan otomatis muncul sebagai pilihan saat menginput alat Steril dan DTT.',
    fields: [
      { name: 'code', label: 'Kode Satuan', required: true, maxLength: 20, placeholder: 'mis. SET / PCS / BUAH / TABUNG / SUNGKUP' },
      { name: 'name', label: 'Nama Satuan', required: true, maxLength: 50, placeholder: 'mis. Pcs / Set / Buah / Tabung / Sungkup / Pasang / Lembar' },
      {
        name: 'category',
        label: 'Kategori Penggunaan',
        type: 'select',
        required: true,
        options: [
          { value: 'Semua', label: 'Semua (Bisa Steril & DTT)' },
          { value: 'Steril', label: 'Kategori Steril' },
          { value: 'DTT', label: 'Kategori DTT' },
        ],
        default: 'Semua',
        help: 'Pilih apakah satuan ini ditujukan untuk alat Steril, DTT, atau Keduanya.',
      },
      { name: 'description', label: 'Keterangan Penggunaan', maxLength: 255, span: 2, placeholder: 'mis. Untuk instrumen satuan / kanul suction / masker anestesi...' },
      activeField,
    ],
  },
};

export const machinesConfig = {
  ...masterBase,
  key: 'master-mesin',
  title: 'Mesin',
  subtitle: 'Autoclave 1, Autoclave 2, Steam Sterilizer, Plasma Sterilizer, DTT Manual, dll.',
  icon: Cog,
  endpoint: API_ENDPOINTS.MACHINES,
  searchPlaceholder: 'Cari kode, nama, atau tipe mesin...',
  filters: [{ name: 'type', label: 'Tipe', options: ['Autoclave 1', 'Autoclave 2', 'Steam Sterilizer', 'Plasma Sterilizer', 'DTT Manual', 'Washer', 'Ultrasonik'] }, ...masterBase.filters],
  columns: [
    { key: 'code', label: 'Kode', sortable: true, render: mono('code') },
    { key: 'name', label: 'Nama Mesin', sortable: true, render: bold('name') },
    { key: 'type', label: 'Tipe', sortable: true },
    activeColumn,
  ],
  form: {
    subtitle: 'Pilih tipe mesin sesuai standar CSSD: Autoclave 1, Autoclave 2, Steam Sterilizer, Plasma Sterilizer, atau DTT Manual.',
    fields: [
      { name: 'code', label: 'Kode', required: true, maxLength: 10, placeholder: 'AU1 / AU2 / ST1 / PL1 / DT1' },
      { name: 'name', label: 'Nama mesin', required: true, maxLength: 100, placeholder: 'Autoclave 1' },
      {
        name: 'type',
        label: 'Tipe mesin',
        type: 'custom',
        required: true,
        span: 2,
        render: ({ values, setValue }) => {
          const PRESETS = [
            'Autoclave 1',
            'Autoclave 2',
            'Steam Sterilizer',
            'Plasma Sterilizer',
            'DTT Manual',
            'Washer',
            'Ultrasonik',
          ];
          const current = values.type || '';
          return (
            <div className="space-y-2">
              <input
                type="text"
                value={current}
                onChange={(e) => setValue('type', e.target.value)}
                placeholder="Pilih dari tombol cepat di bawah atau ketik tipe mesin bebas..."
                className="input-base text-sm"
                required
                maxLength={50}
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-semibold text-slate-400">Pilihan Standar:</span>
                {PRESETS.map((p) => {
                  const isSelected = current.toLowerCase() === p.toLowerCase();
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setValue('type', p);
                        if (!values.name) setValue('name', p);
                      }}
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-brand-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        },
      },
      activeField,
    ],
  },
};

export const usersConfig = {
  ...masterBase,
  key: 'master-pengguna',
  title: 'Pengguna',
  subtitle: 'Akun admin, petugas CSSD, dan akun unit luar',
  icon: ShieldCheck,
  endpoint: API_ENDPOINTS.USERS,
  searchPlaceholder: 'Cari nama, username, atau unit...',
  filters: [{ name: 'role', label: 'Role', options: ['admin', 'petugas', 'unit'] }, ...masterBase.filters],
  columns: [
    { key: 'name', label: 'Nama', sortable: true, render: bold('name') },
    { key: 'username', label: 'Username', sortable: true, render: mono('username') },
    { key: 'role', label: 'Role', sortable: true, render: (r) => <StatusBadge value={r.role} /> },
    { key: 'unit_name', label: 'Unit Luar', render: (r) => r.unit_name || <span className="text-slate-400">-</span> },
    activeColumn,
  ],
  form: {
    fields: [
      { name: 'name', label: 'Nama lengkap', required: true, maxLength: 100 },
      { name: 'username', label: 'Username', required: true, minLength: 3, maxLength: 50, disabledOnEdit: true },
      {
        name: 'password', label: 'Password', type: 'password', requiredOnCreate: true, minLength: 6, maxLength: 72,
        skipEmptyOnEdit: true, help: 'Minimal 6 karakter. Kosongkan saat edit jika tidak diubah.',
      },
      {
        name: 'role',
        label: 'Role Hak Akses',
        type: 'select',
        required: true,
        options: [
          { value: 'admin', label: 'Admin (Akses Penuh)' },
          { value: 'petugas', label: 'Petugas CSSD (Operasional CSSD Penuh)' },
          { value: 'unit', label: 'Unit Luar (Hanya data & transaksi unitnya sendiri)' },
        ],
        default: 'petugas',
      },
      {
        type: 'remote-select',
        name: 'unit_id',
        label: 'Unit Rumah Sakit (Wajib untuk Role Unit Luar)',
        placeholder: 'Pilih unit...',
        optionsEndpoint: API_ENDPOINTS.UNITS.LIST,
        optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
        help: 'Jika role adalah Unit Luar, akun ini hanya bisa melihat dan mengakses transaksi dari unit ini saja.',
      },
      activeField,
    ],
  },
};

export const officersConfig = {
  ...masterBase,
  key: 'master-petugas',
  title: 'Petugas CSSD',
  subtitle: 'Daftar petugas CSSD, peran, dan tanda tangan digital untuk auto-fill transaksi',
  icon: UserCheck,
  endpoint: API_ENDPOINTS.OFFICERS,
  searchPlaceholder: 'Cari NIP, nama petugas, peran...',
  columns: [
    {
      key: 'signature',
      label: 'Tanda Tangan',
      render: (r) =>
        r.signature ? (
          <img
            src={fileUrl(r.signature)}
            alt={`TTD ${r.name}`}
            className="h-9 max-w-[120px] rounded border border-slate-200 bg-white object-contain p-0.5"
            loading="lazy"
          />
        ) : (
          <span className="text-xs italic text-slate-300">Belum ada</span>
        ),
    },
    { key: 'nip', label: 'NIP / ID', sortable: true, render: mono('nip') },
    { key: 'name', label: 'Nama Petugas', sortable: true, render: bold('name') },
    { key: 'role', label: 'Jabatan / Peran', sortable: true },
    { key: 'phone', label: 'Telepon' },
    activeColumn,
  ],
  form: {
    subtitle: 'Data petugas dan tanda tangan digital tersimpan. Tanda tangan ini otomatis terisi pada transaksi penerimaan dan distribusi.',
    fields: [
      { name: 'nip', label: 'NIP / Nomor Identitas', maxLength: 50, placeholder: 'PEG-001' },
      { name: 'name', label: 'Nama petugas', required: true, maxLength: 100, placeholder: 'Nama lengkap' },
      {
        name: 'role',
        label: 'Jabatan / Peran',
        type: 'select',
        required: true,
        options: ['Petugas CSSD', 'Petugas Penerima CSSD', 'Petugas Pengeringan', 'Operator Sterilisasi', 'Petugas Verifikasi', 'Kepala CSSD'],
        default: 'Petugas CSSD',
      },
      { name: 'phone', label: 'Telepon / WhatsApp', maxLength: 30, type: 'tel', placeholder: '0812...' },
      {
        name: 'signature',
        label: 'Tanda tangan digital',
        type: 'signature',
        help: 'Gambarkan tanda tangan petugas di sini. Tanda tangan ini otomatis digunakan saat petugas dipilih pada form transaksi.',
      },
      activeField,
    ],
  },
};

export const packagingMaterialsConfig = {
  ...masterBase,
  key: 'master-bahan-kemasan',
  title: 'Bahan Kemasan',
  subtitle: 'Daftar jenis dan bahan pembungkus alat steril (SMS Wrap, Pouch, Container, Linen, dll.)',
  icon: Package,
  endpoint: API_ENDPOINTS.PACKAGING_MATERIALS,
  searchPlaceholder: 'Cari kode, nama, atau keterangan bahan...',
  columns: [
    { key: 'code', label: 'Kode', sortable: true, render: mono('code') },
    { key: 'name', label: 'Nama Bahan Kemasan', sortable: true, render: bold('name') },
    { key: 'description', label: 'Keterangan' },
    activeColumn,
  ],
  form: {
    subtitle: 'Bahan kemasan ini akan otomatis muncul sebagai opsi di menu Catat Pengemasan.',
    fields: [
      { name: 'code', label: 'Kode bahan', required: true, maxLength: 30, placeholder: 'SMS / POUCH / CONT' },
      { name: 'name', label: 'Nama bahan kemasan', required: true, maxLength: 100, placeholder: 'SMS Wrap / Pouch / Container' },
      { name: 'description', label: 'Keterangan / Spesifikasi', maxLength: 255, placeholder: 'Kain pembungkus standar CSSD tahan panas...' },
      activeField,
    ],
  },
};
