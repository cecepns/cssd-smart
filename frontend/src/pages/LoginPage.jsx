import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Leaf, Link2, Lock, ShieldCheck, User, Cog } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes';
import { getErrorMessage, getFieldErrors } from '@/utils/request';

const HIGHLIGHTS = [
  { icon: ShieldCheck, label: 'Aman' },
  { icon: Cog, label: 'Efisien' },
  { icon: Link2, label: 'Terintegrasi' },
  { icon: Leaf, label: 'Paperless' },
];

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to={location.state?.from?.pathname || ROUTES.HOME} replace />;

  const update = (name) => (event) => {
    setForm((prev) => ({ ...prev, [name]: event.target.value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!form.username.trim()) found.username = 'Username wajib diisi';
    if (!form.password) found.password = 'Password wajib diisi';
    if (Object.keys(found).length) return setErrors(found);

    setSubmitting(true);
    try {
      const result = await login(form.username.trim(), form.password);
      toast.success(result.message);
      navigate(location.state?.from?.pathname || ROUTES.HOME, { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Login gagal'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-12 w-12 rounded-xl" />
          <div className="leading-tight">
            <p className="text-2xl font-extrabold">CSSD SMART</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-100">Sterile Management System</p>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">Sistem pencatatan otomatis<br />alat steril RSU Serpong Utara</h1>
          <p className="mt-4 max-w-md text-brand-50">
            Dari alat kotor masuk sampai menjadi alat steril — terhubung, terkunci per tahap, dan tertelusur lewat barcode.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {HIGHLIGHTS.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-bold">
                <item.icon size={15} /> {item.label}
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-brand-100">SMART BARCODE &bull; INVENTORY &bull; TRACEABILITY</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/icon.svg" alt="" className="h-11 w-11 rounded-xl" />
            <div className="leading-tight">
              <p className="text-xl font-extrabold text-slate-900">CSSD SMART</p>
              <p className="text-xs font-semibold text-slate-500">RSU Serpong Utara</p>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900">Masuk</h2>
          <p className="mt-1 text-sm text-slate-500">Gunakan akun petugas CSSD Anda.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-semibold text-slate-700">Username</label>
              <div className="relative">
                <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  value={form.username}
                  onChange={update('username')}
                  disabled={submitting}
                  className={`input-base pl-9 ${errors.username ? 'input-error' : ''}`}
                  placeholder="admin"
                />
              </div>
              {errors.username && <p className="mt-1 text-xs font-medium text-rose-600">{errors.username}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={update('password')}
                  disabled={submitting}
                  className={`input-base px-9 ${errors.password ? 'input-error' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs font-medium text-rose-600">{errors.password}</p>}
            </div>

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              Masuk
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
