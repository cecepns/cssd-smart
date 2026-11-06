import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, Download, KeyRound, LogOut, Settings, Smartphone, User } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import FormModal from '@/components/form/FormModal';
import { useAuth } from '@/context/AuthContext';
import useInstallPrompt from '@/hooks/useInstallPrompt';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { updateData } from '@/utils/request';
import { ROUTES } from '@/config/routes';

const PASSWORD_FIELDS = [
  { name: 'current_password', label: 'Password saat ini', type: 'password', required: true, span: 2 },
  { name: 'new_password', label: 'Password baru', type: 'password', required: true, minLength: 6, maxLength: 72, span: 2 },
  {
    name: 'confirm_password', label: 'Ulangi password baru', type: 'password', required: true, span: 2, noSubmit: true,
    validate: (value, values) => (value !== values.new_password ? 'Konfirmasi password tidak sama' : ''),
  },
];

function Section({ icon: Icon, title, children }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-slate-900">
        <Icon size={17} className="text-brand-700" /> {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { user, isAdmin, logout } = useAuth();
  const { canInstall, installed, install } = useInstallPrompt();
  const [passwordOpen, setPasswordOpen] = useState(false);

  const changePassword = async (payload) => {
    const res = await updateData(API_ENDPOINTS.AUTH.PASSWORD, payload);
    toast.success(res.message || 'Password berhasil diubah');
    setPasswordOpen(false);
  };

  const handleInstall = async () => {
    if (await install()) toast.success('Aplikasi berhasil dipasang');
  };

  return (
    <div>
      <PageHeader title="Pengaturan" subtitle="Akun, keamanan, dan pemasangan aplikasi" icon={Settings} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={User} title="Akun saya">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-slate-400">Nama</dt><dd className="font-semibold text-slate-800">{user?.name}</dd></div>
            <div><dt className="text-xs text-slate-400">Username</dt><dd className="font-mono font-semibold text-slate-800">{user?.username}</dd></div>
            <div><dt className="text-xs text-slate-400">Role</dt><dd className="mt-0.5"><StatusBadge value={user?.role} /></dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" icon={KeyRound} onClick={() => setPasswordOpen(true)}>Ubah Password</Button>
            <Button variant="danger" icon={LogOut} onClick={() => { logout(); toast.success('Anda telah keluar'); }}>Keluar</Button>
          </div>
        </Section>

        <Section icon={Smartphone} title="Install Aplikasi">
          <p className="text-sm text-slate-600">
            Pasang CSSD SMART langsung di layar utama HP maupun komputer seperti aplikasi biasa, memiliki ikon tersendiri, dan dapat dibuka cepat tanpa perlu mengetik alamat website.
          </p>
          <div className="mt-4">
            {installed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                Aplikasi sudah terpasang di perangkat ini
              </span>
            ) : (
              <Button icon={Download} onClick={handleInstall} className="font-bold">
                Install Aplikasi
              </Button>
            )}
          </div>
        </Section>

        {isAdmin && (
          <Section icon={Building2} title="Master data">
            <p className="text-sm text-slate-600">Kelola unit, jenis alat (masa steril), mesin sterilisasi, dan akun pengguna.</p>
            <Link to={ROUTES.MASTER_UNITS} className="mt-4 inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
              Buka Master Data
            </Link>
          </Section>
        )}
      </div>

      <FormModal
        open={passwordOpen}
        size="sm"
        title="Ubah Password"
        fields={PASSWORD_FIELDS}
        onClose={() => setPasswordOpen(false)}
        onSubmit={changePassword}
      />
    </div>
  );
}
