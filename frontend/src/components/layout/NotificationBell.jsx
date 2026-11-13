import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  Archive,
  ArrowRight,
  Bell,
  CalendarX,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  Package,
  PackageX,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/utils/api';
import useFetch from '@/hooks/useFetch';
import useClickOutside from '@/hooks/useClickOutside';
import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { ROUTES } from '@/config/routes';
import { fileUrl, formatDate, formatDateTime } from '@/utils/format';

export default function NotificationBell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('activity'); // 'activity' | 'system'
  const [activities, setActivities] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({});

  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);

  // Fetch dashboard alert counts
  const { data: dashData } = useFetch(API_ENDPOINTS.DASHBOARD, undefined, { refreshKey: pathname });
  const totals = dashData?.totals || {};

  const systemAlerts = [
    { count: totals.bmhp_empty, label: 'BMHP stok HABIS (0)', to: `${ROUTES.BMHP_STOCK}?stock_status=empty`, icon: PackageX, tone: 'text-rose-600 bg-rose-50' },
    { count: totals.bmhp_expired, label: 'BMHP telah kedaluwarsa', to: `${ROUTES.BMHP_STOCK}?expiry_status=expired`, icon: CalendarX, tone: 'text-rose-600 bg-rose-50' },
    { count: totals.quarantine, label: 'paket di Karantina / Gagal', to: isAdmin ? ROUTES.REPORT('karantina') : ROUTES.VERIFICATIONS, icon: AlertOctagon, tone: 'text-rose-600 bg-rose-50' },
    { count: totals.expired, label: 'paket steril kedaluwarsa', to: isAdmin ? ROUTES.REPORT('stok-steril') : null, icon: CalendarX, tone: 'text-rose-600 bg-rose-50' },
    { count: totals.bmhp_low, label: 'BMHP stok menipis (≤ min)', to: `${ROUTES.BMHP_STOCK}?stock_status=low`, icon: Archive, tone: 'text-amber-600 bg-amber-50' },
    { count: totals.bmhp_expiring_soon, label: 'BMHP mendekati kedaluwarsa (≤30 hr)', to: `${ROUTES.BMHP_STOCK}?expiry_status=expiring`, icon: Clock, tone: 'text-amber-600 bg-amber-50' },
    { count: totals.waiting_verification, label: 'batch menunggu verifikasi', to: ROUTES.VERIFICATIONS, icon: ShieldCheck, tone: 'text-sky-600 bg-sky-50' },
  ].filter((a) => Number(a.count) > 0);

  const totalSystemAlerts = systemAlerts.reduce((acc, curr) => acc + Number(curr.count || 0), 0);

  const fetchActivities = useCallback(async () => {
    try {
      setLoadingActivities(true);
      const res = await api.get(API_ENDPOINTS.NOTIFICATIONS.LIST, { params: { limit: 25 } });
      if (res.data?.success) {
        setActivities(res.data.data || []);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [fetchActivities, pathname]);

  const handleMarkAllRead = async () => {
    try {
      await api.post(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
      setActivities((prev) => prev.map((a) => ({ ...a, is_read: 1 })));
      setUnreadCount(0);
      toast.success('Semua notifikasi ditandai sudah dibaca');
    } catch {
      toast.error('Gagal menandai notifikasi');
    }
  };

  const handleOpenItem = async (item) => {
    setOpen(false);
    // Mark as read in background if unread
    if (!item.is_read) {
      try {
        await api.post(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(item.id));
        setActivities((prev) => prev.map((a) => (a.id === item.id ? { ...a, is_read: 1 } : a)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {}
    }

    let payload = {};
    if (typeof item.data_payload === 'string') {
      try {
        payload = JSON.parse(item.data_payload);
      } catch {
        payload = {};
      }
    } else if (item.data_payload && typeof item.data_payload === 'object') {
      payload = item.data_payload;
    }

    setSelectedItem(item);
    setEditForm({
      item_name: item.item_name || payload.item_name || '',
      quantity: item.quantity ?? payload.quantity ?? 1,
      unit_label: item.unit_label || payload.unit_label || 'set',
      sender_name: item.officer_sender || payload.sender_name || payload.officer || '',
      receiver_name: item.officer_receiver || payload.receiver_name || '',
      notes: payload.notes || '',
      trx_date: item.trx_date || payload.receipt_date || payload.dist_date || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSavingEdit(true);

    try {
      let targetEndpoint = null;
      let targetBody = {};

      if (selectedItem.ref_table === 'dirty_receipts') {
        targetEndpoint = API_ENDPOINTS.RECEIPTS.DETAIL(selectedItem.ref_id);
        targetBody = {
          item_name: editForm.item_name,
          quantity: Number(editForm.quantity),
          unit_label: editForm.unit_label,
          sender_name: editForm.sender_name,
          receiver_name: editForm.receiver_name,
          receipt_date: editForm.trx_date,
          notes: editForm.notes,
        };
      } else if (selectedItem.ref_table === 'distributions') {
        targetEndpoint = API_ENDPOINTS.DISTRIBUTIONS.DETAIL(selectedItem.ref_id);
        targetBody = {
          quantity: Number(editForm.quantity),
          officer: editForm.sender_name,
          receiver_name: editForm.receiver_name,
          dist_date: editForm.trx_date,
          notes: editForm.notes,
        };
      } else if (selectedItem.ref_table === 'dtt_receipts') {
        targetEndpoint = API_ENDPOINTS.DTT_RECEIPTS.DETAIL(selectedItem.ref_id);
        targetBody = {
          item_name: editForm.item_name,
          quantity: Number(editForm.quantity),
          unit_label: editForm.unit_label,
          sender_name: editForm.sender_name,
          receiver_name: editForm.receiver_name,
          notes: editForm.notes,
        };
      } else if (selectedItem.ref_table === 'dtt_distributions') {
        targetEndpoint = API_ENDPOINTS.DTT_DISTRIBUTIONS.DETAIL(selectedItem.ref_id);
        targetBody = {
          quantity: Number(editForm.quantity),
          unit_label: editForm.unit_label,
          officer: editForm.sender_name,
          receiver_name: editForm.receiver_name,
          notes: editForm.notes,
        };
      } else if (selectedItem.ref_table === 'unit_requisitions') {
        targetEndpoint = API_ENDPOINTS.UNIT_REQUISITIONS.DETAIL(selectedItem.ref_id);
        targetBody = {
          quantity: Number(editForm.quantity),
          unit_label: editForm.unit_label,
          requester_name: editForm.sender_name,
          notes: editForm.notes,
        };
      }

      if (targetEndpoint) {
        await api.put(targetEndpoint, targetBody);
        toast.success('Perubahan data transaksi berhasil disimpan!');
        setSelectedItem(null);
        fetchActivities();
      } else {
        toast.success('Data tersimpan');
        setSelectedItem(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan perubahan');
    } finally {
      setSavingEdit(false);
    }
  };

  const getTargetRoute = (item) => {
    if (!item) return ROUTES.HOME;
    if (item.ref_table === 'dirty_receipts') return ROUTES.RECEIPTS;
    if (item.ref_table === 'distributions') return item.type === 'KASA' ? ROUTES.DIST_GAUZE : ROUTES.DIST_TOOLS;
    if (item.ref_table === 'dtt_receipts') return ROUTES.DTT_RECEIPTS;
    if (item.ref_table === 'dtt_distributions') return ROUTES.DTT_DISTRIBUTIONS;
    if (item.ref_table === 'unit_requisitions') return ROUTES.UNIT_REQUISITIONS;
    return ROUTES.HOME;
  };

  const totalBadge = unreadCount + totalSystemAlerts;

  const renderSignature = (sig, label) => {
    if (!sig) return <span className="text-xs italic text-slate-400">Tidak ada TTD digital</span>;
    const src = sig.startsWith('data:') || sig.startsWith('http') ? sig : fileUrl(sig);
    return (
      <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-2">
        <span className="mb-1 text-[11px] font-semibold text-slate-500">{label}</span>
        <img src={src} alt={label} className="h-16 max-w-full object-contain" />
      </div>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) fetchActivities();
        }}
        aria-label="Notifikasi"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#002266] shadow-md transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <Bell size={19} />
        {totalBadge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white ring-2 ring-[#002D85] animate-pulse">
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[92vw] max-h-[85vh] animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-gradient-to-r from-slate-50 to-blue-50/50">
            <div>
              <p className="text-sm font-bold text-slate-900">Pusat Notifikasi CSSD</p>
              <p className="text-[11px] text-slate-500">Pantau transaksi unit & sistem secara real-time</p>
            </div>
            {unreadCount > 0 && activeTab === 'activity' && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-brand-700 hover:bg-white transition"
              >
                <CheckCheck size={14} /> Tandai Dibaca
              </button>
            )}
          </div>

          {/* Dual Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-100/70 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                activeTab === 'activity' ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Aktivitas Masuk</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-brand-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                activeTab === 'system' ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Peringatan Sistem</span>
              {totalSystemAlerts > 0 && (
                <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {totalSystemAlerts}
                </span>
              )}
            </button>
          </div>

          {/* Content Area */}
          <div className="overflow-y-auto max-h-[60vh] divide-y divide-slate-100">
            {activeTab === 'activity' ? (
              loadingActivities && activities.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-brand-600" />
                </div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="mx-auto mb-2 text-slate-300" size={36} />
                  <p className="text-sm font-medium text-slate-700">Belum ada aktivitas masuk</p>
                  <p className="text-xs text-slate-400">Penerimaan alat kotor & distribusi unit akan muncul di sini</p>
                </div>
              ) : (
                activities.map((item) => {
                  const isUnread = !item.is_read;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleOpenItem(item)}
                      className={`w-full text-left p-3.5 transition flex gap-3 items-start hover:bg-sky-50/70 ${
                        isUnread ? 'bg-sky-50/30' : 'bg-white'
                      }`}
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                        {item.type === 'RECEIPT' ? (
                          <ScanLine size={18} />
                        ) : item.type === 'DISTRIBUTION' ? (
                          <Truck size={18} />
                        ) : item.type === 'DTT_RECEIPT' ? (
                          <Sparkles size={18} />
                        ) : (
                          <Package size={18} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-slate-900 truncate">{item.title}</span>
                          {isUnread && <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" />}
                        </div>
                        <p className="text-xs font-semibold text-brand-900 truncate">
                          {item.item_name} <span className="text-slate-500 font-normal">({item.quantity} {item.unit_label})</span>
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          {item.unit_name && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                              {item.unit_name}
                            </span>
                          )}
                          {item.barcode && (
                            <span className="font-mono text-[10px] text-brand-700 font-bold bg-brand-50 px-1 rounded">
                              {item.barcode}
                            </span>
                          )}
                          <span>•</span>
                          <span>{item.trx_date} {item.trx_time ? `${item.trx_time} WIB` : ''}</span>
                        </div>
                        {(item.officer_sender || item.officer_receiver) && (
                          <p className="mt-1 text-[11px] text-slate-600 truncate">
                            👤 {item.officer_sender || '-'} → {item.officer_receiver || '-'}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )
            ) : systemAlerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Semua aman, tidak ada peringatan aktif.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {systemAlerts.map((alert) => (
                  <li key={alert.label}>
                    {alert.to ? (
                      <Link
                        to={alert.to}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50 transition-colors"
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${alert.tone}`}>
                          <alert.icon size={17} />
                        </span>
                        <span className="text-slate-700">
                          <b className="text-slate-900">{alert.count}</b> {alert.label}
                        </span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 text-sm">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${alert.tone}`}>
                          <alert.icon size={17} />
                        </span>
                        <span className="text-slate-700">
                          <b className="text-slate-900">{alert.count}</b> {alert.label}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Modal Detail & Edit Transaksi Notifikasi */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-gradient-to-r from-brand-900 to-[#002D85] text-white rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold">Verifikasi & Ubah Transaksi Masuk</h3>
                <p className="text-xs text-sky-100">Data otomatis terisi lengkap, langsung klik Simpan Perubahan</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-full p-1 text-sky-200 hover:bg-white/20 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Summary Pill */}
            <div className="bg-sky-50 px-6 py-3 border-b border-sky-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-brand-900">{selectedItem.title}</span>
                {selectedItem.barcode && (
                  <span className="font-mono bg-white px-2 py-0.5 rounded font-bold text-brand-700 border border-sky-200">
                    {selectedItem.barcode}
                  </span>
                )}
              </div>
              <span className="text-slate-600 font-medium">
                Unit: <b className="text-slate-900">{selectedItem.unit_name || '-'}</b>
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Alat / Set Instrumen</label>
                  <input
                    type="text"
                    value={editForm.item_name}
                    onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={editForm.unit_label}
                    onChange={(e) => setEditForm({ ...editForm, unit_label: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Transaksi</label>
                  <input
                    type="date"
                    value={editForm.trx_date}
                    onChange={(e) => setEditForm({ ...editForm, trx_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Petugas Penyerah</label>
                  <input
                    type="text"
                    value={editForm.sender_name}
                    onChange={(e) => setEditForm({ ...editForm, sender_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Petugas Penerima</label>
                  <input
                    type="text"
                    value={editForm.receiver_name}
                    onChange={(e) => setEditForm({ ...editForm, receiver_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="Catatan bila ada perubahan..."
                  />
                </div>
              </div>

              {/* Tanda Tangan Digital Preview */}
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs font-bold text-slate-800 mb-2">Tanda Tangan Digital Tersimpan:</p>
                <div className="grid grid-cols-2 gap-3">
                  {renderSignature(selectedItem.signature_sender, `Penyerah (${selectedItem.officer_sender || '-'})`)}
                  {renderSignature(selectedItem.signature_receiver, `Penerima (${selectedItem.officer_receiver || '-'})`)}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const to = getTargetRoute(selectedItem);
                    setSelectedItem(null);
                    navigate(to);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
                >
                  <ExternalLink size={14} /> Buka Halaman Transaksi Penuh
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex items-center gap-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 px-5 py-2 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
                  >
                    {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
