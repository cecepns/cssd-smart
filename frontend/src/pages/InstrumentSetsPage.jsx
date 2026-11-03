import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  History,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import InstrumentSetCard from '@/components/instrument/InstrumentSetCard';
import InstrumentSetModal from '@/components/instrument/InstrumentSetModal';
import CompletenessModal from '@/components/instrument/CompletenessModal';
import DiscrepancyModal from '@/components/instrument/DiscrepancyModal';
import DiscrepancyResolveModal from '@/components/instrument/DiscrepancyResolveModal';
import useFetch from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { api } from '@/utils/api';
import { createData, getErrorMessage, removeData, updateData } from '@/utils/request';
import { formatDate } from '@/utils/format';

export default function InstrumentSetsPage() {
  const { isAdmin } = useAuth();

  // Active Main Tab: 'SETS', 'MOVEMENTS', 'DISCREPANCIES'
  const [activeTab, setActiveTab] = useState('SETS');

  // Tab 1 Data: Master Sets With Realtime Stock
  const { data: setsData, loading: setsLoading, error: setsError, reload: reloadSets } = useFetch(API_ENDPOINTS.INSTRUMENT_SETS.LIST);
  const sets = useMemo(() => setsData || [], [setsData]);

  // Tab 2 Data: Movements Log (Pengambilan & Pengembalian)
  const [movementPage, setMovementPage] = useState(1);
  const [movementLimit, setMovementLimit] = useState(10);
  const [movementType, setMovementType] = useState('ALL');
  const [movementSearch, setMovementSearch] = useState('');
  const movementParams = useMemo(() => ({
    page: movementPage,
    limit: movementLimit,
    type: movementType,
    search: movementSearch,
  }), [movementPage, movementLimit, movementType, movementSearch]);

  const { data: movementsResponse, loading: movementsLoading, error: movementsError, reload: reloadMovements } = useFetch(
    activeTab === 'MOVEMENTS' ? API_ENDPOINTS.INSTRUMENT_SETS.MOVEMENTS : null,
    movementParams
  );

  // Tab 3 Data: Discrepancies Log (Hilang, Rusak, Kurang)
  const [discrepancyPage, setDiscrepancyPage] = useState(1);
  const [discrepancyLimit, setDiscrepancyLimit] = useState(10);
  const [discrepancyStatus, setDiscrepancyStatus] = useState('ALL');
  const [discrepancyType, setDiscrepancyType] = useState('ALL');
  const [discrepancySearch, setDiscrepancySearch] = useState('');
  const discrepancyParams = useMemo(() => ({
    page: discrepancyPage,
    limit: discrepancyLimit,
    resolution_status: discrepancyStatus,
    incident_type: discrepancyType,
    search: discrepancySearch,
  }), [discrepancyPage, discrepancyLimit, discrepancyStatus, discrepancyType, discrepancySearch]);

  const { data: discrepanciesResponse, loading: discrepanciesLoading, error: discrepanciesError, reload: reloadDiscrepancies } = useFetch(
    activeTab === 'DISCREPANCIES' ? API_ENDPOINTS.INSTRUMENT_SETS.DISCREPANCIES : null,
    discrepancyParams
  );

  // Filters Tab 1
  const [search, setSearch] = useState('');
  const [filterStock, setFilterStock] = useState('ALL'); // ALL, AVAILABLE, EMPTY
  const [filterComplete, setFilterComplete] = useState('ALL'); // ALL, COMPLETE, INCOMPLETE

  // Modal states
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [setModalMode, setSetModalMode] = useState('create');
  const [selectedSet, setSelectedSet] = useState(null);

  const [completenessModalOpen, setCompletenessModalOpen] = useState(false);
  const [targetCompletenessSet, setTargetCompletenessSet] = useState(null);

  const [discrepancyModalOpen, setDiscrepancyModalOpen] = useState(false);
  const [targetDiscrepancySet, setTargetDiscrepancySet] = useState(null);

  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [targetResolveItem, setTargetResolveItem] = useState(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [setToDelete, setSetToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Reload All Active Tab Data
  const handleRefreshAll = () => {
    reloadSets();
    if (activeTab === 'MOVEMENTS') reloadMovements();
    if (activeTab === 'DISCREPANCIES') reloadDiscrepancies();
  };

  // Top KPI Statistics Ringkasan
  const stats = useMemo(() => {
    let totalAvailable = 0;
    let totalInProcess = 0;
    let totalInUnit = 0;
    let completeCount = 0;
    let incompleteCount = 0;

    for (const s of sets) {
      totalAvailable += Number(s.available_stock) || 0;
      totalInProcess += Number(s.in_process_stock) || 0;
      totalInUnit += Number(s.in_unit_stock ?? s.distributed_stock) || 0;
      if (s.completeness_status === 'Lengkap') completeCount++;
      else incompleteCount++;
    }

    return {
      totalSets: sets.length,
      totalAvailable,
      totalInProcess,
      totalInUnit,
      completeCount,
      incompleteCount,
    };
  }, [sets]);

  // Filter & Search Tab 1 (Sets)
  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sets.filter((s) => {
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.items && s.items.some((it) => it.instrument_name.toLowerCase().includes(q)));

      const matchStock =
        filterStock === 'ALL' ||
        (filterStock === 'AVAILABLE' && s.available_stock > 0) ||
        (filterStock === 'EMPTY' && s.available_stock === 0);

      const matchComplete =
        filterComplete === 'ALL' ||
        (filterComplete === 'COMPLETE' && s.completeness_status === 'Lengkap') ||
        (filterComplete === 'INCOMPLETE' && s.completeness_status === 'Tidak Lengkap');

      return matchSearch && matchStock && matchComplete;
    });
  }, [sets, search, filterStock, filterComplete]);

  // Handlers Create / Edit Set
  const handleOpenCreate = () => {
    setSelectedSet(null);
    setSetModalMode('create');
    setSetModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setSelectedSet(item);
    setSetModalMode('edit');
    setSetModalOpen(true);
  };

  const handleSaveSet = async (payload) => {
    if (setModalMode === 'create') {
      await createData(API_ENDPOINTS.INSTRUMENT_SETS.LIST, payload);
      toast.success('Set instrumen baru berhasil ditambahkan');
    } else {
      await updateData(API_ENDPOINTS.INSTRUMENT_SETS.DETAIL(selectedSet.id), payload);
      toast.success('Perubahan set instrumen berhasil disimpan');
    }
    reloadSets();
  };

  // Handlers Completeness Status
  const handleOpenToggleCompleteness = (item) => {
    setTargetCompletenessSet(item);
    setCompletenessModalOpen(true);
  };

  const handleSaveCompleteness = async (id, payload) => {
    await api.patch(API_ENDPOINTS.INSTRUMENT_SETS.COMPLETENESS(id), payload);
    toast.success(`Status set diubah menjadi ${payload.completeness_status}`);
    reloadSets();
  };

  // Handlers Discrepancy (Lapor Hilang / Rusak)
  const handleOpenReportDiscrepancy = (item = null) => {
    setTargetDiscrepancySet(item);
    setDiscrepancyModalOpen(true);
  };

  const handleSaveDiscrepancy = async (payload) => {
    try {
      await api.post(API_ENDPOINTS.INSTRUMENT_SETS.DISCREPANCIES, payload);
      toast.success('Riwayat insiden instrumen berhasil dicatat');
      reloadSets();
      if (activeTab === 'DISCREPANCIES') reloadDiscrepancies();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal mencatat insiden instrumen'));
      throw err;
    }
  };

  // Handlers Selesaikan Insiden (Resolve)
  const handleOpenResolve = (item) => {
    setTargetResolveItem(item);
    setResolveModalOpen(true);
  };

  const handleSaveResolve = async (id, payload) => {
    try {
      await api.patch(API_ENDPOINTS.INSTRUMENT_SETS.DISCREPANCY_RESOLVE(id), payload);
      toast.success('Insiden instrumen berhasil diselesaikan');
      reloadSets();
      reloadDiscrepancies();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyelesaikan insiden instrumen'));
      throw err;
    }
  };

  // Handlers Delete Set
  const handleOpenDelete = (item) => {
    setSetToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!setToDelete) return;
    setDeleting(true);
    try {
      await removeData(API_ENDPOINTS.INSTRUMENT_SETS.DETAIL(setToDelete.id));
      toast.success(`Set ${setToDelete.name} berhasil dihapus`);
      setDeleteConfirmOpen(false);
      reloadSets();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menghapus set instrumen'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Monitoring Set Instrumen"
        subtitle="Monitoring jumlah set, kelengkapan instrumen, pergerakan peminjaman, serta riwayat alat hilang/rusak per set"
        icon={Layers}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleRefreshAll}
              disabled={setsLoading}
              title="Perbarui seluruh data"
            >
              <RefreshCw size={15} className={setsLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh Data</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleOpenReportDiscrepancy(null)}
              className="text-amber-700 hover:bg-amber-50 border-amber-200"
            >
              <AlertTriangle size={15} />
              <span>Lapor Hilang/Rusak</span>
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus size={16} />
              <span>Tambah Set Baru</span>
            </Button>
          </div>
        }
      />

      {/* KPI Statistic Cards (5 Box Ringkasan Realtime) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total Jenis Set */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Jenis Set</span>
            <Layers size={18} className="text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
            {stats.totalSets}
          </p>
          <span className="mt-0.5 block text-xs font-medium text-slate-600">
            Set aktif terdaftar
          </span>
        </div>

        {/* Total Set Siap Pakai (Tersedia di CSSD) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Stok Tersedia
            </span>
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-700 sm:text-3xl">
            {stats.totalAvailable}
          </p>
          <span className="mt-0.5 block text-xs font-medium text-emerald-600">
            Siap pakai di CSSD
          </span>
        </div>

        {/* Set Sedang di Unit / Ruangan */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sky-600">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Di Unit / Ruangan
            </span>
            <Users size={18} className="text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-sky-700 sm:text-3xl">
            {stats.totalInUnit}
          </p>
          <span className="mt-0.5 block text-xs font-medium text-sky-600">
            Sedang dipinjam/dipakai
          </span>
        </div>

        {/* Set Sedang Diproses (Alat kotor, cuci, steril) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dalam Proses
            </span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-700 sm:text-3xl">
            {stats.totalInProcess}
          </p>
          <span className="mt-0.5 block text-xs font-medium text-amber-600">
            Sedang dicuci/disteril
          </span>
        </div>

        {/* Status Kelengkapan */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Kelengkapan</span>
            <Sparkles size={18} className="text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 sm:text-3xl">
              {stats.completeCount}
            </span>
            <span className="text-xs font-semibold text-slate-600">Lengkap</span>
            {stats.incompleteCount > 0 && (
              <span className="ml-1 text-xs font-bold text-amber-600">
                ({stats.incompleteCount} kurang)
              </span>
            )}
          </div>
          <span className="mt-0.5 block text-xs font-medium text-slate-600">
            Status isi instrumen
          </span>
        </div>
      </div>

      {/* Main Tab Navigation Buttons */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('SETS')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            activeTab === 'SETS'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers size={16} />
          <span>Daftar & Stok Set ({stats.totalSets})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MOVEMENTS')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            activeTab === 'MOVEMENTS'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History size={16} />
          <span>Pergerakan (Pengambilan & Pengembalian)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DISCREPANCIES')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            activeTab === 'DISCREPANCIES'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle size={16} className={stats.incompleteCount > 0 ? 'text-amber-600' : ''} />
          <span>Riwayat Hilang / Rusak / Kurang</span>
          {stats.incompleteCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800">
              {stats.incompleteCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: DAFTAR & STOK SET INSTRUMEN */}
      {activeTab === 'SETS' && (
        <div className="space-y-4">
          {/* Bar Pencarian & Filter Set */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            {/* Input Search */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama set instrumen atau nama alat di dalamnya (mis. Laparotomi, Pinset, Klem)..."
                className="input-base pl-9 text-sm"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
                className="input-base w-auto text-xs font-medium py-2"
              >
                <option value="ALL">Semua Stok</option>
                <option value="AVAILABLE">Tersedia Siap Pakai (&gt; 0)</option>
                <option value="EMPTY">Stok Kosong (0)</option>
              </select>

              <select
                value={filterComplete}
                onChange={(e) => setFilterComplete(e.target.value)}
                className="input-base w-auto text-xs font-medium py-2"
              >
                <option value="ALL">Semua Kelengkapan</option>
                <option value="COMPLETE">Hanya Lengkap</option>
                <option value="INCOMPLETE">Tidak Lengkap</option>
              </select>

              {(search || filterStock !== 'ALL' || filterComplete !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setFilterStock('ALL');
                    setFilterComplete('ALL');
                  }}
                  className="text-xs font-semibold text-brand-700 hover:underline px-2"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Grid Kartu Set Instrumen */}
          {setsLoading && !setsData ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : setsError ? (
            <ErrorState message={setsError} onRetry={reloadSets} />
          ) : filteredSets.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Tidak Ada Set Instrumen"
              description={
                search || filterStock !== 'ALL' || filterComplete !== 'ALL'
                  ? 'Tidak ada set instrumen yang cocok dengan kriteria pencarian / filter Anda.'
                  : 'Belum ada set instrumen yang terdaftar. Tambahkan jenis set instrumen pertama Anda.'
              }
              action={
                search || filterStock !== 'ALL' || filterComplete !== 'ALL' ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setFilterStock('ALL');
                      setFilterComplete('ALL');
                    }}
                  >
                    Reset Filter
                  </Button>
                ) : (
                  <Button onClick={handleOpenCreate}>
                    <Plus size={16} /> Tambah Set Sekarang
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredSets.map((item) => (
                <InstrumentSetCard
                  key={item.id}
                  set={item}
                  canEdit={true}
                  canDelete={isAdmin}
                  onEdit={handleOpenEdit}
                  onDelete={handleOpenDelete}
                  onToggleCompleteness={handleOpenToggleCompleteness}
                  onReportDiscrepancy={handleOpenReportDiscrepancy}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PERGERAKAN PENGAMBILAN & PENGEMBALIAN SET */}
      {activeTab === 'MOVEMENTS' && (
        <div className="space-y-4">
          {/* Header Info & Filter */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={movementSearch}
                onChange={(e) => {
                  setMovementSearch(e.target.value);
                  setMovementPage(1);
                }}
                placeholder="Cari mutasi pergerakan set (nama set, barcode, unit, petugas)..."
                className="input-base pl-9 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={movementType}
                onChange={(e) => {
                  setMovementType(e.target.value);
                  setMovementPage(1);
                }}
                className="input-base w-auto text-xs font-semibold py-2"
              >
                <option value="ALL">Semua Pergerakan</option>
                <option value="PENGAMBILAN">Pengambilan oleh Unit (Stok Berkurang)</option>
                <option value="PENGEMBALIAN">Pengembalian Set Kotor (Masuk Sterilisasi)</option>
              </select>

              {movementSearch && (
                <button
                  type="button"
                  onClick={() => setMovementSearch('')}
                  className="text-xs font-semibold text-brand-700 hover:underline px-2"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Tabel Pergerakan */}
          {movementsLoading && !movementsResponse ? (
            <TableSkeleton rows={6} cols={6} />
          ) : movementsError ? (
            <ErrorState message={movementsError} onRetry={reloadMovements} />
          ) : !movementsResponse?.data?.length ? (
            <EmptyState
              icon={History}
              title="Belum Ada Riwayat Pergerakan Set"
              description="Pergerakan pengambilan dan pengembalian set instrumen akan otomatis tercatat di sini saat unit mendistribusikan atau mengembalikan set kotor."
            />
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Jenis Transaksi</th>
                      <th>Tanggal</th>
                      <th>Nama Set Instrumen</th>
                      <th>Barcode</th>
                      <th>Unit / Ruangan</th>
                      <th>Jumlah</th>
                      <th>Petugas CSSD</th>
                      <th>Penerima / Penyerah</th>
                      <th>Status / Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementsResponse.data.map((m, idx) => {
                      const isPengambilan = m.movement_type === 'PENGAMBILAN';
                      return (
                        <tr key={m.id || idx}>
                          <td>
                            {isPengambilan ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                                <ArrowUpRight size={13} className="text-sky-600" />
                                Pengambilan (Distribusi)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                                <ArrowDownLeft size={13} className="text-amber-600" />
                                Pengembalian (Alat Kotor)
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap font-medium text-slate-700">
                            {formatDate(m.trx_date)}
                          </td>
                          <td className="font-bold text-slate-900">
                            {m.set_name}
                          </td>
                          <td className="font-mono text-xs text-slate-600">
                            {m.barcode || '-'}
                          </td>
                          <td className="font-semibold text-slate-800">
                            {m.unit_name}
                          </td>
                          <td className="font-bold tabular-nums text-slate-900">
                            {m.quantity} set
                          </td>
                          <td className="text-slate-700">
                            {m.officer || '-'}
                          </td>
                          <td className="text-slate-600">
                            {m.receiver_name || '-'}
                          </td>
                          <td className="text-xs text-slate-500 max-w-xs truncate">
                            {m.notes || m.description || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {movementsResponse?.pagination && (
                <div className="p-4 border-t border-slate-100">
                  <Pagination
                    pagination={movementsResponse.pagination}
                    onPageChange={setMovementPage}
                    onLimitChange={(lim) => {
                      setMovementLimit(lim);
                      setMovementPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RIWAYAT INSTRUMEN HILANG, RUSAK, ATAU KURANG */}
      {activeTab === 'DISCREPANCIES' && (
        <div className="space-y-4">
          {/* Header Info & Filter */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={discrepancySearch}
                onChange={(e) => {
                  setDiscrepancySearch(e.target.value);
                  setDiscrepancyPage(1);
                }}
                placeholder="Cari nama alat hilang/rusak, set instrumen, unit, atau catatan..."
                className="input-base pl-9 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={discrepancyStatus}
                onChange={(e) => {
                  setDiscrepancyStatus(e.target.value);
                  setDiscrepancyPage(1);
                }}
                className="input-base w-auto text-xs font-semibold py-2"
              >
                <option value="ALL">Semua Status</option>
                <option value="Belum Selesai">Belum Selesai (Kurang/Rusak)</option>
                <option value="Selesai">Sudah Selesai / Diganti</option>
              </select>

              <select
                value={discrepancyType}
                onChange={(e) => {
                  setDiscrepancyType(e.target.value);
                  setDiscrepancyPage(1);
                }}
                className="input-base w-auto text-xs font-semibold py-2"
              >
                <option value="ALL">Semua Jenis Insiden</option>
                <option value="Kurang">Kurang</option>
                <option value="Hilang">Hilang</option>
                <option value="Rusak">Rusak</option>
              </select>

              <Button onClick={() => handleOpenReportDiscrepancy(null)}>
                <Plus size={15} />
                <span>Catat Insiden Baru</span>
              </Button>
            </div>
          </div>

          {/* Tabel Riwayat Discrepancy */}
          {discrepanciesLoading && !discrepanciesResponse ? (
            <TableSkeleton rows={5} cols={7} />
          ) : discrepanciesError ? (
            <ErrorState message={discrepanciesError} onRetry={reloadDiscrepancies} />
          ) : !discrepanciesResponse?.data?.length ? (
            <EmptyState
              icon={CheckCircle2}
              title="Tidak Ada Catatan Alat Hilang / Rusak"
              description={
                discrepancySearch || discrepancyStatus !== 'ALL' || discrepancyType !== 'ALL'
                  ? 'Tidak ada riwayat insiden yang sesuai dengan filter pencarian.'
                  : 'Semua set instrumen saat ini dalam keadaan lengkap dan tidak ada laporan alat hilang atau rusak.'
              }
              action={
                <Button onClick={() => handleOpenReportDiscrepancy(null)}>
                  <Plus size={15} /> Catat Laporan Insiden
                </Button>
              }
            />
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Status Solusi</th>
                      <th>Set Instrumen</th>
                      <th>Instrumen Bermasalah</th>
                      <th>Jenis Insiden</th>
                      <th>Jumlah</th>
                      <th>Unit Asal</th>
                      <th>Tanggal Kejadian</th>
                      <th>Petugas CSSD</th>
                      <th>Kronologi / Catatan</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discrepanciesResponse.data.map((d) => {
                      const isResolved = d.resolution_status === 'Selesai';
                      return (
                        <tr key={d.id} className={!isResolved ? 'bg-amber-50/20' : ''}>
                          <td>
                            {isResolved ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                                <CheckCircle2 size={13} /> Selesai
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 animate-pulse">
                                <AlertCircle size={13} /> Belum Selesai
                              </span>
                            )}
                          </td>
                          <td className="font-bold text-slate-900">
                            {d.set_name}
                            <span className="block text-[11px] font-mono text-slate-500 font-normal">
                              {d.set_code}
                            </span>
                          </td>
                          <td className="font-semibold text-rose-700">
                            {d.instrument_name}
                          </td>
                          <td>
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${
                              d.incident_type === 'Rusak'
                                ? 'bg-rose-100 text-rose-800'
                                : d.incident_type === 'Hilang'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {d.incident_type}
                            </span>
                          </td>
                          <td className="font-bold tabular-nums text-slate-900">
                            {d.quantity} Buah
                          </td>
                          <td className="text-slate-700 text-xs">
                            {d.unit_origin || '-'}
                          </td>
                          <td className="whitespace-nowrap text-xs text-slate-700">
                            {formatDate(d.incident_date)}
                          </td>
                          <td className="text-xs text-slate-700">
                            {d.officer}
                          </td>
                          <td className="text-xs text-slate-600 max-w-xs">
                            {d.notes || '-'}
                            {isResolved && d.resolution_notes && (
                              <p className="mt-1 font-semibold text-emerald-700">
                                Solusi: {d.resolution_notes}
                              </p>
                            )}
                          </td>
                          <td>
                            {!isResolved ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenResolve(d)}
                                className="whitespace-nowrap text-xs font-bold text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                              >
                                Selesaikan / Ganti
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-600 italic">
                                Selesai
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {discrepanciesResponse?.pagination && (
                <div className="p-4 border-t border-slate-100">
                  <Pagination
                    pagination={discrepanciesResponse.pagination}
                    onPageChange={setDiscrepancyPage}
                    onLimitChange={(lim) => {
                      setDiscrepancyLimit(lim);
                      setDiscrepancyPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah / Edit Set */}
      <InstrumentSetModal
        open={setModalOpen}
        mode={setModalMode}
        initialData={selectedSet}
        onClose={() => setSetModalOpen(false)}
        onSubmit={handleSaveSet}
      />

      {/* Modal Cepat Status Kelengkapan */}
      <CompletenessModal
        open={completenessModalOpen}
        set={targetCompletenessSet}
        onClose={() => setCompletenessModalOpen(false)}
        onSubmit={handleSaveCompleteness}
      />

      {/* Modal Catat Hilang / Rusak / Kurang */}
      <DiscrepancyModal
        open={discrepancyModalOpen}
        sets={sets}
        selectedSet={targetDiscrepancySet}
        onClose={() => setDiscrepancyModalOpen(false)}
        onSubmit={handleSaveDiscrepancy}
      />

      {/* Modal Selesaikan Insiden */}
      <DiscrepancyResolveModal
        open={resolveModalOpen}
        discrepancy={targetResolveItem}
        onClose={() => setResolveModalOpen(false)}
        onSubmit={handleSaveResolve}
      />

      {/* Modal Konfirmasi Hapus */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        size="sm"
        title="Hapus Set Instrumen?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              loading={deleting}
            >
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Apakah Anda yakin ingin menghapus <strong>{setToDelete?.name}</strong> beserta seluruh rincian instrumen di dalamnya?
        </p>
      </Modal>
    </div>
  );
}
