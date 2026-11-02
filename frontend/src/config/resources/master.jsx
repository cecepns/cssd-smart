import { Building2, Cog, ShieldCheck, Tags, UserCheck, Users } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { PACKAGE_TYPES } from '@/utils/constants';
import { fileUrl } from '@/utils/format';
import { ActiveBadge, StatusBadge } from '@/components/ui/Badge';
import { bold, mono } from '@/config/cells';
import { ROUTES } from '@/config/routes';

export const MASTER_TABS = [
  { label: 'Unit', to: ROUTES.MASTER_UNITS, icon: Building2 },
  { label: 'Jenis Alat', to: ROUTES.MASTER_ITEMS, icon: Tags },
  { label: 'Mesin', to: ROUTES.MASTER_MACHINES, icon: Cog },
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
  subtitle: 'Master instrumen, duk & jas, dan kasa beserta masa steril',
  icon: Tags,
  endpoint: API_ENDPOINTS.ITEMS,
  searchPlaceholder: 'Cari kode, nama alat...',
  filters: [{ name: 'category', label: 'Kategori', options: PACKAGE_TYPES }, ...masterBase.filters],
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
    { key: 'category', label: 'Kategori', sortable: true },
    { key: 'shelf_life_months', label: 'Masa Steril', render: (r) => `${r.shelf_life_months} bulan` },
    activeColumn,
  ],
  form: {
    fields: [
      { name: 'code', label: 'Kode', required: true, maxLength: 30, placeholder: 'INS-LAP' },
      { name: 'name', label: 'Nama alat', required: true, maxLength: 150, placeholder: 'Set Laparotomi' },
      { name: 'category', label: 'Kategori', type: 'select', required: true, options: PACKAGE_TYPES, placeholder: 'Pilih kategori...' },
      { name: 'shelf_life_months', label: 'Masa steril (bulan)', type: 'number', required: true, min: 1, max: 60, default: 6, help: 'Dipakai menghitung tanggal kedaluwarsa otomatis.' },
      { name: 'description', label: 'Keterangan', maxLength: 255, span: 2 },
      { name: 'photo', label: 'Foto alat', type: 'image' },
      activeField,
    ],
  },
};

export const machinesConfig = {
  ...masterBase,
  key: 'master-mesin',
  title: 'Mesin',
  subtitle: 'Autoclave, Plasma, Washer, dan DTT',
  icon: Cog,
  endpoint: API_ENDPOINTS.MACHINES,
  searchPlaceholder: 'Cari kode atau nama mesin...',
  filters: [{ name: 'type', label: 'Tipe', options: ['Autoklaf', 'Plasma', 'Washer', 'DTT'] }, ...masterBase.filters],
  columns: [
    { key: 'code', label: 'Kode', sortable: true, render: mono('code') },
    { key: 'name', label: 'Nama Mesin', sortable: true, render: bold('name') },
    { key: 'type', label: 'Tipe', sortable: true },
    activeColumn,
  ],
  form: {
    subtitle: 'Kode mesin dipakai pada nomor batch, mis. AU1-301026-025.',
    fields: [
      { name: 'code', label: 'Kode', required: true, maxLength: 10, placeholder: 'AU1' },
      { name: 'name', label: 'Nama mesin', required: true, maxLength: 100, placeholder: 'Autoclave 1' },
      { name: 'type', label: 'Tipe', type: 'select', required: true, options: ['Autoklaf', 'Plasma', 'Washer', 'DTT'], placeholder: 'Pilih tipe...' },
      activeField,
    ],
  },
};

export const usersConfig = {
  ...masterBase,
  key: 'master-pengguna',
  title: 'Pengguna',
  subtitle: 'Akun admin dan petugas CSSD',
  icon: ShieldCheck,
  endpoint: API_ENDPOINTS.USERS,
  searchPlaceholder: 'Cari nama atau username...',
  filters: [{ name: 'role', label: 'Role', options: ['admin', 'petugas'] }, ...masterBase.filters],
  columns: [
    { key: 'name', label: 'Nama', sortable: true, render: bold('name') },
    { key: 'username', label: 'Username', sortable: true, render: mono('username') },
    { key: 'role', label: 'Role', sortable: true, render: (r) => <StatusBadge value={r.role} /> },
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
      { name: 'role', label: 'Role', type: 'select', required: true, options: ['petugas', 'admin'], default: 'petugas' },
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
