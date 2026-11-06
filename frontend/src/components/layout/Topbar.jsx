import { CalendarDays, Download, Layers, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from 'lucide-react';
import NotificationBell from '@/components/layout/NotificationBell';
import UserMenu from '@/components/layout/UserMenu';
import useClock from '@/hooks/useClock';
import useInstallPrompt from '@/hooks/useInstallPrompt';
import { useAuth } from '@/context/AuthContext';

export default function Topbar({ collapsed, mobileOpen, onToggleMobile, onToggleCollapse, onLogout }) {
  const clock = useClock();
  const { user } = useAuth();
  const { canInstall, installed, install } = useInstallPrompt();

  const roleLabel =
    user?.role === 'admin'
      ? 'Admin CSSD'
      : user?.role === 'unit'
      ? `Unit: ${user?.unit_name || 'Luar'}`
      : 'Petugas CSSD';

  return (
    <header className="no-print fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-2 sm:gap-3 bg-[#0A192F] px-3 text-white shadow-md border-b border-[#D4AF37]/30 sm:px-5">
      {/* Mobile / tablet: buka-tutup sidebar */}
      <button
        type="button"
        onClick={onToggleMobile}
        aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={mobileOpen}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 lg:hidden"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      {/* Desktop: collapse sidebar */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
        className="hidden h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 lg:flex"
      >
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>

      {/* Brand Header: Logo + CSSD SMART & Subtitle */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30 shadow-xs">
          <Layers size={22} className="text-sky-300" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-black tracking-tight sm:text-xl text-white">CSSD SMART</span>
            <span className="hidden rounded-full bg-[#F59E0B] px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-xs sm:inline-block">
              RSUD SERPONG UTARA
            </span>
          </div>
          <p className="truncate text-[11px] font-semibold tracking-wide text-slate-300">
            Steril Manajemen System
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        {/* Tombol Install Aplikasi di Topbar */}
        {!installed && (
          <button
            type="button"
            onClick={install}
            title="Install Aplikasi CSSD SMART ke Layar Utama"
            className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-black text-slate-950 shadow-xs transition hover:brightness-110 sm:flex"
          >
            <Download size={14} className="stroke-[2.5]" />
            <span>Install Aplikasi</span>
          </button>
        )}

        {/* Badge Tulisan Admin CSSD di bagian kanan atas */}
        <div className="hidden items-center gap-1.5 rounded-full border border-[#D4AF37]/70 bg-[#0A192F] px-3 py-1 text-xs font-bold text-[#FDE68A] shadow-xs md:flex">
          <ShieldCheck size={14} className="text-[#F59E0B]" />
          <span>{roleLabel}</span>
        </div>

        {/* Clock Pill */}
        <div className="hidden items-center gap-2 rounded-full border border-sky-400/20 bg-[#1E3A8A]/60 px-3 py-1 text-xs font-medium text-sky-200 shadow-xs lg:flex">
          <CalendarDays size={14} className="text-[#F59E0B]" />
          <span>{clock}</span>
        </div>

        <NotificationBell />
        <UserMenu onLogout={onLogout} />
      </div>
    </header>
  );
}
