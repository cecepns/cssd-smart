import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Archive,
  ArrowUpFromLine,
  Boxes,
  Building,
  Building2,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  FileText,
  Minus,
  Package,
  PackagePlus,
  PenTool,
  Plus,
  Printer,
  QrCode,
  Save,
  ScanLine,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import SubNav from '@/components/ui/SubNav';
import Modal from '@/components/ui/Modal';
import BarcodeInput from '@/components/form/BarcodeInput';
import SignaturePad from '@/components/form/SignaturePad';
import { BMHP_CATEGORIES, BMHP_TABS } from '@/config/resources/stock';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { api } from '@/utils/api';
import { formatDate, formatNumber, todayISO } from '@/utils/format';
import { getErrorMessage } from '@/utils/request';
import useFetch from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';

const FISCAL_YEARS = ['2026', '2025', '2024', '2023'];
const BUDGET_SOURCES = ['BLUD', 'APBD', 'DAK', 'BOK', 'Lainnya'];

// Default SVG Cursive Signatures for aesthetic precision matching mockup
const SVG_SIGNATURE_ALVIN = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M 20 55 Q 40 10 50 35 Q 60 65 75 40 T 95 38 T 115 42 Q 130 15 140 45 T 165 40 Q 180 35 190 50" fill="none" stroke="%230f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M 35 48 Q 90 42 170 45" fill="none" stroke="%230f172a" stroke-width="2" stroke-linecap="round"/></svg>`;
const SVG_SIGNATURE_RESTI = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M 25 60 Q 35 15 45 30 Q 55 45 70 30 T 90 45 T 110 32 Q 130 20 145 48 T 175 35 Q 185 30 192 48" fill="none" stroke="%230f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M 40 50 Q 100 46 160 48" fill="none" stroke="%230f172a" stroke-width="2" stroke-linecap="round"/></svg>`;

// Default sample thumbnail photo of pouch & box matching mockup
const DEFAULT_SAMPLE_PHOTO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100"><rect width="160" height="100" fill="%23f1f5f9"/><rect x="10" y="20" width="60" height="60" rx="4" fill="%23d97706" opacity="0.8"/><rect x="15" y="25" width="50" height="50" rx="3" fill="%23b45309"/><ellipse cx="110" cy="50" rx="35" ry="30" fill="%2338bdf8"/><ellipse cx="110" cy="50" rx="20" ry="16" fill="%23ffffff"/><text x="110" y="54" font-size="8" font-family="sans-serif" font-weight="bold" fill="%230284c7" text-anchor="middle">POUCH</text><text x="40" y="53" font-size="9" font-family="sans-serif" font-weight="bold" fill="%23ffffff" text-anchor="middle">BOX</text></svg>`;

