import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, History, Pencil, Plus, Printer, QrCode, RotateCcw, Trash2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import SubNav from '@/components/ui/SubNav';
import Button, { IconButton } from '@/components/ui/Button';
import FormModal from '@/components/form/FormModal';
import BarcodeLabel from '@/components/form/BarcodeLabel';
import { useAuth } from '@/context/AuthContext';
import useList from '@/hooks/useList';
import { confirmToast } from '@/utils/confirm';
import { formatClock, todayISO } from '@/utils/format';
import { createData, downloadFile, getErrorMessage, removeData, updateData } from '@/utils/request';
import { ROUTES } from '@/config/routes';

const CLOSED = { open: false, mode: 'create', row: null };

/**
 * Halaman data generik berbasis konfigurasi: search (debounce), filter, sorting,
 * pagination dari API, create/edit lewat modal, hapus lewat konfirmasi toast,
 * export CSV, cetak laporan, dan cetak label barcode.
 *
 * Lihat folder src/config/resources untuk contoh konfigurasi.
 */
export default function ResourcePage({ config }) {
  const { isAdmin } = useAuth();
  const list = useList(config.endpoint.LIST, {
    fixedParams: config.fixedParams,
    defaultSort: config.defaultSort,
    defaultOrder: config.defaultOrder,
  });
  const [modal, setModal] = useState(CLOSED);
  const [label, setLabel] = useState(null);
  const [exporting, setExporting] = useState(false);

  const writable = !config.readOnly && (!config.adminOnlyWrite || isAdmin);
  const canCreate = writable && !config.noCreate;
  const canEdit = writable && Boolean(config.canEdit);
  const canEditRow = (row) => canEdit && (config.canEditRow ? config.canEditRow(row) : true);
  const canDelete = (row) => writable && (config.adminOnlyDelete ? isAdmin : true) && Boolean(config.canDelete) && (config.canDeleteRow ? config.canDeleteRow(row) : true);

  const closeModal = useCallback(() => setModal(CLOSED), []);

  const handleSubmit = async (payload) => {
    const body = { ...payload, ...(config.fixedBody || {}) };

    if (modal.mode === 'edit') {
      const res = await updateData(config.endpoint.DETAIL(modal.row.id), body);
      toast.success(res.message || 'Data berhasil diperbarui');
    } else {
      const res = await createData(config.endpoint.LIST, body);
      toast.success(res.message || 'Data berhasil disimpan');
      config.onCreated?.(res.data, { toast });
      if (config.label && res.data) setLabel(config.label(res.data));
    }
    closeModal();
    list.reload();
  };

  const handleDelete = async (row) => {
    const confirmed = await confirmToast({
      title: 'Hapus data?',
      message: config.deleteMessage ? config.deleteMessage(row) : 'Data yang dihapus tidak dapat dikembalikan.',
    });
    if (!confirmed) return;
    try {
      const res = await removeData(config.endpoint.DETAIL(row.id));
      toast.success(res.message || 'Data berhasil dihapus');
      list.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadFile(config.endpoint.EXPORT, list.queryParams, `${config.key}-${todayISO()}.csv`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal mengunduh data'));
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = Boolean(list.searchInput) || Object.values(list.filters).some(Boolean);
  const showActions = Boolean(
    config.label || config.traceField || canEdit || (config.canDelete && writable && (config.adminOnlyDelete ? isAdmin : true))
  );

  const renderActions = showActions
    ? (row) => (
        <>
          {config.label && row[config.labelField || 'barcode'] && (
            <IconButton icon={QrCode} label="Cetak label barcode" onClick={() => setLabel(config.label(row))} />
          )}
          {config.traceField && row[config.traceField] && (
            <Link
              to={`${ROUTES.TRACE}?barcode=${encodeURIComponent(row[config.traceField])}`}
              title="Lacak riwayat"
              aria-label="Lacak riwayat"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
            >
              <History size={18} />
            </Link>
          )}
          {canEditRow(row) && <IconButton icon={Pencil} label="Ubah" onClick={() => setModal({ open: true, mode: 'edit', row })} />}
          {canDelete(row) && <IconButton icon={Trash2} label="Hapus" variant="danger" onClick={() => handleDelete(row)} />}
        </>
      )
    : null;

  const filterSelects = (config.filters || []).map((filter) => (
    <select
      key={filter.name}
      value={list.filters[filter.name] ?? ''}
      onChange={(e) => list.changeFilter(filter.name, e.target.value)}
      aria-label={filter.label}
      className="input-base w-auto min-w-[9rem] max-w-full"
    >
      <option value="">Semua {filter.label}</option>
      {filter.options.map((opt) => {
        const item = typeof opt === 'string' ? { value: opt, label: opt } : opt;
        return (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        );
      })}
    </select>
  ));

  return (
    <div>
      {config.tabs && <SubNav items={config.tabs} />}

      <div className="no-print">
        <PageHeader
          title={config.title}
          subtitle={config.subtitle}
          icon={config.icon}
          actions={
            <>
              {config.report && (
                <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
                  Cetak
                </Button>
              )}
              {config.exportable !== false && (
                <Button variant="secondary" icon={Download} loading={exporting} onClick={handleExport}>
                  Unduh CSV
                </Button>
              )}
              {canCreate && (
                <Button icon={Plus} onClick={() => setModal({ open: true, mode: 'create', row: null })}>
                  {config.createLabel || 'Tambah Data'}
                </Button>
              )}
            </>
          }
        />
      </div>

      {config.report && (
        <div className="mb-4 hidden print:block">
          <h1 className="text-lg font-extrabold">{config.title}</h1>
          <p className="text-xs text-slate-600">CSSD SMART - RSU Serpong Utara &bull; Dicetak {formatClock()}</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="no-print flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <SearchInput
            className="w-full lg:max-w-xs"
            value={list.searchInput}
            onChange={list.changeSearch}
            placeholder={config.searchPlaceholder || 'Cari data...'}
          />
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {filterSelects}
            {config.dateFilter && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  aria-label="Dari tanggal"
                  value={list.filters.date_from ?? ''}
                  max={list.filters.date_to || undefined}
                  onChange={(e) => list.changeFilter('date_from', e.target.value)}
                  className="input-base w-auto"
                />
                <span className="text-xs text-slate-400">s/d</span>
                <input
                  type="date"
                  aria-label="Sampai tanggal"
                  value={list.filters.date_to ?? ''}
                  min={list.filters.date_from || undefined}
                  onChange={(e) => list.changeFilter('date_to', e.target.value)}
                  className="input-base w-auto"
                />
              </div>
            )}
            {hasFilters && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={list.resetFilters}>
                Reset
              </Button>
            )}
          </div>
        </div>

        <DataTable
          columns={config.columns}
          rows={list.rows}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          sort={list.sort}
          onSort={list.toggleSort}
          actions={renderActions}
          offset={(list.pagination.page - 1) * list.pagination.limit}
          empty={{
            title: hasFilters ? 'Data tidak ditemukan' : config.emptyTitle || 'Belum ada data',
            hint: hasFilters ? 'Coba ubah kata kunci atau filter pencarian.' : config.emptyHint,
            action: canCreate && !hasFilters ? (
              <Button icon={Plus} onClick={() => setModal({ open: true, mode: 'create', row: null })}>
                {config.createLabel || 'Tambah Data'}
              </Button>
            ) : null,
          }}
        />

        <div className="no-print">
          <Pagination
            pagination={list.pagination}
            onPageChange={list.setPage}
            onLimitChange={list.changeLimit}
            disabled={list.loading}
          />
        </div>
      </div>

      {(canCreate || canEdit) && config.form && (
        <FormModal
          open={modal.open}
          mode={modal.mode}
          row={modal.row}
          size={config.form.size}
          title={modal.mode === 'edit' ? config.form.editTitle || `Ubah ${config.title}` : config.form.createTitle || config.createLabel || `Tambah ${config.title}`}
          subtitle={config.form.subtitle}
          fields={config.form.fields}
          preview={config.form.preview}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      <BarcodeLabel
        open={Boolean(label)}
        onClose={() => setLabel(null)}
        code={label?.code}
        title={label?.title}
        subtitle={label?.subtitle}
      />
    </div>
  );
}
