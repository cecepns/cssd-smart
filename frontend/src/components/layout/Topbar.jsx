import { CalendarDays, Layers, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import NotificationBell from '@/components/layout/NotificationBell';
import UserMenu from '@/components/layout/UserMenu';
import useClock from '@/hooks/useClock';

export default function Topbar({ collapsed, mobileOpen, onToggleMobile, onToggleCollapse, onLogout }) {
  const clock = useClock();

  return (
    <header className="no-print fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-2 sm:gap-3 bg-gradient-to-r from-[#001D5A] via-[#00338E] to-[#00226B] px-3 text-white shadow-[0_4px_20px_rgba(0,35,105,0.28)] border-b border-sky-400/30 sm:px-5">
      {/* Mobile / tablet: buka-tutup sidebar */}
      <button
        type="button"
        onClick={onToggleMobile}
        aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={mobileOpen}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white transition hover:bg-white/25 lg:hidden"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      {/* Desktop: collapse sidebar */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
        className="hidden h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white transition hover:bg-white/25 lg:flex"
      >
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>

      {/* Brand Header: Logo + CSSD SMART & Sterile Management System */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0077FF] to-[#00AEFF] text-white border border-sky-300/60 shadow-[0_0_16px_rgba(0,166,255,0.45)]">
          <Layers size={21} className="text-white drop-shadow-xs" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-2.5">
            <span className="truncate text-lg font-black tracking-tight sm:text-xl text-white">
              CSSD{' '}
              <span className="italic text-[#FFD028] drop-shadow-[0_1px_6px_rgba(255,208,40,0.4)]">
                SMART
              </span>
            </span>
          </div>
          <p className="truncate text-[11px] font-semibold tracking-wide text-sky-100/90">
            Sterile Management System
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        {/* Clock Pill */}
        <div className="hidden items-center gap-2 rounded-full border border-sky-400/50 bg-[#002875]/75 px-3.5 py-1.5 text-xs font-semibold text-white shadow-inner lg:flex">
          <CalendarDays size={14} className="text-[#FFD028]" />
          <span>{clock}</span>
        </div>

        <NotificationBell />
        <UserMenu onLogout={onLogout} />
      </div>
    </header>
  );
}
