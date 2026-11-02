const TONE_CLASSES = {
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  violet: 'bg-violet-100 text-violet-700',
  slate: 'bg-slate-100 text-slate-600',
};

const STATUS_TONES = {
  Diterima: 'sky',
  Proses: 'amber',
  Selesai: 'emerald',
  Karantina: 'rose',
  Dikemas: 'sky',
  Disterilkan: 'violet',
  Lulus: 'emerald',
  LULUS: 'emerald',
  Gagal: 'rose',
  GAGAL: 'rose',
  'Menunggu Verifikasi': 'amber',
  Tersedia: 'emerald',
  Terdistribusi: 'slate',
  Kedaluwarsa: 'rose',
  MASUK: 'emerald',
  KELUAR: 'amber',
  ALAT: 'sky',
  KASA: 'violet',
  'Diproses ulang': 'sky',
  Dimusnahkan: 'slate',
  Sesuai: 'emerald',
  'Tidak Sesuai': 'rose',
  Baik: 'emerald',
  Rusak: 'rose',
  admin: 'violet',
  petugas: 'sky',
};

export function Badge({ tone = 'slate', children, className = '' }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ value }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-400">-</span>;
  return <Badge tone={STATUS_TONES[value] || 'slate'}>{value}</Badge>;
}

export function BoolBadge({ value, yes = 'Ya', no = 'Tidak' }) {
  return <Badge tone={value ? 'emerald' : 'rose'}>{value ? yes : no}</Badge>;
}

export function ActiveBadge({ value }) {
  return <Badge tone={value ? 'emerald' : 'slate'}>{value ? 'Aktif' : 'Nonaktif'}</Badge>;
}