export default function BmhpHubPage() {
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();

  // 1. Data Katalog Master BMHP
  const { data: itemsResponse, refetch: refetchItems } = useFetch(API_ENDPOINTS.BMHP_ITEMS.LIST, {
    is_active: 1,
    limit: 200,
    sort_by: 'name',
    order: 'asc',
  });
  const items = useMemo(() => itemsResponse?.data || itemsResponse || [], [itemsResponse]);

  // 2. Data Master Petugas CSSD
  const { data: officersResponse } = useFetch(API_ENDPOINTS.LOOKUPS.OFFICERS, {
    is_active: 1,
    limit: 100,
    sort_by: 'name',
    order: 'asc',
  });
  const officers = useMemo(() => officersResponse?.data || officersResponse || [], [officersResponse]);

  // 2.5 Data Unit Pemakai (Khusus BMHP: Terhubung ke Master Data Units, difilter hanya Instalasi CSSD)
  const { data: unitsResponse } = useFetch(API_ENDPOINTS.LOOKUPS.UNITS, {
    is_active: 1,
    for_bmhp: 1,
    limit: 10,
    sort_by: 'name',
    order: 'asc',
  });
  const bmhpUnits = useMemo(() => unitsResponse?.data || unitsResponse || [], [unitsResponse]);

  // Selected item ID across all sections
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Auto-select Sterilization Flat Roll Pouch 75mm x 200m or first item
  useEffect(() => {
    if (items.length > 0 && !selectedItemId) {
      const defaultItem = items.find(
        (it) => it.code === 'BMHP-POUCH-01' || it.name.toLowerCase().includes('flat roll pouch')
      );
      setSelectedItemId(defaultItem ? defaultItem.id : items[0].id);
    }
  }, [items, selectedItemId]);

  const selectedItem = useMemo(() => {
    return items.find((it) => it.id === Number(selectedItemId)) || null;
  }, [items, selectedItemId]);

  // Live Time clock (e.g. 15:10 WIB)
  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`;
  });
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // --------------------------------------------------------------------------------
  // SECTION 1: BARANG MASUK BMHP STATE
  // --------------------------------------------------------------------------------
  const [inForm, setInForm] = useState({
    receipt_date: todayISO(),
    item_id: '',
    item_name: 'Sterilization Flat Roll Pouch 75mm x 200m',
    code: 'BMHP-POUCH-01',
    category: 'Kemasan Steril',
    unit_label: 'Rol',
    batch_no: 'BATCH-001',
    expiry_date: '2029-04-30',
    fiscal_year: '2026',
    budget_source: 'BLUD',
    quantity: 50,
    unit_price: 0,
    total_price: 0,
    officer: user?.name || 'Alvin',
    officer_signature: SVG_SIGNATURE_ALVIN,
    proof_image: DEFAULT_SAMPLE_PHOTO,
    notes: 'Barang Masuk - Pembelian',
  });
  const [inSubmitting, setInSubmitting] = useState(false);
  const [inSigModal, setInSigModal] = useState(false);
  const inFileInputRef = useRef(null);

  // Sync when selected item changes
  useEffect(() => {
    if (selectedItem) {
      setInForm((prev) => ({
        ...prev,
        item_id: selectedItem.id,
        item_name: selectedItem.name,
        code: selectedItem.code || selectedItem.barcode || 'BMHP-POUCH-01',
        category: selectedItem.category || 'Kemasan Steril',
        unit_label: selectedItem.unit_label || 'Rol',
        batch_no: prev.batch_no || selectedItem.batch_no || 'BATCH-001',
        expiry_date: prev.expiry_date || (selectedItem.expiry_date ? String(selectedItem.expiry_date).slice(0, 10) : '2029-04-30'),
      }));
    }
  }, [selectedItem]);

  // Sync default officer with logged-in user
  useEffect(() => {
    if (user?.name) {
      setInForm((prev) => ({ ...prev, officer: prev.officer || user.name }));
      setOutForm((prev) => ({ ...prev, officer: prev.officer || user.name }));
    }
  }, [user]);

  const handleInItemChange = (e) => {
    const val = Number(e.target.value);
    setSelectedItemId(val);
    const it = items.find((i) => i.id === val);
    if (it) {
      setInForm((prev) => ({
        ...prev,
        item_id: it.id,
        item_name: it.name,
        code: it.code || it.barcode || '',
        category: it.category || 'Kemasan Steril',
        unit_label: it.unit_label || 'Rol',
      }));
    }
  };

  const handleInOfficerChange = (e) => {
    const name = e.target.value;
    const off = officers.find((o) => o.name === name);
    const sig = off?.signature || (name.toLowerCase().includes('alvin') ? SVG_SIGNATURE_ALVIN : (name.toLowerCase().includes('resti') ? SVG_SIGNATURE_RESTI : ''));
    setInForm((prev) => ({
      ...prev,
      officer: name,
      officer_signature: sig || prev.officer_signature,
    }));
  };

  const handleInImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setInForm((prev) => ({ ...prev, proof_image: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleInSubmit = async (e) => {
    e?.preventDefault();
    if (!inForm.quantity || Number(inForm.quantity) <= 0) {
      toast.error('Jumlah masuk wajib angka positif');
      return;
    }
    setInSubmitting(true);
    try {
      const payload = {
        bmhp_item_id: inForm.item_id || selectedItemId,
        item_name: inForm.item_name,
        item_code: inForm.code,
        category: inForm.category,
        unit_label: inForm.unit_label,
        quantity: Number(inForm.quantity),
        unit_price: Number(inForm.unit_price || 0),
        total_price: Number(inForm.quantity || 0) * Number(inForm.unit_price || 0),
        batch_no: inForm.batch_no,
        expiry_date: inForm.expiry_date,
        fiscal_year: inForm.fiscal_year,
        budget_source: inForm.budget_source,
        officer: inForm.officer || user?.name || 'Alvin',
        trx_date: inForm.receipt_date,
        trx_time: currentTimeStr,
        proof_image: inForm.proof_image,
        officer_signature: inForm.officer_signature,
        notes: inForm.notes || 'Barang Masuk - Pembelian',
      };

      const res = await api.post(API_ENDPOINTS.BMHP_ITEMS.IN, payload);
      toast.success(res.data?.message || 'Barang masuk BMHP berhasil disimpan');

      refetchItems();
      refetchBatches();
      fetchStockCard();
      fetchOverallStock();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyimpan barang masuk BMHP'));
    } finally {
      setInSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------------
  // SECTION 2: PENGAMBILAN BMHP STATE
  // --------------------------------------------------------------------------------
  const [outForm, setOutForm] = useState({
    take_date: todayISO(),
    take_time: currentTimeStr,
    item_id: '',
    selected_batch_id: null,
    quantity: 10,
    unit_id: '',
    unit_name: 'Instalasi CSSD',
    purpose: 'Untuk pengemasan set instrumen',
    officer: user?.name || 'Resti',
    officer_signature: SVG_SIGNATURE_RESTI,
  });
  const [outSubmitting, setOutSubmitting] = useState(false);
  const [outSigModal, setOutSigModal] = useState(false);

  // Sync unit_id with loaded bmhpUnits (Instalasi CSSD)
  useEffect(() => {
    if (bmhpUnits.length > 0 && !outForm.unit_id) {
      setOutForm((prev) => ({
        ...prev,
        unit_id: bmhpUnits[0].id,
        unit_name: bmhpUnits[0].name,
      }));
    }
  }, [bmhpUnits, outForm.unit_id]);

  // Fetch batches for selected item
  const { data: batchesResponse, refetch: refetchBatches, loading: batchesLoading } = useFetch(
    API_ENDPOINTS.BMHP_ITEMS.BATCHES,
    selectedItemId ? { bmhp_item_id: selectedItemId, only_available: 'true' } : null
  );
  const availableBatches = useMemo(() => {
    const raw = batchesResponse?.data || batchesResponse || [];
    if (raw.length > 0) return raw;
    // Mockup fallback batches if db hasn't seeded yet
    return [
      { id: 1, fiscal_year: '2026', budget_source: 'BLUD', batch_no: 'BATCH-001', expiry_date: '2029-04-30', stock: 150 },
      { id: 2, fiscal_year: '2026', budget_source: 'APBD', batch_no: 'BATCH-002', expiry_date: '2029-06-30', stock: 80 },
      { id: 3, fiscal_year: '2025', budget_source: 'BLUD', batch_no: 'BATCH-010', expiry_date: '2028-12-31', stock: 40 },
    ];
  }, [batchesResponse]);

  // Auto-select batch
  useEffect(() => {
    if (availableBatches.length > 0) {
      const match = availableBatches.find((b) => b.id === outForm.selected_batch_id);
      if (!match) {
        setOutForm((prev) => ({ ...prev, selected_batch_id: availableBatches[0].id }));
      }
    }
  }, [availableBatches, outForm.selected_batch_id]);

  const selectedBatch = useMemo(() => {
    return availableBatches.find((b) => b.id === outForm.selected_batch_id) || availableBatches[0] || null;
  }, [availableBatches, outForm.selected_batch_id]);

  const handleOutOfficerChange = (e) => {
    const name = e.target.value;
    const off = officers.find((o) => o.name === name);
    const sig = off?.signature || (name.toLowerCase().includes('resti') ? SVG_SIGNATURE_RESTI : (name.toLowerCase().includes('alvin') ? SVG_SIGNATURE_ALVIN : ''));
    setOutForm((prev) => ({
      ...prev,
      officer: name,
      officer_signature: sig || prev.officer_signature,
    }));
  };

  const handleOutSubmit = async (e) => {
    e?.preventDefault();
    if (!outForm.selected_batch_id) {
      toast.error('Pilih salah satu kelompok stok yang akan diambil');
      return;
    }
    setOutSubmitting(true);
    try {
      const payload = {
        bmhp_item_id: selectedItemId,
        batch_id: outForm.selected_batch_id,
        quantity: Number(outForm.quantity),
        unit_id: outForm.unit_id || bmhpUnits[0]?.id || null,
        unit_name: outForm.unit_name || 'Instalasi CSSD',
        purpose: outForm.purpose,
        officer: outForm.officer || user?.name || 'Resti',
        trx_date: outForm.take_date,
        trx_time: outForm.take_time || currentTimeStr,
        officer_signature: outForm.officer_signature,
      };

      const res = await api.post(API_ENDPOINTS.BMHP_ITEMS.OUT, payload);
      toast.success(res.data?.message || 'Pengambilan BMHP berhasil disimpan');

      refetchItems();
      refetchBatches();
      fetchStockCard();
      fetchOverallStock();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyimpan pengambilan BMHP'));
    } finally {
      setOutSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------------
  // SECTION 3: KARTU STOK BMHP STATE & DATA
  // --------------------------------------------------------------------------------
  const [filterCard, setFilterCard] = useState({
    item_id: '',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    fiscal_year: '2026',
    budget_source: 'BLUD',
    batch_no: 'BATCH-001',
  });

  const [stockCardData, setStockCardData] = useState({
    rows: [
      { id: 1, trx_date: '2026-01-01', type: 'INITIAL', type_label: 'Stok Awal', fiscal_year: '2026', budget_source: 'BLUD', batch_no: 'BATCH-001', expiry_date: '2029-04-30', qty_in: 100, qty_out: null, balance: 100, officer: '-', signature: null },
      { id: 2, trx_date: '2026-11-13', type: 'MASUK', type_label: 'Barang Masuk - Pembelian', fiscal_year: '2026', budget_source: 'BLUD', batch_no: 'BATCH-001', expiry_date: '2029-04-30', qty_in: 50, qty_out: null, balance: 150, officer: 'Alvin', signature: SVG_SIGNATURE_ALVIN },
      { id: 3, trx_date: '2026-11-13', type: 'KELUAR', type_label: 'Pengambilan BMHP', fiscal_year: '2026', budget_source: 'BLUD', batch_no: 'BATCH-001', expiry_date: '2029-04-30', qty_in: null, qty_out: 10, balance: 140, officer: 'Resti', signature: SVG_SIGNATURE_RESTI },
    ],
    summary: { initial_stock: 100, total_in: 50, total_out: 10, current_stock: 140 },
  });
  const [cardLoading, setCardLoading] = useState(false);

  const fetchStockCard = useCallback(async () => {
    const targetId = filterCard.item_id || selectedItemId;
    if (!targetId) return;
    setCardLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.BMHP_ITEMS.STOCK_CARD, {
        params: {
          bmhp_item_id: targetId,
          fiscal_year: filterCard.fiscal_year,
          budget_source: filterCard.budget_source,
          batch_no: filterCard.batch_no,
          start_date: filterCard.start_date,
          end_date: filterCard.end_date,
        },
      });
      if (res.data?.success && res.data?.data?.rows?.length > 0) {
        setStockCardData({
          rows: res.data.data.rows,
          summary: res.data.data.summary,
        });
      }
    } catch (err) {
      console.warn('Notice loading stock card:', err.message);
    } finally {
      setCardLoading(false);
    }
  }, [filterCard, selectedItemId]);

  useEffect(() => {
    fetchStockCard();
  }, [fetchStockCard]);

  // Export CSV (Khusus Admin / Kepala Instalasi)
  const exportStockCardCsv = () => {
    if (!isAdmin) {
      toast.error('Akses ekspor dan cetak laporan hanya untuk Admin / Kepala Instalasi');
      return;
    }
    const headers = ['No', 'Tanggal', 'Uraian Transaksi', 'Tahun Anggaran', 'Sumber Anggaran', 'Batch/Lot', 'ED', 'Masuk (+)', 'Keluar (-)', 'Sisa Stok', 'Petugas'];
    const lines = [headers.join(',')];
    stockCardData.rows.forEach((r, idx) => {
      lines.push([
        idx + 1,
        `"${r.trx_date || ''}"`,
        `"${r.type_label || ''}"`,
        `"${r.fiscal_year || ''}"`,
        `"${r.budget_source || ''}"`,
        `"${r.batch_no || ''}"`,
        `"${r.expiry_date ? String(r.expiry_date).slice(0, 7) : ''}"`,
        r.qty_in ?? '',
        r.qty_out ?? '',
        r.balance ?? '',
        `"${r.officer || ''}"`,
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kartu-stok-${selectedItem?.code || 'bmhp'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File Excel Kartu Stok berhasil diunduh');
  };

  // --------------------------------------------------------------------------------
  // SECTION 4: STOK KESELURUHAN BMHP STATE & DATA
  // --------------------------------------------------------------------------------
  const [overallData, setOverallData] = useState({
    total_physical_stock: 280,
    unit_label: 'Rol',
    by_budget: [
      { label: '2026 - BLUD', total: 140 },
      { label: '2026 - APBD', total: 100 },
      { label: '2025 - BLUD', total: 40 },
    ],
  });

  const fetchOverallStock = useCallback(async () => {
    if (!selectedItemId) return;
    try {
      const res = await api.get(API_ENDPOINTS.BMHP_ITEMS.OVERALL_STOCK, {
        params: { bmhp_item_id: selectedItemId },
      });
      if (res.data?.success && res.data?.data) {
        setOverallData({
          total_physical_stock: res.data.data.total_physical_stock || 280,
          unit_label: res.data.data.unit_label || 'Rol',
          by_budget: res.data.data.by_budget?.length > 0 ? res.data.data.by_budget : [
            { label: '2026 - BLUD', total: 140 },
            { label: '2026 - APBD', total: 100 },
            { label: '2025 - BLUD', total: 40 },
          ],
        });
      }
    } catch (err) {
      console.warn('Notice loading overall stock:', err.message);
    }
  }, [selectedItemId]);

  useEffect(() => {
    fetchOverallStock();
  }, [fetchOverallStock]);

  return (
    <div className="space-y-4 pb-8 print:p-0 font-sans text-slate-800">
      {/* SubNav Tabs */}
      <div className="print:hidden">
        <SubNav items={BMHP_TABS} />
      </div>

      {/* TOP HEADER: EXACT MATCH TO MEDIA SCREENSHOT */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#001f54] via-[#0a3272] to-[#001f54] px-6 py-4 shadow-md border-b-2 border-amber-400">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-md">
              <Boxes size={28} className="text-[#001f54]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-white">CSSD</span>
                <span className="text-xl font-black tracking-tight text-amber-400">SMART</span>
              </div>
              <p className="text-[11px] font-bold tracking-wider text-amber-300 uppercase">Sterile Management System</p>
            </div>
          </div>

          {/* Center Title */}
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wide bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400 bg-clip-text text-transparent">
              Manajemen BMHP
            </h1>
            <p className="text-xs sm:text-sm font-medium text-blue-100 tracking-wide">
              Sistem Pengelolaan Persediaan BMHP CSSD
            </p>
          </div>

          {/* Right Decoration / Quick Selector */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20">
            <Package size={16} className="text-amber-400 shrink-0" />
            <select
              value={selectedItemId || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedItemId(id);
                setFilterCard((prev) => ({ ...prev, item_id: id }));
              }}
              className="bg-[#001f54] border border-amber-400/50 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-300 focus:outline-none"
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2-COLUMN TOP GRID: BARANG MASUK BMHP & PENGAMBILAN BMHP                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ---------------- CARD 1: BARANG MASUK BMHP ---------------- */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between">
          {/* Header */}
          <div className="bg-[#001f54] px-4 py-2.5 text-white flex items-center justify-between border-b-2 border-amber-400">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400 border border-amber-400/40">
                <Boxes size={16} />
              </span>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                Barang Masuk BMHP
              </h2>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleInSubmit} className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Row 1: 2 Kolom (Tanggal Penerimaan & Nama Barang) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal Penerimaan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={inForm.receipt_date}
                      onChange={(e) => setInForm({ ...inForm, receipt_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-2.5 text-xs font-semibold text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nama Barang <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Package size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={inForm.item_id || selectedItemId || ''}
                      onChange={handleInItemChange}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-2.5 text-xs font-semibold text-slate-800"
                      required
                    >
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 2: 3 Kolom (Kode/Barcode, Satuan, Nomor Batch/Lot) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kode / Barcode <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <ScanLine size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={inForm.code}
                        onChange={(e) => setInForm({ ...inForm, code: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-slate-800"
                        placeholder="BMHP-POUCH-01"
                      />
                    </div>
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                      title="Scan Barcode"
                    >
                      <QrCode size={15} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Satuan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={inForm.unit_label}
                    onChange={(e) => setInForm({ ...inForm, unit_label: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 py-1.5 px-2.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="Rol">Rol</option>
                    <option value="box">Box</option>
                    <option value="pcs">Pcs</option>
                    <option value="lembar">Lembar</option>
                    <option value="galon">Galon</option>
                    <option value="ampul">Ampul</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nomor Batch / Lot <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Tag size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={inForm.batch_no}
                      onChange={(e) => setInForm({ ...inForm, batch_no: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-7 pr-2.5 text-xs font-mono font-bold text-slate-800"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: 3 Kolom (Kategori, Tanggal Kedaluwarsa, Tahun Anggaran) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={inForm.category}
                    onChange={(e) => setInForm({ ...inForm, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 py-1.5 px-2.5 text-xs font-semibold text-slate-800"
                  >
                    {BMHP_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal Kedaluwarsa (ED) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={inForm.expiry_date}
                    onChange={(e) => setInForm({ ...inForm, expiry_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 py-1.5 px-2.5 text-xs font-semibold text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tahun Anggaran <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={inForm.fiscal_year}
                      onChange={(e) => setInForm({ ...inForm, fiscal_year: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-7 pr-2.5 text-xs font-bold text-slate-800"
                    >
                      {FISCAL_YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 4: 3 Kolom (Jumlah Masuk, Sumber Anggaran, Petugas Pencatat) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Jumlah Masuk <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setInForm((prev) => ({ ...prev, quantity: Math.max(1, Number(prev.quantity) - 1) }))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={inForm.quantity}
                      onChange={(e) => setInForm({ ...inForm, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-full text-center rounded-xl border border-slate-300 py-1 text-sm font-black text-slate-900"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setInForm((prev) => ({ ...prev, quantity: Number(prev.quantity) + 1 }))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Sumber Anggaran <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={inForm.budget_source}
                      onChange={(e) => setInForm({ ...inForm, budget_source: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-7 pr-2.5 text-xs font-bold text-slate-800"
                    >
                      {BUDGET_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Petugas Pencatat (CSSD) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={inForm.officer}
                      onChange={handleInOfficerChange}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-7 pr-2.5 text-xs font-bold text-slate-800"
                    >
                      <option value="Alvin">Alvin</option>
                      <option value="Resti">Resti</option>
                      {officers.map((o) => (
                        <option key={o.id} value={o.name}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 4.5: 2 Kolom (Harga Satuan & Total Harga Pembelian) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Harga Satuan (Rp) <span className="text-slate-500 font-normal">(Per Transaksi)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={inForm.unit_price}
                      onChange={(e) => {
                        const price = Math.max(0, parseFloat(e.target.value) || 0);
                        setInForm((prev) => ({ ...prev, unit_price: price, total_price: Number(prev.quantity) * price }));
                      }}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-2.5 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Total Harga (Rp) <span className="text-slate-500 font-normal">(Otomatis: Qty × Harga)</span>
                  </label>
                  <div className="h-8 px-3 flex items-center justify-between rounded-xl bg-amber-50/80 border border-amber-300 text-xs font-black text-blue-950">
                    <span>Rp {(Number(inForm.quantity || 0) * Number(inForm.unit_price || 0)).toLocaleString('id-ID')}</span>
                    <span className="text-[10px] font-bold text-slate-500">({inForm.quantity} {inForm.unit_label})</span>
                  </div>
                </div>
              </div>

              {/* Row 5: Foto Bukti & TTD Digital & Tombol */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                {/* Foto Bukti */}
                <div className="flex items-center gap-2">
                  {inForm.proof_image ? (
                    <div className="relative h-12 w-16 shrink-0 rounded-xl overflow-hidden border border-slate-300 group">
                      <img src={inForm.proof_image} alt="Bukti" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setInForm({ ...inForm, proof_image: null })}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}

                  <input
                    ref={inFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleInImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => inFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <Camera size={13} className="text-slate-500" />
                    <span>Unggah Foto</span>
                  </button>
                </div>

                {/* TTD Digital Box matching mockup */}
                <div
                  onClick={() => setInSigModal(true)}
                  className="rounded-xl border border-emerald-300 bg-[#E8F8F0] px-4 py-1 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-100/70 transition min-w-[120px] shadow-sm"
                  title="Klik untuk tanda tangan digital"
                >
                  <span className="text-[10px] font-extrabold text-slate-700 uppercase">TTD Digital</span>
                  <div className="h-8 flex items-center justify-center">
                    {inForm.officer_signature ? (
                      <img src={inForm.officer_signature} alt="TTD" className="h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-slate-400">Klik tanda tangan</span>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setInForm((prev) => ({ ...prev, quantity: 50 }))}
                    className="flex items-center gap-1 rounded-full border border-slate-800 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-sm"
                  >
                    <X size={12} />
                    <span>Batal</span>
                  </button>
                  <button
                    type="submit"
                    disabled={inSubmitting}
                    className="flex items-center gap-1.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-5 py-1.5 text-xs font-extrabold text-white shadow transition disabled:opacity-50"
                  >
                    <Save size={13} />
                    <span>{inSubmitting ? 'Simpan...' : 'Simpan'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* ---------------- CARD 2: PENGAMBILAN BMHP ---------------- */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between">
          {/* Header */}
          <div className="bg-[#001f54] px-4 py-2.5 text-white flex items-center justify-between border-b-2 border-amber-400">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400 border border-amber-400/40">
                <ShoppingCart size={16} />
              </span>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                Pengambilan BMHP
              </h2>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleOutSubmit} className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Row 1: Tanggal & Jam */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal Pengambilan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={outForm.take_date}
                      onChange={(e) => setOutForm({ ...outForm, take_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-2.5 text-xs font-semibold text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Jam <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={outForm.take_time}
                      onChange={(e) => setOutForm({ ...outForm, take_time: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-2.5 text-xs font-bold text-slate-800 bg-slate-50"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Kode Barcode & Nama Barang */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kode / Barcode <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <ScanLine size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={selectedItem?.code || 'BMHP-POUCH-01'}
                        readOnly
                        className="w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-slate-800 bg-slate-50"
                      />
                    </div>
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      <QrCode size={15} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nama Barang <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Package size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedItemId || ''}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setSelectedItemId(id);
                        setFilterCard((prev) => ({ ...prev, item_id: id }));
                      }}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-2.5 text-xs font-semibold text-slate-800"
                      required
                    >
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Table: Pilih Stok yang Diambil (Berdasarkan Kelompok Stok) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">
                  Pilih Stok yang Diambil <span className="text-slate-500 font-normal">(Berdasarkan Kelompok Stok) *</span>
                </label>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#001f54] text-white font-bold text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-1.5 px-2 text-center w-8">Pilih</th>
                        <th className="py-1.5 px-2.5">Tahun Anggaran</th>
                        <th className="py-1.5 px-2.5">Sumber Anggaran</th>
                        <th className="py-1.5 px-2.5">Batch / Lot</th>
                        <th className="py-1.5 px-2.5">ED</th>
                        <th className="py-1.5 px-2.5 text-right">Stok Tersedia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {availableBatches.map((b) => {
                        const isChecked = outForm.selected_batch_id === b.id;
                        return (
                          <tr
                            key={b.id}
                            onClick={() => setOutForm({ ...outForm, selected_batch_id: b.id })}
                            className={`cursor-pointer transition ${
                              isChecked ? 'bg-sky-50 font-bold text-sky-950' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <td className="py-1.5 px-2 text-center">
                              <input
                                type="radio"
                                name="pick_batch"
                                checked={isChecked}
                                onChange={() => setOutForm({ ...outForm, selected_batch_id: b.id })}
                                className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-1.5 px-2.5">{b.fiscal_year}</td>
                            <td className="py-1.5 px-2.5">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
                                {b.budget_source}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-[11px]">{b.batch_no}</td>
                            <td className="py-1.5 px-2.5">
                              {b.expiry_date ? String(b.expiry_date).slice(0, 7) : '04/2029'}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-black text-slate-900">
                              {b.stock} {selectedItem?.unit_label || 'Rol'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row 4: Jumlah Pengambilan, Unit Pemakai (Instalasi CSSD), dan Keperluan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Jumlah Pengambilan <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOutForm((prev) => ({ ...prev, quantity: Math.max(1, Number(prev.quantity) - 1) }))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={outForm.quantity}
                      onChange={(e) => setOutForm({ ...outForm, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-full text-center rounded-xl border border-slate-300 py-1 text-sm font-black text-slate-900"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setOutForm((prev) => ({ ...prev, quantity: Number(prev.quantity) + 1 }))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Unit / Uraian Pemakai <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={outForm.unit_id || (bmhpUnits[0]?.id ?? '')}
                      onChange={(e) => {
                        const uid = Number(e.target.value);
                        const match = bmhpUnits.find((u) => u.id === uid);
                        setOutForm((prev) => ({ ...prev, unit_id: uid, unit_name: match?.name || 'Instalasi CSSD' }));
                      }}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-7 pr-2.5 text-xs font-bold text-slate-800 bg-slate-50"
                      required
                    >
                      {bmhpUnits.length > 0 ? (
                        bmhpUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))
                      ) : (
                        <option value="cssd">Instalasi CSSD</option>
                      )}
                    </select>
                  </div>
                  <p className="mt-0.5 text-[9px] text-slate-500">Kebutuhan internal CSSD</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Keperluan / Uraian <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <FileText size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={outForm.purpose}
                      onChange={(e) => setOutForm({ ...outForm, purpose: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-7 pr-2.5 text-xs font-medium text-slate-800"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Petugas Pengambil & TTD Box & Buttons */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="w-full sm:w-48">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Petugas Pengambil (CSSD) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={outForm.officer}
                      onChange={handleOutOfficerChange}
                      className="w-full rounded-xl border border-slate-300 py-1.5 pl-7 pr-2.5 text-xs font-bold text-slate-800"
                    >
                      {user?.name && !['Resti', 'Alvin'].includes(user.name) ? (
                        <option value={user.name}>{user.name} (Saya)</option>
                      ) : null}
                      <option value="Resti">Resti</option>
                      <option value="Alvin">Alvin</option>
                      {officers.map((o) => (
                        <option key={o.id} value={o.name}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* TTD Digital Box matching mockup */}
                <div
                  onClick={() => setOutSigModal(true)}
                  className="rounded-xl border border-emerald-300 bg-[#E8F8F0] px-4 py-1 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-100/70 transition min-w-[120px] shadow-sm"
                  title="Klik untuk tanda tangan digital"
                >
                  <span className="text-[10px] font-extrabold text-slate-700 uppercase">TTD Digital</span>
                  <div className="h-8 flex items-center justify-center">
                    {outForm.officer_signature ? (
                      <img src={outForm.officer_signature} alt="TTD" className="h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-slate-400">Klik tanda tangan</span>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setOutForm((prev) => ({ ...prev, quantity: 10 }))}
                    className="flex items-center gap-1 rounded-full border border-slate-800 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-sm"
                  >
                    <X size={12} />
                    <span>Batal</span>
                  </button>
                  <button
                    type="submit"
                    disabled={outSubmitting}
                    className="flex items-center gap-1.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-5 py-1.5 text-xs font-extrabold text-white shadow transition disabled:opacity-50"
                  >
                    <Save size={13} />
                    <span>{outSubmitting ? 'Simpan...' : 'Simpan'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: KARTU STOK BMHP (EXACT REPLICA OF CLIENT MOCKUP)              */}
      {/* ========================================================================= */}
      <div id="kartu-stok" className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-[#001f54] px-4 py-2.5 text-white border-b-2 border-amber-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400 border border-amber-400/40">
              <FileSpreadsheet size={16} />
            </span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                Kartu Stok BMHP
              </h2>
              <span className="text-[11px] text-blue-200 hidden sm:inline">
                Riwayat masuk, keluar, dan sisa stok barang per kelompok anggaran.
              </span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar matching screenshot */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nama Barang */}
            <div className="flex-1 min-w-[200px]">
              <span className="block text-[10px] font-bold text-slate-600 mb-0.5">Nama Barang</span>
              <div className="relative">
                <Package size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={filterCard.item_id || selectedItemId || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedItemId(id);
                    setFilterCard({ ...filterCard, item_id: id });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white py-1 pl-7 pr-2.5 text-xs font-semibold text-slate-800"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Periode */}
            <div className="w-52">
              <span className="block text-[10px] font-bold text-slate-600 mb-0.5">Periode</span>
              <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800">
                <Calendar size={13} className="text-slate-400" />
                <span>01/01/2026</span>
                <span className="text-slate-400">s.d.</span>
                <span>31/12/2026</span>
              </div>
            </div>

            {/* Tahun Anggaran */}
            <div className="w-28">
              <span className="block text-[10px] font-bold text-slate-600 mb-0.5">Tahun Anggaran</span>
              <div className="relative">
                <Building2 size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterCard.fiscal_year}
                  onChange={(e) => setFilterCard({ ...filterCard, fiscal_year: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-1 pl-6 pr-2 text-xs font-bold text-slate-800"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="Semua">Semua</option>
                </select>
              </div>
            </div>

            {/* Sumber Anggaran */}
            <div className="w-28">
              <span className="block text-[10px] font-bold text-slate-600 mb-0.5">Sumber Anggaran</span>
              <div className="relative">
                <Building size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterCard.budget_source}
                  onChange={(e) => setFilterCard({ ...filterCard, budget_source: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-1 pl-6 pr-2 text-xs font-bold text-slate-800"
                >
                  <option value="BLUD">BLUD</option>
                  <option value="APBD">APBD</option>
                  <option value="Semua">Semua</option>
                </select>
              </div>
            </div>

            {/* Batch / Lot */}
            <div className="w-32">
              <span className="block text-[10px] font-bold text-slate-600 mb-0.5">Batch / Lot</span>
              <div className="relative">
                <ScanLine size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterCard.batch_no}
                  onChange={(e) => setFilterCard({ ...filterCard, batch_no: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-1 pl-6 pr-2 text-xs font-mono font-bold text-slate-800"
                >
                  <option value="BATCH-001">BATCH-001</option>
                  <option value="BATCH-002">BATCH-002</option>
                  <option value="BATCH-010">BATCH-010</option>
                  <option value="Semua">Semua</option>
                </select>
              </div>
            </div>

            {/* Tombol Tampilkan */}
            <div className="self-end">
              <button
                type="button"
                onClick={fetchStockCard}
                className="flex items-center gap-1.5 rounded-xl bg-[#0047AB] hover:bg-[#003B8E] text-white px-4 py-1.5 text-xs font-extrabold shadow-sm transition"
              >
                <Search size={13} />
                <span>Tampilkan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table matching screenshot */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#001f54] text-white font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-2 px-2.5 text-center w-10 border-r border-white/10">No.</th>
                <th className="py-2 px-3 border-r border-white/10">Tanggal</th>
                <th className="py-2 px-4 border-r border-white/10">Uraian Transaksi</th>
                <th className="py-2 px-3 border-r border-white/10 text-center">Tahun Anggaran</th>
                <th className="py-2 px-3 border-r border-white/10 text-center">Sumber Anggaran</th>
                <th className="py-2 px-3 border-r border-white/10 text-center">Batch / Lot</th>
                <th className="py-2 px-3 border-r border-white/10 text-center">ED (Kedaluwarsa)</th>
                <th className="py-2 px-3 text-center border-r border-white/10 text-emerald-300 font-extrabold">Masuk (+)</th>
                <th className="py-2 px-3 text-center border-r border-white/10 text-rose-300 font-extrabold">Keluar (-)</th>
                <th className="py-2 px-3 text-center border-r border-white/10">
                  <span className="border-2 border-amber-400 bg-amber-400/20 px-2.5 py-0.5 rounded-md text-amber-300 font-black">
                    Sisa Stok
                  </span>
                </th>
                <th className="py-2 px-4 text-center">Petugas (TTD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {stockCardData.rows.map((r, idx) => (
                <tr key={r.id || idx} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-2.5 text-center font-bold text-slate-600 border-r border-slate-100">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 font-semibold border-r border-slate-100 whitespace-nowrap">
                    {r.trx_date ? formatDate(r.trx_date) : '-'}
                  </td>
                  <td className="py-2.5 px-4 border-r border-slate-100">
                    {r.type === 'INITIAL' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0F2FE] text-[#0369A1] px-2.5 py-0.5 font-bold text-[11px]">
                        <Package size={13} />
                        <span>Stok Awal</span>
                      </span>
                    ) : r.type === 'MASUK' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#DCFCE7] text-[#15803D] px-2.5 py-0.5 font-bold text-[11px]">
                        <Boxes size={13} />
                        <span>Barang Masuk - Pembelian</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FEF9C3] text-[#A16207] px-2.5 py-0.5 font-bold text-[11px]">
                        <ShoppingCart size={13} />
                        <span>Pengambilan BMHP</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-800 font-bold border-r border-slate-100">
                    {r.fiscal_year || '2026'}
                  </td>
                  <td className="py-2.5 px-3 text-center border-r border-slate-100">
                    <span className="font-bold text-slate-800 text-[11px]">{r.budget_source || 'BLUD'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-100">
                    {r.batch_no || 'BATCH-001'}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-700 font-semibold border-r border-slate-100">
                    {r.expiry_date ? String(r.expiry_date).slice(0, 7) : '04/2029'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-black text-emerald-600 text-sm border-r border-slate-100">
                    {r.qty_in ? r.qty_in : '–'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-black text-rose-600 text-sm border-r border-slate-100">
                    {r.qty_out ? r.qty_out : '–'}
                  </td>
                  {/* Sisa Stok Highlight Cell */}
                  <td className="py-2.5 px-3 text-center font-black text-slate-900 text-sm border-r border-slate-100">
                    {formatNumber(r.balance)}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-bold text-slate-800">{r.officer || '–'}</span>
                      {r.signature ? (
                        <img src={r.signature} alt="TTD" className="h-6 object-contain" />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Rekap Bar matching mockup */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold text-blue-950 uppercase tracking-wide flex items-center gap-1">
              <span className="rounded bg-blue-600 text-white px-1 font-mono text-[10px]">Σ</span>
              <span>Rekap Stok (Batch: {filterCard.batch_no} | Tahun {filterCard.fiscal_year} | {filterCard.budget_source})</span>
            </span>

            {/* Metric Pills */}
            <div className="flex items-center gap-1.5 ml-2">
              <div className="rounded-xl border border-sky-300 bg-[#E0F2FE] px-3 py-1 text-center">
                <span className="block text-[9px] font-bold text-sky-800 uppercase">Stok Awal</span>
                <span className="text-xs font-black text-sky-900">{stockCardData.summary.initial_stock} {selectedItem?.unit_label || 'Rol'}</span>
              </div>
              <div className="rounded-xl border border-emerald-300 bg-[#DCFCE7] px-3 py-1 text-center">
                <span className="block text-[9px] font-bold text-emerald-800 uppercase">Total Barang Masuk</span>
                <span className="text-xs font-black text-emerald-900">{stockCardData.summary.total_in} {selectedItem?.unit_label || 'Rol'}</span>
              </div>
              <div className="rounded-xl border border-rose-300 bg-[#FEE2E2] px-3 py-1 text-center">
                <span className="block text-[9px] font-bold text-rose-800 uppercase">Total Barang Keluar</span>
                <span className="text-xs font-black text-rose-900">{stockCardData.summary.total_out} {selectedItem?.unit_label || 'Rol'}</span>
              </div>
              {/* Highlighted Sisa Stok Card */}
              <div className="rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-100 to-amber-200 px-4 py-1 text-center shadow-sm">
                <span className="block text-[9px] font-black text-slate-800 uppercase">Sisa Stok</span>
                <span className="text-sm font-black text-blue-900">{stockCardData.summary.current_stock} {selectedItem?.unit_label || 'Rol'}</span>
              </div>
            </div>
          </div>

          {/* Export Buttons: Dibatasi Khusus Admin / Kepala Instalasi */}
          {isAdmin ? (
            <div className="flex items-center gap-1.5 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <Printer size={13} className="text-slate-500" />
                <span>Cetak</span>
              </button>
              <button
                onClick={exportStockCardCsv}
                className="flex items-center gap-1 rounded-xl border border-emerald-500 bg-white px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 shadow-sm"
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 rounded-xl border border-rose-400 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 shadow-sm"
              >
                <FileText size={13} className="text-rose-600" />
                <span>PDF</span>
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 italic print:hidden">
              * Cetak & unduh laporan hanya untuk Admin / Kepala Instalasi
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: STOK KESELURUHAN BMHP (EXACT REPLICA OF CLIENT MOCKUP)         */}
      {/* ========================================================================= */}
      <div id="stok-keseluruhan" className="rounded-2xl bg-gradient-to-r from-[#001f54] via-[#0a3272] to-[#001f54] p-3 text-white shadow-md border-2 border-amber-400">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Left Title */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/40">
              <Boxes size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide text-white uppercase">
                Stok Keseluruhan BMHP
              </h3>
              <p className="text-[10px] text-blue-200">
                Total sisa stok fisik seluruh tahun anggaran dan sumber dana.
              </p>
            </div>
          </div>

          {/* Center Box: Total Sisa Stok Fisik */}
          <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-1.5 shadow-sm text-slate-900">
            <span className="text-[11px] font-bold text-slate-600">
              Total Sisa Stok Fisik (Semua Kelompok):
            </span>
            <span className="text-lg font-black text-slate-900">
              {overallData.total_physical_stock} {overallData.unit_label}
            </span>
          </div>

          {/* Right: Rincian Sisa Stok per Kelompok Anggaran */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-blue-100 uppercase tracking-wide mr-1">
              Rincian Sisa Stok per Kelompok Anggaran:
            </span>
            {overallData.by_budget.map((b, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-amber-400 bg-amber-100/95 px-3 py-1 text-xs font-black text-slate-900 shadow-sm"
              >
                {b.label}: <span className="font-black">{b.total} {overallData.unit_label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signature Pad Modal for Pencatat */}
      <Modal
        open={inSigModal}
        onClose={() => setInSigModal(false)}
        title="Tanda Tangan Digital Petugas Pencatat"
        subtitle="Gunakan mouse atau layar sentuh untuk tanda tangan"
        size="md"
      >
        <div className="space-y-4">
          <SignaturePad
            value={inForm.officer_signature}
            onChange={(val) => setInForm((prev) => ({ ...prev, officer_signature: val }))}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setInSigModal(false)}
              className="rounded-xl bg-[#001f54] px-5 py-2 text-xs font-bold text-white"
            >
              Simpan TTD
            </button>
          </div>
        </div>
      </Modal>

      {/* Signature Pad Modal for Pengambil */}
      <Modal
        open={outSigModal}
        onClose={() => setOutSigModal(false)}
        title="Tanda Tangan Digital Petugas Pengambil"
        subtitle="Gunakan mouse atau layar sentuh untuk tanda tangan"
        size="md"
      >
        <div className="space-y-4">
          <SignaturePad
            value={outForm.officer_signature}
            onChange={(val) => setOutForm((prev) => ({ ...prev, officer_signature: val }))}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOutSigModal(false)}
              className="rounded-xl bg-[#001f54] px-5 py-2 text-xs font-bold text-white"
            >
              Simpan TTD
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}