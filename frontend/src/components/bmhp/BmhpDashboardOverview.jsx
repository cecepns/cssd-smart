import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock,
  FilePlus2,
  FileSpreadsheet,
  Layers,
  PackagePlus,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  ShoppingCart,
  Zap,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { BMHP_CATEGORIES } from '@/config/resources/stock';
import { api } from '@/utils/api';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, formatNumber } from '@/utils/format';
import { getErrorMessage } from '@/utils/request';

const FISCAL_YEARS = ['Semua', '2026', '2025', '2024', '2023'];
const BUDGET_SOURCES = ['Semua', 'BLUD', 'APBD', 'DAK', 'BOK'];

export default function BmhpDashboardOverview({
  summary = {},
  items = [],
  batches = [],
  onQuickAction,
  onSelectItem,
}) {
  const navigate = useNavigate();

  // Filter Panel Cetak Kartu Stok BMHP (persis referensi Gambar 3)
  const [printFilter, setPrintFilter] = useState({
    category: 'Semua',
    bmhp_item_id: '',
    budget_source: 'Semua',
    fiscal_year: 'Semua',
    batch_no: 'Semua',
    start_date: `${new Date().getFullYear()}-01-01`,
    end_date: `${new Date().getFullYear()}-12-31`,
    mode: 'single', // 'single' | 'all'
  });
  const [exporting, setExporting] = useState(false);

  const filteredItems = useMemo(() => {
    if (printFilter.category === 'Semua') return items;
    return items.filter((it) => it.category === printFilter.category);
  }, [items, printFilter.category]);

  const availableBatches = useMemo(() => {
    const set = new Set();
    batches.forEach((b) => {
      if (!printFilter.bmhp_item_id || String(b.bmhp_item_id) === String(printFilter.bmhp_item_id)) {
        if (b.batch_no) set.add(b.batch_no);
      }
    });
    return ['Semua', ...Array.from(set)];
  }, [batches, printFilter.bmhp_item_id]);

  // Cetak PDF / Excel Kartu Stok BMHP (TANPA nominal rupiah sesuai SOP)
  const handlePrintOrExportStockCard = async (format) => {
    if (printFilter.mode === 'single' && !printFilter.bmhp_item_id && items.length > 0) {
      toast.error('Pilih Nama Barang terlebih dahulu untuk cetak Satu Barang, atau pilih "Seluruh Barang".');
      return;
    }
    setExporting(true);
    try {
      const res = await api.get(API_ENDPOINTS.BMHP_ITEMS.REPORTS, {
        params: {
          report_type: 'kartu_stok_all',
          category: printFilter.category,
          bmhp_item_id: printFilter.mode === 'single' ? printFilter.bmhp_item_id : undefined,
          budget_source: printFilter.budget_source,
          fiscal_year: printFilter.fiscal_year,
          batch_no: printFilter.batch_no,
          start_date: printFilter.start_date,
          end_date: printFilter.end_date,
        },
      });
      const cards = res.data?.data?.cards || [];
      if (cards.length === 0) {
        toast.error('Tidak ada data kartu stok yang sesuai filter.');
        return;
      }

      if (format === 'excel') {
        const headers = ['Kode Barang', 'Nama Barang', 'Kategori', 'Satuan', 'Tanggal', 'No Dokumen', 'Keterangan / Mutasi', 'Tahun', 'Anggaran', 'Batch', 'ED', 'Masuk', 'Keluar', 'Sisa Saldo', 'Petugas'];
        const csvRows = [];
        cards.forEach((c) => {
          if (c.rows.length === 0) {
            csvRows.push([c.item.code, c.item.name, c.item.category, c.item.unit_label, '-', '-', 'Stok Saat Ini (Tanpa Transaksi Periode)', '-', '-', '-', '-', 0, 0, c.summary.current_stock, '-']);
          } else {
            c.rows.forEach((r) => {
              csvRows.push([
                c.item.code,
                c.item.name,
                c.item.category,
                c.item.unit_label,
                formatDate(r.trx_date),
                r.doc_number || '-',
                r.correction_reason || r.notes || r.type,
                r.fiscal_year || '-',
                r.budget_source || '-',
                r.batch_no || '-',
                r.expiry_date ? formatDate(r.expiry_date) : '-',
                r.qty_in || 0,
                r.qty_out || 0,
                r.balance,
                r.officer || '-',
              ]);
            });
          }
        });
        const csv = [headers, ...csvRows]
          .map((line) => line.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
          .join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kartu-stok-bmhp-${printFilter.mode}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Kartu stok (${cards.length} barang) berhasil diunduh ke Excel (tanpa nominal rupiah).`);
      } else {
        // Cetak PDF melalui jendela cetak resmi tanpa nominal rupiah
        const win = window.open('', '_blank', 'width=1024,height=768');
        if (!win) {
          toast.error('Pop-up diblokir browser. Izinkan pop-up untuk mencetak Kartu Stok PDF.');
          return;
        }
        const htmlCards = cards
          .map(
            (c) => `
          <div style="page-break-after: always; margin-bottom: 24px; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px;">
            <div style="border-bottom: 2px solid #002D85; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between;">
              <div>
                <h2 style="margin: 0; color: #002D85; font-size: 16px;">KARTU STOK BMHP — INSTALASI CSSD RSUD SERPONG UTARA</h2>
                <p style="margin: 2px 0 0; font-size: 12px; color: #475569;">Nama Barang: <b>${c.item.name}</b> (${c.item.code}) • Kategori: ${c.item.category} • Satuan: ${c.item.unit_label}</p>
              </div>
              <div style="text-align: right; font-size: 11px; color: #475569;">
                <div>Periode: ${printFilter.start_date} s/d ${printFilter.end_date}</div>
                <div>Filter: ${printFilter.budget_source} / ${printFilter.fiscal_year} / Batch ${printFilter.batch_no}</div>
              </div>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background: #f1f5f9;">
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Tanggal</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">No. Ref / Ket</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Anggaran</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Batch & ED</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Masuk</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Keluar</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Sisa Stok</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Petugas</th>
                </tr>
              </thead>
              <tbody>
                ${
                  c.rows.length === 0
                    ? `<tr><td colspan="8" style="border: 1px solid #cbd5e1; padding: 12px; text-align: center; color: #64748b;">Tidak ada transaksi pada periode ini. Sisa Stok Saat Ini: <b>${c.summary.current_stock} ${c.item.unit_label}</b></td></tr>`
                    : c.rows
                        .map(
                          (r) => `
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 5px;">${formatDate(r.trx_date)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px;">${r.doc_number ? `<b>[${r.doc_number}]</b> ` : ''}${r.correction_reason || r.notes || r.type}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">${r.fiscal_year || '-'} / ${r.budget_source || '-'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">${r.batch_no || '-'} ${r.expiry_date ? `(ED: ${formatDate(r.expiry_date)})` : ''}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; color: #047857; font-weight: bold;">${r.qty_in ? `+${r.qty_in}` : '-'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; color: #be123c; font-weight: bold;">${r.qty_out ? `-${r.qty_out}` : '-'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; font-weight: bold;">${r.balance} ${c.item.unit_label}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 5px;">${r.officer || '-'}</td>
                  </tr>`
                        )
                        .join('')
                }
              </tbody>
            </table>
            <div style="margin-top: 10px; font-size: 11px; display: flex; justify-content: space-between;">
              <span>Total Masuk: <b>${c.summary.total_in}</b> | Total Keluar: <b>${c.summary.total_out}</b> | Sisa Akhir: <b>${c.summary.current_stock} ${c.item.unit_label}</b></span>
              <span style="color: #64748b;">*Kartu Stok menampilkan kuantitas fisik (tanpa nilai nominal rupiah)</span>
            </div>
          </div>`
          )
          .join('');

        win.document.write(`
          <html>
            <head><title>Cetak Kartu Stok BMHP</title></head>
            <body style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
              ${htmlCards}
              <script>window.onload = function() { window.print(); };</script>
            </body>
          </html>
        `);
        win.document.close();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal mencetak kartu stok BMHP'));
    } finally {
      setExporting(false);
    }
  };

  const quickMenuTiles = [
    {
      label: 'Barang Masuk',
      icon: PackagePlus,
      accent: 'border-b-4 border-emerald-500 text-emerald-700',
      iconBg: 'bg-emerald-50 text-emerald-600',
      onClick: () => (onQuickAction ? onQuickAction('in') : navigate(ROUTES.BMHP_IN)),
    },
    {
      label: 'Pengambilan Barang',
      icon: ShoppingCart,
      accent: 'border-b-4 border-amber-500 text-amber-700',
      iconBg: 'bg-amber-50 text-amber-600',
      onClick: () => (onQuickAction ? onQuickAction('out') : navigate(ROUTES.BMHP_OUT)),
    },
    {
      label: 'Retur / Koreksi',
      icon: RefreshCw,
      accent: 'border-b-4 border-purple-500 text-purple-700',
      iconBg: 'bg-purple-50 text-purple-600',
      onClick: () => navigate(ROUTES.BMHP_RETUR),
    },
    {
      label: 'Stok Saat Ini',
      icon: Layers,
      accent: 'border-b-4 border-sky-500 text-sky-700',
      iconBg: 'bg-sky-50 text-sky-600',
      onClick: () => navigate(ROUTES.BMHP_STOCK),
    },
    {
      label: 'Kartu Stok',
      icon: ClipboardList,
      accent: 'border-b-4 border-blue-600 text-blue-800',
      iconBg: 'bg-blue-50 text-blue-700',
      onClick: () => (onQuickAction ? onQuickAction('card') : navigate(ROUTES.BMHP_STOCK_CARD)),
    },
    {
      label: 'Laporan BMHP',
      icon: BarChart3,
      accent: 'border-b-4 border-violet-600 text-violet-800',
      iconBg: 'bg-violet-50 text-violet-700',
      onClick: () => navigate(ROUTES.BMHP_REPORT),
    },
    {
      label: 'Riwayat Dokumen',
      sub: '(NPB, SPB, SPPB, BAST)',
      badge: 'Baru',
      icon: FilePlus2,
      accent: 'border-b-4 border-amber-400 ring-1 ring-amber-300 text-brand-900',
      iconBg: 'bg-brand-50 text-brand-700',
      onClick: () => navigate(ROUTES.BMHP_DOCUMENTS),
    },
  ];

  return (
    <div className="space-y-4 print:hidden">
      {/* Header Bersih tanpa Banner Biru Gelap CSSD SMART (Sesuai Revisi Gambar 2 & 3) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-blue-100 bg-white px-4 py-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#002D85] to-blue-600 text-amber-300 shadow-xs">
            <Boxes size={22} />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-black tracking-tight text-[#001F5F] uppercase">
              Sistem Manajemen Persediaan BMHP Terintegrasi
            </h1>
            <p className="text-[11px] sm:text-xs font-medium text-slate-500">
              Satu kali input transaksi → Stok, Kartu Stok, Dokumen Keluar (NPB/SPB/SPPB/BAST) & seluruh Laporan otomatis terbarui.
            </p>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards Real-Time */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 to-white p-3.5 sm:p-4 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Archive size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-600">Total Jenis Barang</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {formatNumber(summary.total_items || items.length || 0)}{' '}
              <span className="text-xs font-bold text-slate-500">Item</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white p-3.5 sm:p-4 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Boxes size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-600">Stok Tersedia</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-700">
              {formatNumber(summary.total_stock || 0)}{' '}
              <span className="text-xs font-bold text-slate-500">Unit</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-white p-3.5 sm:p-4 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <PackagePlus size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-600">Total Barang Masuk</p>
            <p className="text-xl sm:text-2xl font-black text-amber-700">
              {formatNumber(summary.total_in_period ?? summary.total_in_all ?? 0)}{' '}
              <span className="text-[10px] font-semibold text-slate-500 block sm:inline">(Periode Berjalan)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/70 to-white p-3.5 sm:p-4 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
            <ShoppingCart size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-600">Total Barang Keluar</p>
            <p className="text-xl sm:text-2xl font-black text-rose-700">
              {formatNumber(summary.total_out_period ?? summary.total_out_all ?? 0)}{' '}
              <span className="text-[10px] font-semibold text-slate-500 block sm:inline">(Periode Berjalan)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Menu Utama BMHP (7 Kartu Navigasi Cepat) */}
      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#001F5F]">
          <Layers size={14} className="text-blue-600" /> Menu Utama BMHP
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {quickMenuTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.label}
                type="button"
                onClick={tile.onClick}
                className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white p-3 text-center shadow-xs transition hover:-translate-y-0.5 hover:shadow-md ${tile.accent}`}
              >
                {tile.badge && (
                  <span className="absolute -top-1.5 -right-1.5 rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-xs">
                    {tile.badge}
                  </span>
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tile.iconBg}`}>
                  <Icon size={20} />
                </div>
                <span className="text-xs font-extrabold text-slate-800 leading-tight">{tile.label}</span>
                {tile.sub && <span className="text-[9px] font-semibold text-slate-500 leading-tight">{tile.sub}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2-Column Middle Section: Informasi Stok BMHP + Fitur Cepat */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Informasi Stok BMHP */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#001F5F]">
            <Archive size={15} className="text-blue-600" /> Informasi Stok BMHP
          </h3>
          <div className="space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => navigate(ROUTES.BMHP_STOCK)}
              className="flex w-full items-center justify-between rounded-xl bg-emerald-50/80 px-3 py-2 font-bold text-emerald-900 hover:bg-emerald-100/80 transition"
            >
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600" /> Stok Aman</span>
              <span>{formatNumber(summary.safe_count || 0)} Item ({formatNumber(summary.safe_stock_qty || 0)} Unit)</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`${ROUTES.BMHP_REPORT}?tab=rekap`)}
              className="flex w-full items-center justify-between rounded-xl bg-amber-50/80 px-3 py-2 font-bold text-amber-900 hover:bg-amber-100/80 transition"
            >
              <span className="flex items-center gap-2"><AlertTriangle size={15} className="text-amber-600" /> Stok Menipis</span>
              <span>{formatNumber(summary.low_count || 0)} Item ({formatNumber(summary.low_stock_qty || 0)} Unit)</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`${ROUTES.BMHP_REPORT}?tab=rekap`)}
              className="flex w-full items-center justify-between rounded-xl bg-rose-50/80 px-3 py-2 font-bold text-rose-900 hover:bg-rose-100/80 transition"
            >
              <span className="flex items-center gap-2"><AlertOctagon size={15} className="text-rose-600" /> Stok Habis</span>
              <span>{formatNumber(summary.empty_count || 0)} Item</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`${ROUTES.BMHP_REPORT}?tab=expired`)}
              className="flex w-full items-center justify-between rounded-xl bg-indigo-50/80 px-3 py-2 font-bold text-indigo-900 hover:bg-indigo-100/80 transition"
            >
              <span className="flex items-center gap-2"><Clock size={15} className="text-indigo-600" /> Akan Expired (≤ 30 Hari)</span>
              <span>{formatNumber(summary.expiring_count || 0)} Item {summary.expired_count > 0 ? `• ${summary.expired_count} Expired` : ''}</span>
            </button>
          </div>
        </div>

        {/* Fitur Cepat */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#001F5F]">
            <Zap size={15} className="text-blue-600" /> Fitur Cepat
          </h3>
          <div className="grid grid-cols-2 gap-2.5 flex-1">
            <button
              type="button"
              onClick={() => (onQuickAction ? onQuickAction('out') : navigate(ROUTES.BMHP_OUT))}
              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-gradient-to-b from-white to-blue-50/70 px-3 py-3 text-xs font-extrabold text-[#002D85] hover:border-blue-400 hover:shadow-xs transition"
            >
              <ScanLine size={18} className="text-blue-600" /> Scan Barcode
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.BMHP_STOCK)}
              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-gradient-to-b from-white to-blue-50/70 px-3 py-3 text-xs font-extrabold text-[#002D85] hover:border-blue-400 hover:shadow-xs transition"
            >
              <Search size={18} className="text-blue-600" /> Cek Stok
            </button>
            <button
              type="button"
              onClick={() => (onQuickAction ? onQuickAction('in') : navigate(ROUTES.BMHP_IN))}
              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-gradient-to-b from-white to-blue-50/70 px-3 py-3 text-xs font-extrabold text-[#002D85] hover:border-blue-400 hover:shadow-xs transition"
            >
              <PackagePlus size={18} className="text-emerald-600" /> Input Barang
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.BMHP_REPORT)}
              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-gradient-to-b from-white to-blue-50/70 px-3 py-3 text-xs font-extrabold text-[#002D85] hover:border-blue-400 hover:shadow-xs transition"
            >
              <Printer size={18} className="text-indigo-600" /> Cetak Laporan
            </button>
          </div>
        </div>
      </div>

      {/* Panel Cetak Kartu Stok BMHP (Sesuai Bagian Bawah Gambar 3) */}
      <div className="rounded-2xl border-2 border-amber-300/90 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#002D85] to-blue-600 px-4 py-1.5 text-xs font-extrabold text-white shadow-xs">
            <Printer size={15} /> Cetak Kartu Stok BMHP
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900">
            ✓ Berdasarkan Jenis/Nama Barang, Sumber Anggaran, Tahun, Batch, dan Periode (Tanpa Nominal Rupiah)
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-600">Jenis Barang</label>
            <select
              value={printFilter.category}
              onChange={(e) => setPrintFilter({ ...printFilter, category: e.target.value, bmhp_item_id: '' })}
              className="input-base text-xs py-1.5 font-semibold"
            >
              <option value="Semua">Semua Jenis</option>
              {BMHP_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-600">Nama Barang</label>
            <select
              value={printFilter.bmhp_item_id}
              onChange={(e) => {
                const val = e.target.value;
                setPrintFilter({ ...printFilter, bmhp_item_id: val });
                if (val && onSelectItem) onSelectItem(Number(val));
              }}
              className="input-base text-xs py-1.5 font-semibold"
            >
              <option value="">Pilih Nama Barang...</option>
              {filteredItems.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-600">Sumber Anggaran</label>
            <select
              value={printFilter.budget_source}
              onChange={(e) => setPrintFilter({ ...printFilter, budget_source: e.target.value })}
              className="input-base text-xs py-1.5 font-semibold"
            >
              {BUDGET_SOURCES.map((b) => (
                <option key={b} value={b}>{b === 'Semua' ? 'APBD / BLUD (Semua)' : b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-600">Tahun Pembelian</label>
            <select
              value={printFilter.fiscal_year}
              onChange={(e) => setPrintFilter({ ...printFilter, fiscal_year: e.target.value })}
              className="input-base text-xs py-1.5 font-semibold"
            >
              {FISCAL_YEARS.map((y) => (
                <option key={y} value={y}>{y === 'Semua' ? 'Semua Tahun' : y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-600">Batch / Lot</label>
            <select
              value={printFilter.batch_no}
              onChange={(e) => setPrintFilter({ ...printFilter, batch_no: e.target.value })}
              className="input-base text-xs py-1.5 font-semibold"
            >
              {availableBatches.map((b) => (
                <option key={b} value={b}>{b === 'Semua' ? 'Semua Batch' : b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-600">Periode Transaksi</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={printFilter.start_date}
                onChange={(e) => setPrintFilter({ ...printFilter, start_date: e.target.value })}
                className="input-base text-[11px] py-1.5 px-1.5"
              />
              <input
                type="date"
                value={printFilter.end_date}
                onChange={(e) => setPrintFilter({ ...printFilter, end_date: e.target.value })}
                className="input-base text-[11px] py-1.5 px-1.5"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
            <span>Pilihan Cetak:</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="print-mode"
                checked={printFilter.mode === 'single'}
                onChange={() => setPrintFilter({ ...printFilter, mode: 'single' })}
                className="text-brand-700"
              />
              Satu Barang (Per Kartu Stok)
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="print-mode"
                checked={printFilter.mode === 'all'}
                onChange={() => setPrintFilter({ ...printFilter, mode: 'all' })}
                className="text-brand-700"
              />
              Seluruh Barang (Sesuai Filter)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={exporting}
              onClick={() => handlePrintOrExportStockCard('pdf')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition disabled:opacity-50"
            >
              <Printer size={15} /> Cetak PDF
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => handlePrintOrExportStockCard('excel')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition disabled:opacity-50"
            >
              <FileSpreadsheet size={15} /> Cetak Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
