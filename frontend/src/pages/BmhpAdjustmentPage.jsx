import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Save, Search } from 'lucide-react';
import SubNav from '@/components/ui/SubNav';
import { BMHP_TABS } from '@/config/resources/stock';
import { api } from '@/utils/api';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, formatNumber, todayISO } from '@/utils/format';
import { getErrorMessage } from '@/utils/request';
import useFetch from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';

const ADJUSTMENT_TYPES = [
  { value: 'RETUR_MASUK', label: 'Retur Masuk (+ Tambah Stok)', desc: 'Pengembalian BMHP dari ruangan/proses ke stok CSSD', tone: 'emerald' },
  { value: 'RETUR_KELUAR', label: 'Retur Keluar (- Kurang Stok)', desc: 'Pengembalian barang rusak/ED ke gudang farmasi/rekanan', tone: 'rose' },
  { value: 'KOREKSI_TAMBAH', label: 'Koreksi Tambah (+ Stock Opname)', desc: 'Penyesuaian penambahan hasil opname fisik', tone: 'sky' },
  { value: 'KOREKSI_KURANG', label: 'Koreksi Kurang (- Stock Opname)', desc: 'Penyesuaian pengurangan (rusak/selisih fisik)', tone: 'amber' },
];

export default function BmhpAdjustmentPage() {
  const { user } = useAuth();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [batches, setBatches] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    adjustment_type: 'RETUR_MASUK',
    batch_id: '',
    quantity: 1,
    correction_reason: '',
    trx_date: todayISO(),
    officer: user?.name || '',
    notes: '',
  });

  const { data: itemsRes, reload: reloadItems } = useFetch(API_ENDPOINTS.BMHP_ITEMS.LIST, {
    is_active: 1,
    limit: 200,
    sort_by: 'name',
    order: 'asc',
  });
  const items = useMemo(() => itemsRes?.data || itemsRes || [], [itemsRes]);

  const { data: officersRes } = useFetch(API_ENDPOINTS.LOOKUPS.OFFICERS, { is_active: 1, limit: 100 });
  const officers = useMemo(() => officersRes?.data || officersRes || [], [officersRes]);

  useEffect(() => {
    if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(String(items[0].id));
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    if (user?.name && !form.officer) {
      setForm((prev) => ({ ...prev, officer: user.name }));
    }
  }, [user, form.officer]);

  const loadBatches = useCallback(async () => {
    if (!selectedItemId) return;
    try {
      const res = await api.get(API_ENDPOINTS.BMHP_ITEMS.BATCHES, {
        params: { bmhp_item_id: selectedItemId },
      });
      const list = res.data?.data || [];
      setBatches(list);
      if (list.length > 0) {
        setForm((prev) => ({ ...prev, batch_id: String(list[0].id) }));
      } else {
        setForm((prev) => ({ ...prev, batch_id: '' }));
      }
    } catch (e) {}
  }, [selectedItemId]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get(API_ENDPOINTS.BMHP_ITEMS.REPORTS, {
        params: { report_type: 'retur', search: search || undefined },
      });
      setHistory(res.data?.data?.rows || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memuat riwayat retur & koreksi'));
    } finally {
      setLoadingHistory(false);
    }
  }, [search]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.batch_id) {
      toast.error('Pilih batch / kelompok anggaran barang terlebih dahulu');
      return;
    }
    if (!form.correction_reason.trim()) {
      toast.error('Alasan retur / koreksi wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(API_ENDPOINTS.BMHP_ITEMS.ADJUSTMENT, {
        bmhp_item_id: Number(selectedItemId),
        batch_id: Number(form.batch_id),
        adjustment_type: form.adjustment_type,
        quantity: Number(form.quantity),
        correction_reason: form.correction_reason.trim(),
        trx_date: form.trx_date,
        officer: form.officer || user?.name || 'Petugas CSSD',
        notes: form.notes.trim() || form.correction_reason.trim(),
      });
      toast.success(res.data?.message || 'Retur / koreksi stok berhasil dicatat');
      setForm((prev) => ({ ...prev, quantity: 1, correction_reason: '', notes: '' }));
      reloadItems();
      loadBatches();
      loadHistory();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyimpan retur / koreksi'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <SubNav items={BMHP_TABS} />

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-sm">
          <RefreshCw size={22} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Retur & Koreksi Stok BMHP</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Setiap retur/koreksi otomatis memperbarui stok batch, stok fisik barang, Kartu Stok, dan seluruh Laporan BMHP secara real-time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Form Retur / Koreksi */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3.5"
        >
          <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
            Input Transaksi Retur / Koreksi
          </h2>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Jenis Retur / Koreksi *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ADJUSTMENT_TYPES.map((t) => {
                const active = form.adjustment_type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, adjustment_type: t.value })}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      active
                        ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-slate-900">{t.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Nama Barang BMHP *</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="input-base text-xs font-semibold"
              required
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.code}) — Stok: {it.stock} {it.unit_label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Kelompok Batch & Anggaran *</label>
            <select
              value={form.batch_id}
              onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
              className="input-base text-xs font-semibold"
              required
            >
              <option value="">-- Pilih Batch / Anggaran --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.fiscal_year} • {b.budget_source} • Batch {b.batch_no} • ED: {b.expiry_date ? formatDate(b.expiry_date) : '-'} (Sisa: {b.stock})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Jumlah *</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="input-base text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Tanggal Transaksi *</label>
              <input
                type="date"
                value={form.trx_date}
                onChange={(e) => setForm({ ...form, trx_date: e.target.value })}
                className="input-base text-xs font-semibold"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Petugas Pencatat *</label>
            <select
              value={form.officer}
              onChange={(e) => setForm({ ...form, officer: e.target.value })}
              className="input-base text-xs font-semibold"
              required
            >
              <option value={user?.name || 'Petugas CSSD'}>{user?.name || 'Petugas CSSD'}</option>
              {officers.map((o) => (
                <option key={o.id} value={o.name}>{o.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Alasan Retur / Koreksi *</label>
            <textarea
              rows={2}
              value={form.correction_reason}
              onChange={(e) => setForm({ ...form, correction_reason: e.target.value })}
              placeholder="Contoh: Pengembalian sisa pouch bersih dari OK / Koreksi selisih stock opname bulanan / Kemasan robek..."
              className="input-base text-xs"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 py-2.5 text-xs font-extrabold text-white shadow-sm transition disabled:opacity-50"
          >
            <Save size={15} /> {submitting ? 'Menyimpan...' : 'Simpan Retur / Koreksi (Auto Update Stok)'}
          </button>
        </form>

        {/* Riwayat Retur & Koreksi */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-slate-900">
              Riwayat Retur & Koreksi Tercatat ({history.length})
            </h2>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari barang, batch, no ref..."
                className="input-base pl-8 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Tanggal & Ref</th>
                  <th className="px-3 py-2.5">Barang & Batch</th>
                  <th className="px-3 py-2.5">Jenis & Jumlah</th>
                  <th className="px-3 py-2.5">Alasan</th>
                  <th className="px-3 py-2.5">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingHistory ? (
                  <tr><td colSpan={5} className="p-6 text-center text-slate-400">Memuat riwayat...</td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">Belum ada transaksi retur atau koreksi stok.</td></tr>
                ) : (
                  history.map((h) => {
                    const isPlus = h.type === 'RETUR_MASUK' || h.type === 'KOREKSI_TAMBAH';
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2.5">
                          <div className="font-mono font-bold text-brand-700">{h.doc_number || `#${h.id}`}</div>
                          <div className="text-[11px] text-slate-500">{formatDate(h.trx_date)}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-slate-900">{h.item_name}</div>
                          <div className="text-[10px] text-slate-500">
                            {h.fiscal_year} • {h.budget_source} • Batch {h.batch_no || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${isPlus ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {isPlus ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                            {isPlus ? '+' : '-'}{formatNumber(h.quantity)} {h.unit_label}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5">{h.type.replace('_', ' ')}</div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">{h.correction_reason || h.notes || '-'}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-700">{h.officer}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
