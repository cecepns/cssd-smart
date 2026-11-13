import { useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FilePlus2,
  Filter,
  Layers,
  ListChecks,
  Loader2,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  User,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/utils/api';
import useFetch from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, todayISO } from '@/utils/format';

export default function UnitRequisitionsPage() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('requisition'); // 'requisition' | 'proposal'

  // Tab 1: Kebutuhan Operasi
  const [reqPage, setReqPage] = useState(1);
  const [reqSearch, setReqSearch] = useState('');
  const [reqStatus, setReqStatus] = useState('');
  const [openReqModal, setOpenReqModal] = useState(false);
  const [submittingReq, setSubmittingReq] = useState(false);

  // Tab 2: Pengajuan Alat Baru
  const [propPage, setPropPage] = useState(1);
  const [propSearch, setPropSearch] = useState('');
  const [openPropModal, setOpenPropModal] = useState(false);
  const [submittingProp, setSubmittingProp] = useState(false);

  // Status Change Modal
  const [statusModal, setStatusModal] = useState({ open: false, item: null, targetStatus: '', reason: '' });
  const [rejectPropModal, setRejectPropModal] = useState({ open: false, item: null, reason: '' });

  // Fetch Lookups
  const { data: unitsData } = useFetch(API_ENDPOINTS.LOOKUPS.UNITS);
  const units = unitsData || [];

  const { data: itemsLookup } = useFetch(API_ENDPOINTS.LOOKUPS.ITEMS);
  const availableItems = itemsLookup || [];

  // Tab 1 Fetch Requisitions
  const reqParams = {
    page: reqPage,
    limit: 10,
    search: reqSearch || undefined,
    status: reqStatus || undefined,
    sort_by: 'id',
    order: 'desc',
  };
  const { data: reqData, loading: reqLoading, refetch: refetchReq } = useFetch(API_ENDPOINTS.UNIT_REQUISITIONS.LIST, reqParams);
  const requisitions = reqData?.data || [];
  const reqPagination = reqData?.pagination || { total: 0, totalPages: 1 };

  // Tab 2 Fetch Proposals
  const propParams = {
    page: propPage,
    limit: 10,
    search: propSearch || undefined,
    sort_by: 'id',
    order: 'desc',
  };
  const { data: propData, loading: propLoading, refetch: refetchProp } = useFetch(API_ENDPOINTS.ITEM_PROPOSALS.LIST, propParams);
  const proposals = propData?.data || [];
  const propPagination = propData?.pagination || { total: 0, totalPages: 1 };

  // Form State: Requisition
  const [reqItems, setReqItems] = useState([
    { item_name: '', quantity: 1, unit_label: 'Set' }
  ]);
  const [reqForm, setReqForm] = useState({
    unit_id: user?.unit_id || '',
    procedure_name: '',
    procedure_count: 1,
    procedure_date: todayISO(),
    procedure_time: '08:00',
    room_name: 'Kamar Operasi (OK)',
    requester_name: user?.name || '',
    notes: '',
  });

  // Form State: Proposal
  const [propForm, setPropForm] = useState({
    unit_id: user?.unit_id || '',
    item_name: '',
    category: 'Set Instrumen',
    unit_label: 'Set',
    proposed_quantity: 1,
    reason: '',
    requester_name: user?.name || '',
  });

  // Handle Create Requisition
  const handleSaveRequisition = async (e) => {
    e.preventDefault();
    if (reqItems.length === 0 || !reqItems[0].item_name) {
      toast.error('Mohon isi minimal 1 jenis set alat medis');
      return;
    }
    setSubmittingReq(true);
    try {
      const totalQty = reqItems.reduce((acc, curr) => acc + Number(curr.quantity || 1), 0);
      const combinedItemName = reqItems.map((it) => `${it.item_name} (${it.quantity} ${it.unit_label})`).join(', ');

      await api.post(API_ENDPOINTS.UNIT_REQUISITIONS.LIST, {
        ...reqForm,
        unit_id: user?.role === 'unit' ? user.unit_id : reqForm.unit_id,
        procedure_count: Number(reqForm.procedure_count),
        item_name: combinedItemName,
        quantity: totalQty,
        unit_label: 'Set/Item',
        notes: reqForm.notes ? `${reqForm.notes} | Rincian: ${combinedItemName}` : `Rincian: ${combinedItemName}`,
      });
      toast.success('Permintaan kebutuhan alat operasi berhasil diajukan!');
      setOpenReqModal(false);
      refetchReq();
      setReqItems([{ item_name: '', quantity: 1, unit_label: 'Set' }]);
      setReqForm({
        unit_id: user?.unit_id || '',
        procedure_name: '',
        procedure_count: 1,
        procedure_date: todayISO(),
        procedure_time: '08:00',
        room_name: 'Kamar Operasi (OK)',
        requester_name: user?.name || '',
        notes: '',
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengajukan permintaan');
    } finally {
      setSubmittingReq(false);
    }
  };

  // Handle Create Proposal
  const handleSaveProposal = async (e) => {
    e.preventDefault();
    setSubmittingProp(true);
    try {
      await api.post(API_ENDPOINTS.ITEM_PROPOSALS.LIST, {
        ...propForm,
        unit_id: user?.role === 'unit' ? user.unit_id : propForm.unit_id,
        proposed_quantity: Number(propForm.proposed_quantity),
      });
      toast.success('Pengajuan alat/set baru berhasil dikirim ke Admin CSSD!');
      setOpenPropModal(false);
      refetchProp();
      setPropForm({
        unit_id: user?.unit_id || '',
        item_name: '',
        category: 'Set Instrumen',
        unit_label: 'Set',
        proposed_quantity: 1,
        reason: '',
        requester_name: user?.name || '',
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim pengajuan');
    } finally {
      setSubmittingProp(false);
    }
  };

  // Handle Status Update Requisition
  const handleUpdateReqStatus = async (status, item) => {
    try {
      await api.post(API_ENDPOINTS.UNIT_REQUISITIONS.UPDATE_STATUS(item.id), { status });
      toast.success(`Status permintaan diubah menjadi: ${status}`);
      refetchReq();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengubah status');
    }
  };

  // Handle Approve Proposal (Admin Only)
  const handleApproveProposal = async (item) => {
    try {
      const res = await api.post(API_ENDPOINTS.ITEM_PROPOSALS.APPROVE(item.id));
      toast.success(res.data?.message || 'Pengajuan disetujui & otomatis ditambahkan ke Master Data!');
      refetchProp();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyetujui pengajuan');
    }
  };

  // Handle Reject Proposal
  const handleRejectProposalSubmit = async (e) => {
    e.preventDefault();
    if (!rejectPropModal.item) return;
    try {
      await api.post(API_ENDPOINTS.ITEM_PROPOSALS.REJECT(rejectPropModal.item.id), {
        admin_notes: rejectPropModal.reason,
      });
      toast.success('Pengajuan telah ditolak');
      setRejectPropModal({ open: false, item: null, reason: '' });
      refetchProp();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menolak pengajuan');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-sm">
            <ListChecks size={24} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Permintaan Alat & Pengajuan Unit</h1>
            <p className="text-xs text-slate-500">
              Input kebutuhan alat untuk beberapa tindakan/operasi dan ajukan penambahan alat baru ke CSSD
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'requisition' ? (
            <button
              type="button"
              onClick={() => setOpenReqModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2 text-xs font-bold text-white hover:bg-brand-800 shadow-sm transition"
            >
              <Plus size={16} /> Input Kebutuhan Operasi
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpenPropModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 shadow-sm transition"
            >
              <PackagePlus size={16} /> Ajukan Alat / Set Baru
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('requisition')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition ${
            activeTab === 'requisition'
              ? 'border-brand-600 text-brand-700 bg-brand-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers size={16} />
          <span>Kebutuhan Tindakan & Operasi (Multiple Set)</span>
          {reqPagination.total > 0 && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">
              {reqPagination.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('proposal')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition ${
            activeTab === 'proposal'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <PackagePlus size={16} />
          <span>Pengajuan Alat / Set Baru dari Unit</span>
          {propPagination.total > 0 && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
              {propPagination.total}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Kebutuhan Operasi */}
      {activeTab === 'requisition' && (
        <div className="space-y-4">
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={reqSearch}
                onChange={(e) => {
                  setReqSearch(e.target.value);
                  setReqPage(1);
                }}
                placeholder="Cari kode permintaan, tindakan, nama alat, pemohon..."
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={reqStatus}
                onChange={(e) => {
                  setReqStatus(e.target.value);
                  setReqPage(1);
                }}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
              >
                <option value="">Semua Status</option>
                <option value="Diajukan">Diajukan</option>
                <option value="Disiapkan CSSD">Disiapkan CSSD</option>
                <option value="Siap Diambil">Siap Diambil</option>
                <option value="Selesai">Selesai</option>
                <option value="Ditolak">Ditolak</option>
              </select>

              <button
                type="button"
                onClick={() => refetchReq()}
                className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <RefreshCw size={13} /> Segarkan
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
                  <tr>
                    <th className="py-3 px-4">Kode & Unit</th>
                    <th className="py-3 px-4">Tindakan / Operasi</th>
                    <th className="py-3 px-4">Alat & Jumlah Kebutuhan</th>
                    <th className="py-3 px-4">Jadwal & Ruangan</th>
                    <th className="py-3 px-4">Pemohon</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Aksi / Verifikasi CSSD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reqLoading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        <Loader2 size={24} className="mx-auto mb-2 animate-spin text-brand-600" />
                        Memuat data kebutuhan...
                      </td>
                    </tr>
                  ) : requisitions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        Belum ada data permintaan kebutuhan alat operasi.
                      </td>
                    </tr>
                  ) : (
                    requisitions.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-brand-700">{r.code}</span>
                          <div className="font-semibold text-slate-800 mt-0.5">{r.unit_name || '-'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{r.procedure_name}</div>
                          <span className="inline-block mt-0.5 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            Untuk {r.procedure_count} Tindakan/Pasien
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-brand-900">{r.item_name}</div>
                          <div className="text-slate-600 mt-0.5">
                            Total: <b className="text-slate-900">{r.quantity} {r.unit_label}</b>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{formatDate(r.procedure_date)}</div>
                          <div className="text-[11px] text-slate-500">
                            Jam {r.procedure_time || '08:00'} WIB &bull; {r.room_name || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{r.requester_name}</div>
                          {r.notes && <div className="text-[10px] text-slate-400 italic truncate max-w-xs">{r.notes}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              r.status === 'Selesai'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'Siap Diambil'
                                ? 'bg-sky-100 text-sky-800'
                                : r.status === 'Disiapkan CSSD'
                                ? 'bg-cyan-100 text-cyan-800'
                                : r.status === 'Ditolak'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {user?.role !== 'unit' && r.status !== 'Selesai' && r.status !== 'Ditolak' && (
                            <div className="flex items-center justify-center gap-1">
                              {r.status === 'Diajukan' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReqStatus('Disiapkan CSSD', r)}
                                  className="rounded-lg bg-cyan-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-cyan-700"
                                >
                                  Disiapkan
                                </button>
                              )}
                              {r.status === 'Disiapkan CSSD' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReqStatus('Siap Diambil', r)}
                                  className="rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                                >
                                  Siap Diambil
                                </button>
                              )}
                              {r.status === 'Siap Diambil' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReqStatus('Selesai', r)}
                                  className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                                >
                                  Selesai
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleUpdateReqStatus('Ditolak', r)}
                                className="rounded-lg border border-rose-300 px-1.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                              >
                                Tolak
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50">
              <span className="text-xs text-slate-500">
                Total {reqPagination.total || 0} permintaan
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={reqPage <= 1}
                  onClick={() => setReqPage((p) => p - 1)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <span className="px-2 text-xs font-bold text-slate-700">
                  {reqPage} / {reqPagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={reqPage >= (reqPagination.totalPages || 1)}
                  onClick={() => setReqPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Pengajuan Alat / Set Baru */}
      {activeTab === 'proposal' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={propSearch}
                onChange={(e) => {
                  setPropSearch(e.target.value);
                  setPropPage(1);
                }}
                placeholder="Cari kode pengajuan, nama alat/set baru, pemohon..."
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => refetchProp()}
              className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <RefreshCw size={13} /> Segarkan
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
                  <tr>
                    <th className="py-3 px-4">Kode & Unit</th>
                    <th className="py-3 px-4">Nama Alat / Set Baru</th>
                    <th className="py-3 px-4">Kategori & Satuan</th>
                    <th className="py-3 px-4">Jumlah Diusulkan</th>
                    <th className="py-3 px-4">Alasan & Spesifikasi Kebutuhan</th>
                    <th className="py-3 px-4">Pemohon</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Tindakan Admin CSSD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {propLoading ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        <Loader2 size={24} className="mx-auto mb-2 animate-spin text-purple-600" />
                        Memuat data pengajuan...
                      </td>
                    </tr>
                  ) : proposals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        Belum ada data pengajuan alat/set baru dari unit.
                      </td>
                    </tr>
                  ) : (
                    proposals.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-purple-700">{p.code}</span>
                          <div className="font-semibold text-slate-800 mt-0.5">{p.unit_name || '-'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{p.item_name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block rounded-md bg-purple-50 px-2 py-0.5 font-semibold text-purple-800">
                            {p.category}
                          </span>
                          <span className="ml-1 text-slate-500">({p.unit_label})</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {p.proposed_quantity} {p.unit_label}
                        </td>
                        <td className="py-3 px-4">
                          <p className="line-clamp-2 text-slate-600 max-w-xs">{p.reason || '-'}</p>
                          {p.admin_notes && (
                            <p className="mt-1 text-[11px] text-rose-600 italic">
                              <b>Catatan Admin:</b> {p.admin_notes}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{p.requester_name}</div>
                          <div className="text-[10px] text-slate-400">{formatDate(p.created_at)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              p.status === 'Disetujui'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'Ditolak'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isAdmin && p.status === 'Menunggu Verifikasi' && (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveProposal(p)}
                                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-sm"
                                title="Setujui dan otomatis masukkan ke Master Data Alat"
                              >
                                <Check size={12} /> Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectPropModal({ open: true, item: p, reason: '' })}
                                className="flex items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                              >
                                <X size={12} /> Tolak
                              </button>
                            </div>
                          )}
                          {p.status === 'Disetujui' && (
                            <span className="text-[11px] font-medium text-emerald-700 flex items-center justify-center gap-1">
                              <CheckCircle2 size={13} /> Masuk Master
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50">
              <span className="text-xs text-slate-500">
                Total {propPagination.total || 0} pengajuan
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={propPage <= 1}
                  onClick={() => setPropPage((p) => p - 1)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <span className="px-2 text-xs font-bold text-slate-700">
                  {propPage} / {propPagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={propPage >= (propPagination.totalPages || 1)}
                  onClick={() => setPropPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Input Kebutuhan Operasi */}
      {openReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-gradient-to-r from-brand-900 to-[#002D85] text-white">
              <div>
                <h3 className="text-base font-bold">Input Kebutuhan Alat Tindakan / Operasi</h3>
                <p className="text-xs text-sky-100">Bisa input 1 kali untuk kebutuhan beberapa operasi/pasien sekaligus</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenReqModal(false)}
                className="rounded-full p-1 text-sky-200 hover:bg-white/20 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRequisition} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user?.role !== 'unit' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Rumah Sakit</label>
                    <select
                      value={reqForm.unit_id}
                      onChange={(e) => setReqForm({ ...reqForm, unit_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                      required
                    >
                      <option value="">Pilih Unit...</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Tindakan / Operasi
                  </label>
                  <input
                    type="text"
                    value={reqForm.procedure_name}
                    onChange={(e) => setReqForm({ ...reqForm, procedure_name: e.target.value })}
                    placeholder="Contoh: Operasi Sectio Caesarea, Bedah Laparatomi, dll"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Tindakan / Pasien
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={reqForm.procedure_count}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      setReqForm({
                        ...reqForm,
                        procedure_count: count,
                        quantity: count, // otomatis sesuaikan kebutuhan
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                    required
                  />
                  <p className="mt-1 text-[10px] text-slate-500">Misal: 3 operasi</p>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      Daftar Jenis Set Instrumen / Alat Medis (Bisa lebih dari 1 jenis set)
                    </label>
                    <button
                      type="button"
                      onClick={() => setReqItems([...reqItems, { item_name: '', quantity: 1, unit_label: 'Set' }])}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200 transition"
                    >
                      <Plus size={14} /> + Tambah Jenis Set Lain
                    </button>
                  </div>

                  {reqItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <div className="flex-1">
                        <input
                          type="text"
                          list={`items-list-${idx}`}
                          value={item.item_name}
                          onChange={(e) => {
                            const next = [...reqItems];
                            next[idx].item_name = e.target.value;
                            setReqItems(next);
                          }}
                          placeholder="Pilih atau ketik nama set instrumen..."
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none bg-white font-medium"
                          required
                        />
                        <datalist id={`items-list-${idx}`}>
                          {availableItems.map((it) => (
                            <option key={it.id} value={it.name} />
                          ))}
                        </datalist>
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const next = [...reqItems];
                            next[idx].quantity = e.target.value;
                            setReqItems(next);
                          }}
                          placeholder="Jumlah"
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none bg-white text-center font-bold"
                          required
                        />
                      </div>

                      <div className="w-24">
                        <select
                          value={item.unit_label}
                          onChange={(e) => {
                            const next = [...reqItems];
                            next[idx].unit_label = e.target.value;
                            setReqItems(next);
                          }}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none bg-white"
                        >
                          <option value="Set">Set</option>
                          <option value="Pcs">Pcs</option>
                          <option value="Buah">Buah</option>
                          <option value="Pasang">Pasang</option>
                        </select>
                      </div>

                      {reqItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setReqItems(reqItems.filter((_, i) => i !== idx))}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Hapus baris set ini"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ruangan / Lokasi</label>
                  <input
                    type="text"
                    value={reqForm.room_name}
                    onChange={(e) => setReqForm({ ...reqForm, room_name: e.target.value })}
                    placeholder="Kamar Operasi (OK 1), VK, dll"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Kebutuhan</label>
                  <input
                    type="date"
                    value={reqForm.procedure_date}
                    onChange={(e) => setReqForm({ ...reqForm, procedure_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Tindakan</label>
                  <input
                    type="time"
                    value={reqForm.procedure_time}
                    onChange={(e) => setReqForm({ ...reqForm, procedure_time: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Petugas Pemohon</label>
                  <input
                    type="text"
                    value={reqForm.requester_name}
                    onChange={(e) => setReqForm({ ...reqForm, requester_name: e.target.value })}
                    placeholder="Nama perawat / petugas unit"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                  <textarea
                    rows={2}
                    value={reqForm.notes}
                    onChange={(e) => setReqForm({ ...reqForm, notes: e.target.value })}
                    placeholder="Catatan jika ada kebutuhan instrumen ekstra..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setOpenReqModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReq}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-700 px-5 py-2 text-xs font-bold text-white hover:bg-brand-800 disabled:opacity-50 shadow-md"
                >
                  {submittingReq ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Kirim Permintaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pengajuan Alat Baru */}
      {openPropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white">
              <div>
                <h3 className="text-base font-bold">Pengajuan Penambahan Alat / Set Baru</h3>
                <p className="text-xs text-purple-200">Pengajuan akan diverifikasi dan disetujui oleh Admin CSSD</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenPropModal(false)}
                className="rounded-full p-1 text-purple-200 hover:bg-white/20 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProposal} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user?.role !== 'unit' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Pengaju</label>
                    <select
                      value={propForm.unit_id}
                      onChange={(e) => setPropForm({ ...propForm, unit_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      required
                    >
                      <option value="">Pilih Unit...</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Alat / Set Instrumen Baru
                  </label>
                  <input
                    type="text"
                    value={propForm.item_name}
                    onChange={(e) => setPropForm({ ...propForm, item_name: e.target.value })}
                    placeholder="Contoh: Set Laparoskopi Ginekologi Baru"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none font-semibold text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={propForm.category}
                    onChange={(e) => setPropForm({ ...propForm, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                  >
                    <option value="Set Instrumen">Set Instrumen</option>
                    <option value="Alat Satuan">Alat Satuan</option>
                    <option value="DTT">Alat DTT (Reuse)</option>
                    <option value="Duk & Jas Operasi">Duk & Jas Operasi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan</label>
                  <select
                    value={propForm.unit_label}
                    onChange={(e) => setPropForm({ ...propForm, unit_label: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                  >
                    <option value="Set">Set</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Buah">Buah</option>
                    <option value="Pasang">Pasang</option>
                    <option value="Lembar">Lembar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah yang Diusulkan
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={propForm.proposed_quantity}
                    onChange={(e) => setPropForm({ ...propForm, proposed_quantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Petugas Pemohon</label>
                  <input
                    type="text"
                    value={propForm.requester_name}
                    onChange={(e) => setPropForm({ ...propForm, requester_name: e.target.value })}
                    placeholder="Nama petugas unit"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alasan Kebutuhan / Spesifikasi Alat
                  </label>
                  <textarea
                    rows={3}
                    value={propForm.reason}
                    onChange={(e) => setPropForm({ ...propForm, reason: e.target.value })}
                    placeholder="Jelaskan tujuan penggunaan atau spesifikasi alat yang dibutuhkan..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setOpenPropModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingProp}
                  className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50 shadow-md"
                >
                  {submittingProp ? <Loader2 size={14} className="animate-spin" /> : <PackagePlus size={14} />}
                  Kirim Pengajuan ke Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tolak Pengajuan Alat Baru */}
      {rejectPropModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Tolak Pengajuan Alat / Set Baru</h3>
            <p className="text-xs text-slate-500">
              Pengajuan: <b>{rejectPropModal.item?.item_name}</b> ({rejectPropModal.item?.unit_name})
            </p>
            <form onSubmit={handleRejectProposalSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan Penolakan</label>
                <textarea
                  rows={3}
                  value={rejectPropModal.reason}
                  onChange={(e) => setRejectPropModal({ ...rejectPropModal, reason: e.target.value })}
                  placeholder="Berikan alasan mengapa pengajuan ini ditolak..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectPropModal({ open: false, item: null, reason: '' })}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
                >
                  Tolak Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

