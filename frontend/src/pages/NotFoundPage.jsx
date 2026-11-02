import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Compass size={30} />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold text-slate-900">Halaman tidak ditemukan</h1>
      <p className="mt-1 text-sm text-slate-500">Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.</p>
      <Link to={ROUTES.HOME} className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
        Kembali ke Beranda
      </Link>
    </div>
  );
}
