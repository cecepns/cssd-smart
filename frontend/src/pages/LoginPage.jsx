import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box,
  CameraOff,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  LogIn,
  QrCode,
  ScanBarcode,
  ShieldCheck,
  TrendingUp,
  User,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import useBarcodeScanner from '@/hooks/useBarcodeScanner';
import { ROUTES } from '@/config/routes';
import { getErrorMessage, getFieldErrors } from '@/utils/request';
import loginBg from '../../assets/bg-login.jpeg';

const REMEMBER_KEY = 'cssd_smart_remember_username';

const FEATURES = [
  { icon: ScanBarcode, label: 'Manajemen Barcode' },
  { icon: Box, label: 'Manajemen Inventaris' },
  { icon: ShieldCheck, label: 'Monitoring Sterilisasi' },
  { icon: TrendingUp, label: 'Pelaporan & Traceability' },
];

const readRemembered = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) || '';
  } catch {
    return '';
  }
};

function QrScanModal({ open, onClose, onResolve }) {
  const { videoRef, error, supported } = useBarcodeScanner({ active: open, onDetect: onResolve });
  const [manual, setManual] = useState('');

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manual.trim()) onResolve(manual.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pindai QR Code CSSD SMART"
      subtitle="Arahkan kamera ke QR Code loket/unit atau ketik kode barcode secara manual"
      size="sm"
    >
      <div className="space-y-4">
        {error || !supported ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-sky-100 bg-sky-50/70 py-6 text-center text-xs text-slate-600">
            <CameraOff size={28} className="text-sky-500" />
            <p className="px-4">{error || 'Scan kamera tidak didukung di browser ini.'}</p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-cyan-400/90 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
          </div>
        )}

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Tempel URL QR atau ketik kode barcode..."
            className="input-base font-mono text-xs"
          />
          <Button type="submit" size="md">
            Buka
          </Button>
        </form>
      </div>
    </Modal>
  );
}

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialRemembered = readRemembered();

  const [form, setForm] = useState({ username: initialRemembered, password: '' });
  const [rememberMe, setRememberMe] = useState(Boolean(initialRemembered));
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

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
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, form.username.trim());
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* abaikan bila storage diblokir */
      }
      toast.success(result.message);
      const fromPath = location.state?.from ? `${location.state.from.pathname}${location.state.from.search || ''}` : ROUTES.HOME;
      navigate(fromPath, { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Login gagal'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleQrResolve = (rawValue) => {
    setQrOpen(false);
    const val = String(rawValue || '').trim();
    if (!val) return;

    try {
      const parsed = val.startsWith('http') ? new URL(val) : null;
      const targetPath = parsed ? `${parsed.pathname}${parsed.search}` : val.startsWith('/') ? val : null;

      if (targetPath && targetPath.startsWith(ROUTES.UNIT_TRACKING)) {
        navigate(targetPath);
        return;
      }
      if (targetPath && (!parsed || parsed.origin === window.location.origin)) {
        toast('Silakan masuk terlebih dahulu untuk membuka menu tersebut', { icon: '🔐' });
        navigate(ROUTES.LOGIN, { replace: true, state: { from: { pathname: parsed?.pathname || targetPath, search: parsed?.search || '' } } });
        return;
      }
    } catch {
      /* lanjut ke pengecekan kode barcode */
    }

    toast('Silakan masuk terlebih dahulu untuk melacak barcode ' + val, { icon: '🔐' });
    navigate(ROUTES.LOGIN, {
      replace: true,
      state: { from: { pathname: ROUTES.TRACE, search: `?barcode=${encodeURIComponent(val)}` } },
    });
  };

  return (
    <div className="relative flex min-h-screen w-full items-center overflow-hidden bg-[#001F5F]">
      {/* Background image CSSD modern sesuai referensi */}
      <img
        src={loginBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
        onError={(e) => {
          e.currentTarget.src = '/bg-login.jpeg';
        }}
      />

      {/* Overlay ringan agar teks kiri kontras dan foto alat tetap menonjol */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-[#001440]/70 via-[#002868]/30 to-[#00194A]/20 lg:from-[#001440]/65 lg:via-[#002560]/15 lg:to-transparent"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1300px] flex-col items-center justify-between gap-8 px-5 py-8 sm:px-8 lg:flex-row lg:items-center lg:gap-12 lg:px-12">
        {/* Kolom Kiri: Branding & 4 Kartu Fitur Kaca Cyan */}
        <aside className="flex w-full max-w-xl flex-col items-center text-center text-white lg:items-start lg:text-left">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/50 bg-[#0044AA]/55 shadow-[0_0_24px_rgba(0,180,255,0.4)] backdrop-blur-md sm:h-16 sm:w-16">
              <Layers size={34} className="text-white drop-shadow" />
            </div>
            <div className="leading-tight">
              <p className="text-3xl font-black tracking-tight sm:text-5xl">
                CSSD{' '}
                <span className="italic text-[#FFD028] drop-shadow-[0_2px_12px_rgba(255,208,40,0.45)]">
                  SMART
                </span>
              </p>
              <p className="mt-0.5 text-sm font-semibold tracking-wide text-sky-100 sm:text-lg">
                Sterile Management System
              </p>
            </div>
          </div>

          {/* Garis Cahaya Cyan */}
          <div className="my-5 h-[2px] w-72 max-w-full bg-gradient-to-r from-cyan-300 via-sky-200 to-transparent shadow-[0_0_16px_rgba(34,211,238,0.9)]" />

          <h1 className="text-2xl font-medium italic leading-snug text-white drop-shadow sm:text-3xl lg:text-[32px]">
            Sistem Manajemen Digital
            <br />
            Pelayanan{' '}
            <span className="font-black text-[#FFD028] drop-shadow-[0_2px_10px_rgba(255,208,40,0.35)]">
              CSSD
            </span>
          </h1>

          {/* 4 Feature Glass Cards */}
          <div className="mt-7 hidden w-full grid-cols-2 gap-3 sm:grid sm:grid-cols-4">
            {FEATURES.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-cyan-300/60 bg-gradient-to-b from-[#0055AA]/60 to-[#002866]/75 px-2.5 py-4 text-center backdrop-blur-md shadow-[0_0_24px_rgba(0,180,255,0.28),inset_0_1px_1px_rgba(255,255,255,0.3)] transition hover:border-cyan-200 hover:brightness-110"
              >
                <item.icon size={28} strokeWidth={1.9} className="text-white drop-shadow" />
                <span className="text-[11px] font-semibold leading-tight text-white/95 sm:text-xs">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* Kolom Kanan: Kartu Login Frosted Glass sesuai referensi */}
        <main className="w-full max-w-[430px]">
          <div className="rounded-[28px] border border-white/85 bg-white/85 p-7 shadow-[0_24px_60px_rgba(0,25,75,0.38)] backdrop-blur-xl sm:p-9">
            <div className="text-center">
              <h2 className="text-2xl font-black leading-tight tracking-tight text-[#002266] sm:text-[28px]">
                Selamat Datang
                <br />
                di CSSD{' '}
                <span className="italic text-[#F5A600]">SMART</span>
              </h2>
              <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#00338E]">
                RSUD SERPONG UTARA
              </p>
              <p className="mt-1 text-xs font-bold text-[#1E3A5F] sm:text-sm">
                Silakan masuk untuk mengakses sistem
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <div>
                <label htmlFor="username" className="sr-only">
                  Nama Pengguna (Username)
                </label>
                <div className="relative">
                  <User
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#002266]"
                  />
                  <input
                    id="username"
                    autoComplete="username"
                    autoFocus={!initialRemembered}
                    value={form.username}
                    onChange={update('username')}
                    disabled={submitting}
                    className={`h-12 w-full rounded-full border bg-white/95 pl-11 pr-4 text-sm font-medium text-[#001D5A] shadow-[0_2px_12px_rgba(0,68,170,0.08)] transition placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                      errors.username
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                        : 'border-sky-100 focus:border-[#0066CC] focus:ring-sky-200'
                    }`}
                    placeholder="Nama Pengguna (Username)"
                  />
                </div>
                {errors.username && (
                  <p className="mt-1.5 pl-4 text-xs font-semibold text-rose-600">{errors.username}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Kata Sandi (Password)
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#002266]"
                  />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={update('password')}
                    disabled={submitting}
                    className={`h-12 w-full rounded-full border bg-white/95 pl-11 pr-11 text-sm font-medium text-[#001D5A] shadow-[0_2px_12px_rgba(0,68,170,0.08)] transition placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                      errors.password
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                        : 'border-sky-100 focus:border-[#0066CC] focus:ring-sky-200'
                    }`}
                    placeholder="Kata Sandi (Password)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#002266]/75 transition hover:bg-sky-50 hover:text-[#002266]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 pl-4 text-xs font-semibold text-rose-600">{errors.password}</p>
                )}
              </div>

              <div className="flex items-center justify-between px-1 pt-0.5 text-xs font-bold">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[#002266]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-sky-300 text-[#0055C4] focus:ring-sky-300"
                  />
                  <span>Ingat saya</span>
                </label>

                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-[#0055C4] underline decoration-[#0055C4]/60 underline-offset-2 transition hover:text-[#00338D]"
                >
                  Lupa kata sandi?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0044CC] via-[#0077DD] to-[#00B8E6] text-base font-extrabold text-white shadow-[0_8px_24px_rgba(0,119,221,0.4)] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 size={19} className="animate-spin" /> : <LogIn size={19} />}
                <span>{submitting ? 'Memproses...' : 'Masuk'}</span>
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-300/90" />
              <span className="text-xs font-bold text-slate-600">atau</span>
              <span className="h-px flex-1 bg-slate-300/90" />
            </div>

            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-sky-200/90 bg-white/95 text-sm font-extrabold text-[#002266] shadow-xs transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <QrCode size={18} className="text-[#002266]" />
              <span>Pindai QR Code</span>
            </button>
          </div>
        </main>
      </div>

      {/* Modal Bantuan Lupa Kata Sandi */}
      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Bantuan Reset Kata Sandi"
        subtitle="Informasi pemulihan akses akun CSSD SMART"
        size="sm"
        footer={<Button onClick={() => setForgotOpen(false)}>Mengerti</Button>}
      >
        <div className="flex items-start gap-3 text-sm text-slate-700">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#0044AA]">
            <KeyRound size={20} />
          </div>
          <div className="space-y-2 leading-relaxed">
            <p>
              Demi keamanan data sterilisasi dan rekam transaksi rumah sakit, reset kata sandi hanya dapat
              dilakukan oleh <b>Admin / Kepala Instalasi CSSD</b>.
            </p>
            <p className="text-xs text-slate-500">
              Silakan hubungi Admin CSSD untuk memperbarui kata sandi melalui menu{' '}
              <b>Master Data &rarr; Pengguna</b>. Setelah masuk, Anda juga dapat mengganti kata sandi sendiri di menu{' '}
              <b>Pengaturan</b>.
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal Scanner QR Code */}
      <QrScanModal open={qrOpen} onClose={() => setQrOpen(false)} onResolve={handleQrResolve} />
    </div>
  );
}
