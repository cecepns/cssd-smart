import { Link, useLocation } from 'react-router-dom';
import { Download, LogOut } from 'lucide-react';
import { NAV_SECTIONS } from '@/config/navigation';
import { useAuth } from '@/context/AuthContext';
import useInstallPrompt from '@/hooks/useInstallPrompt';

const isActive = (item, pathname) => {
  if (item.match) return pathname.startsWith(item.match);
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
};

/**
 * Sidebar: off-canvas pada mobile/tablet, collapse (ikon saja) pada desktop.
 * Transisi halus pada transform dan lebar.
 */
export default function Sidebar({ collapsed, mobileOpen, onClose, onLogout }) {
  const { pathname } = useLocation();
  const { user, isAdmin } = useAuth();
  const { installed, install } = useInstallPrompt();
  const isUnit = user?.role === 'unit';
  const hideOnCollapse = collapsed ? 'lg:hidden' : '';

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`no-print fixed inset-0 top-16 z-30 bg-slate-900/40 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
      />

      <aside
        aria-label="Menu utama"
        className={`no-print fixed bottom-0 left-0 top-16 z-30 flex w-72 flex-col border-r border-sky-200/90 bg-white/95 backdrop-blur-md transition-[transform,width] duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } lg:translate-x-0 lg:shadow-[6px_0_24px_-8px_rgba(0,65,165,0.12)] ${collapsed ? 'lg:w-[72px]' : 'lg:w-72'}`}
      >
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-thin">
          {NAV_SECTIONS.map((section, index) => {
            const items = section.items.filter((item) => {
              if (item.adminOnly && !isAdmin) return false;
              if (isUnit && !item.allowUnit) return false;
              return true;
            });
            if (!items.length) return null;
            return (
              <div key={section.title || index} className={index > 0 ? 'mt-5' : ''}>
                {section.title && (
                  <>
                    <p className={`mb-2 px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#0044AA] ${hideOnCollapse}`}>
                      {section.title}
                    </p>
                    {collapsed && <div className="mx-3 mb-2 hidden border-t border-sky-200 lg:block" />}
                  </>
                )}
                <ul className="space-y-1">
                  {items.map((item) => {
                    const active = isActive(item, pathname);
                    return (
                      <li key={item.to + item.label}>
                        <Link
                          to={item.to}
                          title={item.label}
                          aria-current={active ? 'page' : undefined}
                          className={`group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                            active
                              ? 'bg-gradient-to-r from-[#002D85] via-[#0055C4] to-[#007BFF] text-white shadow-[0_4px_14px_rgba(0,90,220,0.32)]'
                              : 'text-[#1E3A5F] hover:bg-sky-50 hover:text-[#0044AA]'
                          } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
                        >
                          <item.icon
                            size={19}
                            className={`shrink-0 ${active ? 'text-white' : 'text-[#1E62C6] group-hover:text-[#0044AA]'}`}
                          />
                          <span className={`truncate ${hideOnCollapse}`}>{item.label}</span>
                          {active && !collapsed && <span className="ml-auto h-5 w-1 rounded-full bg-[#FFD028]" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sky-100 p-3 space-y-2 bg-sky-50/40">
          {!installed && (
            <button
              type="button"
              onClick={install}
              title="Install Aplikasi"
              className={`flex h-10 w-full items-center gap-3 rounded-xl border border-amber-300/90 bg-gradient-to-r from-[#FFF6D6] to-[#FFE89E] px-3 text-sm font-extrabold text-[#002266] shadow-xs transition hover:brightness-105 ${
                collapsed ? 'lg:justify-center lg:px-0' : ''
              }`}
            >
              <Download size={18} className="shrink-0 text-amber-600" />
              <span className={hideOnCollapse}>Install Aplikasi</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            title="Keluar"
            className={`flex h-10 w-full items-center gap-3 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100/80 px-3 text-sm font-bold text-rose-600 transition hover:from-rose-100 hover:to-rose-200/80 ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <LogOut size={19} className="shrink-0" />
            <span className={hideOnCollapse}>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
}
