import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import BottomNav from '@/components/layout/BottomNav';
import { useAuth } from '@/context/AuthContext';
import { SIDEBAR_KEY } from '@/utils/constants';

const readCollapsed = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
};

export default function AdminLayout() {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* abaikan jika storage tidak tersedia */
      }
      return next;
    });
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    toast.success('Anda telah keluar');
  }, [logout]);

  return (
    <div className="min-h-screen">
      <Topbar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((v) => !v)}
        onToggleCollapse={toggleCollapsed}
        onLogout={handleLogout}
      />
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={handleLogout} />

      <main className={`pt-16 transition-[padding] duration-300 ease-in-out ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-72'}`}>
        <div className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
