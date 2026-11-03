import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Modal from '@/components/ui/Modal';
import { CardSkeleton } from '@/components/ui/Skeleton';
import InstrumentSetCard from '@/components/instrument/InstrumentSetCard';
import InstrumentSetModal from '@/components/instrument/InstrumentSetModal';
import CompletenessModal from '@/components/instrument/CompletenessModal';
import useFetch from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { api } from '@/utils/api';
import { createData, getErrorMessage, removeData, updateData } from '@/utils/request';

export default function InstrumentSetsPage() {
  const { isAdmin } = useAuth();
  const { data, loading, error, reload } = useFetch(API_ENDPOINTS.INSTRUMENT_SETS.LIST);

  const [search, setSearch] = useState('');
  const [filterStock, setFilterStock] = useState('ALL'); // ALL, AVAILABLE, EMPTY
  const [filterComplete, setFilterComplete] = useState('ALL'); // ALL, COMPLETE, INCOMPLETE

  // Modal states
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [setModalMode, setSetModalMode] = useState('create');
  const [selectedSet, setSelectedSet] = useState(null);

  const [completenessModalOpen, setCompletenessModalOpen] = useState(false);
  const [targetCompletenessSet, setTargetCompletenessSet] = useState(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [setToDelete, setSetToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const sets = useMemo(() => data || [], [data]);

  // Statistik Ringkasan (KPI)
  const stats = useMemo(() => {
    let totalAvailable = 0;
    let totalInProcess = 0;
    let completeCount = 0;
    let incompleteCount = 0;

    for (const s of sets) {
      totalAvailable += Number(s.available_stock) || 0;
      totalInProcess += Number(s.in_process_stock) || 0;
      if (s.completeness_status === 'Lengkap') completeCount++;
      else incompleteCount++;
    }

    return {
      totalSets: sets.length,
      totalAvailable,
      totalInProcess,
      completeCount,
      incompleteCount,
    };
  }, [sets]);

  // Filter & Search
  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sets.filter((s) => {
      // Search by set name, code, or any instrument inside
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.items && s.items.some((it) => it.instrument_name.toLowerCase().includes(q)));

      // Filter Stock
      const matchStock =
        filterStock === 'ALL' ||
        (filterStock === 'AVAILABLE' && s.available_stock > 0) ||
        (filterStock === 'EMPTY' && s.available_stock === 0);

      // Filter Completeness
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
    reload();
  };

  // Handlers Completeness Status
  const handleOpenToggleCompleteness = (item) => {
    setTargetCompletenessSet(item);
    setCompletenessModalOpen(true);
  };

  const handleSaveCompleteness = async (id, payload) => {
    await api.patch(API_ENDPOINTS.INSTRUMENT_SETS.COMPLETENESS(id), payload);
    toast.success(`Status set diubah menjadi ${payload.completeness_status}`);
    reload();
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
      reload();
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
        title="Set Instrumen"
        subtitle="Monitoring stok riil dan kelengkapan daftar instrumen per set"
        icon={Layers}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={reload}
              disabled={loading}
              title="Perbarui data stok"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus size={16} />
              <span>Tambah Set Instrumen</span>
            </Button>
          </div>
        }
      />

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        {/* Total Set Siap Pakai (Tersedia) */}
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
            Set steril siap pakai
          </span>
        </div>

        {/* Set Sedang Diproses */}
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
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
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
            Monitoring isi instrumen
          </span>
        </div>
      </div>

      {/* Bar Pencarian & Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        {/* Input Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama set instrumen atau nama alat (mis. Laparotomi, Pinset)..."
            className="input-base pl-9 text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Stok */}
          <select
            value={filterStock}
            onChange={(e) => setFilterStock(e.target.value)}
            className="input-base w-auto text-xs font-medium py-2"
          >
            <option value="ALL">Semua Stok</option>
            <option value="AVAILABLE">Tersedia (&gt; 0)</option>
            <option value="EMPTY">Stok Kosong (0)</option>
          </select>

          {/* Filter Kelengkapan */}
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
      {loading && !data ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
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
            />
          ))}
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

