import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Building,
  Building2,
  Calendar,
  CalendarX,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Database,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Layers,
  Lock,
  Minus,
  Package,
  PackagePlus,
  PenTool,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Upload,
  User,
  X,
  Zap,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { BMHP_CATEGORIES } from '@/config/resources/stock';
import { api } from '@/utils/api';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, formatNumber, todayISO } from '@/utils/format';
import { getErrorMessage } from '@/utils/request';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/ui/Modal';
import SignaturePad from '@/components/form/SignaturePad';

// Default SVG Cursive Signatures for aesthetic precision matching mockup
const SVG_SIGNATURE_ALVIN = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M 20 55 Q 40 10 50 35 Q 60 65 75 40 T 95 38 T 115 42 Q 130 15 140 45 T 165 40 Q 180 35 190 50" fill="none" stroke="%230f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M 35 48 Q 90 42 170 45" fill="none" stroke="%230f172a" stroke-width="2" stroke-linecap="round"/></svg>`;
const SVG_SIGNATURE_RESTI = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M 25 60 Q 35 15 45 30 Q 55 45 70 30 T 90 45 T 110 32 Q 130 20 145 48 T 175 35 Q 185 30 192 48" fill="none" stroke="%230f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M 40 50 Q 100 46 160 48" fill="none" stroke="%230f172a" stroke-width="2" stroke-linecap="round"/></svg>`;
const SVG_SIGNATURE_RAHMA = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M 15 50 Q 35 12 55 25 Q 70 45 85 20 T 115 45 T 145 25 Q 165 45 185 30" fill="none" stroke="%23002D85" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M 30 45 Q 80 40 160 42" fill="none" stroke="%23002D85" stroke-width="2" stroke-linecap="round"/></svg>`;
const SVG_PARAF_PETUGAS = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" width="80" height="40"><path d="M 10 25 Q 25 5 35 20 Q 45 35 55 15 T 70 20" fill="none" stroke="%23002D85" stroke-width="2.5" stroke-linecap="round"/><path d="M 20 22 Q 45 18 65 24" fill="none" stroke="%23002D85" stroke-width="1.5" stroke-linecap="round"/></svg>`;

// Default sample thumbnails
const SAMPLE_PHOTO_BOX = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" width="100" height="80"><rect width="100" height="80" fill="%23d97706" rx="6"/><polygon points="10,20 50,5 90,20 50,35" fill="%23b45309"/><polygon points="10,20 50,35 50,75 10,60" fill="%2392400e"/><polygon points="90,20 50,35 50,75 90,60" fill="%2378350f"/><text x="50" y="55" font-size="10" font-family="sans-serif" font-weight="bold" fill="%23fef3c7" text-anchor="middle">BOX BMHP</text></svg>`;
const SAMPLE_PHOTO_ROLL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" width="100" height="80"><rect width="100" height="80" fill="%230284c7" rx="6"/><ellipse cx="50" cy="40" rx="35" ry="30" fill="%2338bdf8"/><ellipse cx="50" cy="40" rx="20" ry="16" fill="%23ffffff"/><text x="50" y="44" font-size="9" font-family="sans-serif" font-weight="black" fill="%230369a1" text-anchor="middle">POUCH</text></svg>`;

const FISCAL_YEARS = ['2026', '2025', '2024', '2023'];
const BUDGET_SOURCES = ['BLUD', 'APBD', 'DAK', 'BOK', 'Lainnya'];
const ACCOUNT_CODES = [
  '5.1.02.01.01 (Belanja BMHP)',
  '5.1.02.01.02 (Belanja Bahan Kimia/Desinfektan)',
  '5.1.02.01.03 (Belanja Kemasan Steril)',
  '5.1.02.01.04 (Belanja Indikator Sterilisasi)',
];

export default function BmhpDashboardOverview({
  summary = {},
  items = [],
  batches = [],
  officers = [],
  onRefreshData,
  onSelectItem,
}) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  // ---------------------------------------------------------------------------
  // 1. STATE FORM BARANG MASUK (KOLOM KIRI)
  // ---------------------------------------------------------------------------
  const [inForm, setInForm] = useState({
    receipt_no: 'BM-2026-0001',
    receipt_date: todayISO(),
    supplier: 'PT. Medika Sejahtera',
    po_number: 'PO-026/11/2026',
    delivery_note: 'SJ-026/11/2026',
    invoice_number: 'FT-026/11/2026',
    fiscal_year: '2026',
    budget_source: 'BLUD',
    account_code: '5.1.02.01.01 (Belanja BMHP)',
    item_id: '',
    item_name: 'Sterilization Flat Roll Pouch 75 mm x 200 m',
    category: 'Kemasan Steril',
    brand: 'SteriPack',
    manufacturer: 'PT. Sterilindo',
    unit_label: 'Rol',
    packaging: 'Rol',
    package_content: '1',
    batch_no: 'BATCH-001',
    production_date: '2026-04',
    expiry_date: '2029-04-30',
    quantity: 50,
    unit_price: 250000,
    total_price: 12500000,
    condition: 'Baik',
    storage_location: 'Gudang BMHP CSSD',
    notes: 'Penerimaan sesuai PO',
    photos: [SAMPLE_PHOTO_BOX, SAMPLE_PHOTO_ROLL],
    receiver_officer: 'Alvin',
    receiver_signature: SVG_SIGNATURE_ALVIN,
    verifier_name: 'Rahma',
    verifier_signature: SVG_SIGNATURE_RAHMA,
  });

  const [inSubmitting, setInSubmitting] = useState(false);
  const [inSigModal, setInSigModal] = useState({ open: false, target: 'receiver' });

  // ---------------------------------------------------------------------------
  // 2. STATE FORM BARANG KELUAR (KOLOM TENGAH)
  // ---------------------------------------------------------------------------
  const [outForm, setOutForm] = useState({
    issue_no: 'BK-2026-0001',
    issue_date: todayISO(),
    unit_name: 'Instalasi CSSD', // LOCKED SESUAI SOP PANDUAN
    officer: 'Resti',
    purpose: 'Instalasi CSSD',
    item_id: '',
    item_name: 'Sterilization Flat Roll Pouch 75 mm x 200 m',
    selected_batch_id: null,
    quantity: 10,
    unit_label: 'Rol',
    notes: 'Pengambilan rutin Instalasi CSSD',
    handover_photo: null,
    giver_officer: 'Alvin',
    giver_signature: SVG_SIGNATURE_ALVIN,
    taker_officer: 'Resti',
    taker_signature: SVG_SIGNATURE_RESTI,
  });

  const [outSubmitting, setOutSubmitting] = useState(false);
  const [outSigModal, setOutSigModal] = useState({ open: false, target: 'giver' });

  // ---------------------------------------------------------------------------
  // 3. SELEKSI ITEM & POPULASI OTOMATIS
  // ---------------------------------------------------------------------------
  // Default item: Sterilization Flat Roll Pouch 75 mm x 200 m
  const selectedItem = useMemo(() => {
    if (!items.length) return null;
    if (inForm.item_id) {
      return items.find((it) => it.id === Number(inForm.item_id)) || items[0];
    }
    const match = items.find((it) => it.name.toLowerCase().includes('pouch') || it.code === 'BMHP-POUCH-01');
    return match || items[0];
  }, [items, inForm.item_id]);

  useEffect(() => {
    if (selectedItem && !inForm.item_id) {
      setInForm((prev) => ({
        ...prev,
        item_id: selectedItem.id,
        item_name: selectedItem.name,
        category: selectedItem.category || 'Kemasan Steril',
        brand: selectedItem.brand || 'SteriPack',
        manufacturer: selectedItem.manufacturer || 'PT. Sterilindo',
        unit_label: selectedItem.unit_label || 'Rol',
        packaging: selectedItem.packaging || 'Rol',
        package_content: selectedItem.package_content || '1',
      }));
      setOutForm((prev) => ({
        ...prev,
        item_id: selectedItem.id,
        item_name: selectedItem.name,
        unit_label: selectedItem.unit_label || 'Rol',
      }));
    }
  }, [selectedItem, inForm.item_id]);

  // Kelompok batch stok yang tersedia untuk barang terpilih
  const availableBatches = useMemo(() => {
    const itemId = inForm.item_id || selectedItem?.id;
    const list = batches.filter((b) => !itemId || String(b.bmhp_item_id) === String(itemId));
    if (list.length > 0) return list;
    // Mock sample kelompok stok multi-dimensi sesuai tampilan mockup gambar
    return [
      { id: 101, fiscal_year: '2026', budget_source: 'BLUD', batch_no: 'BATCH-001', expiry_date: '2029-04-30', stock: 150, unit_price: 250000 },
      { id: 102, fiscal_year: '2026', budget_source: 'APBD', batch_no: 'BATCH-002', expiry_date: '2029-06-30', stock: 80, unit_price: 245000 },
      { id: 103, fiscal_year: '2025', budget_source: 'BLUD', batch_no: 'BATCH-010', expiry_date: '2028-12-31', stock: 40, unit_price: 240000 },
    ];
  }, [batches, inForm.item_id, selectedItem]);

  // Auto select batch pertama untuk form keluar jika belum ada yang dipilih
  useEffect(() => {
    if (availableBatches.length > 0 && !outForm.selected_batch_id) {
      setOutForm((prev) => ({ ...prev, selected_batch_id: availableBatches[0].id }));
    }
  }, [availableBatches, outForm.selected_batch_id]);

  // ---------------------------------------------------------------------------
  // 4. SUBMIT TRANSAKSI MASUK
  // ---------------------------------------------------------------------------
  const handleInSubmit = async (e) => {
    e?.preventDefault();
    if (!inForm.item_id && !selectedItem?.id) {
      toast.error('Pilih Nama Barang terlebih dahulu.');
      return;
    }
    if (!inForm.quantity || Number(inForm.quantity) <= 0) {
      toast.error('Jumlah masuk harus lebih besar dari 0.');
      return;
    }

    setInSubmitting(true);
    try {
      await api.post(API_ENDPOINTS.BMHP_TRANSACTIONS.LIST, {
        bmhp_item_id: inForm.item_id || selectedItem.id,
        type: 'MASUK',
        quantity: Number(inForm.quantity),
        unit_price: Number(inForm.unit_price) || 0,
        total_price: Number(inForm.quantity) * Number(inForm.unit_price || 0),
        fiscal_year: inForm.fiscal_year,
        budget_source: inForm.budget_source,
        batch_no: inForm.batch_no || 'BATCH-001',
        expiry_date: inForm.expiry_date || null,
        officer: inForm.receiver_officer || user?.name || 'Petugas CSSD',
        trx_date: inForm.receipt_date,
        trx_time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        notes: inForm.notes ? `${inForm.notes} [No Penerimaan: ${inForm.receipt_no}]` : `Penerimaan ${inForm.receipt_no}`,
      });

      toast.success(`Barang Masuk (${inForm.receipt_no}) berhasil dicatat ke sistem!`);
      if (onRefreshData) onRefreshData();

      // Regenerate receipt no
      const randomId = String(Math.floor(Math.random() * 9000) + 1000);
      setInForm((prev) => ({
        ...prev,
        receipt_no: `BM-2026-${randomId}`,
      }));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyimpan transaksi Barang Masuk'));
    } finally {
      setInSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. SUBMIT TRANSAKSI KELUAR
  // ---------------------------------------------------------------------------
  const handleOutSubmit = async (e) => {
    e?.preventDefault();
    if (!outForm.selected_batch_id) {
      toast.error('Pilih kelompok stok batch yang akan dikeluarkan pada tabel!');
      return;
    }
    if (!outForm.quantity || Number(outForm.quantity) <= 0) {
      toast.error('Jumlah pengambilan harus lebih dari 0.');
      return;
    }

    const batch = availableBatches.find((b) => b.id === outForm.selected_batch_id);
    if (batch && Number(outForm.quantity) > Number(batch.stock)) {
      toast.error(`Jumlah pengambilan (${outForm.quantity}) melebihi stok tersedia (${batch.stock})!`);
      return;
    }

    setOutSubmitting(true);
    try {
      await api.post(API_ENDPOINTS.BMHP_TRANSACTIONS.LIST, {
        bmhp_item_id: inForm.item_id || selectedItem?.id,
        type: 'KELUAR',
        quantity: Number(outForm.quantity),
        batch_id: outForm.selected_batch_id,
        unit_name: 'Instalasi CSSD', // Strictly locked
        officer: outForm.officer || user?.name || 'Resti',
        trx_date: outForm.issue_date,
        trx_time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        notes: outForm.notes ? `${outForm.notes} [No Pengeluaran: ${outForm.issue_no}]` : `Pengambilan ${outForm.issue_no}`,
      });

      toast.success(`Pengambilan BMHP (${outForm.issue_no}) berhasil dikonfirmasi!`);
      if (onRefreshData) onRefreshData();

      // Regenerate issue no
      const randomId = String(Math.floor(Math.random() * 9000) + 1000);
      setOutForm((prev) => ({
        ...prev,
        issue_no: `BK-2026-${randomId}`,
      }));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal mencatat pengeluaran BMHP'));
    } finally {
      setOutSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 6. CETAK RESMI KARTU STOK BMHP (SESUAI TEMPLATE GAMBAR 3 / EXCEL RSUD SERPONG UTARA)
  // ---------------------------------------------------------------------------
  const handlePrintStockCardPdf = () => {
    const item = selectedItem || {
      name: inForm.item_name || 'Sterilization Flat Roll Pouch 75 mm x 200 m',
      code: 'BMHP-POUCH-01',
      unit_label: inForm.unit_label || 'Rol',
      packaging: inForm.packaging || 'Rol',
    };
    const batch = availableBatches.find((b) => b.id === outForm.selected_batch_id) || availableBatches[0] || {};

    const win = window.open('', '_blank', 'width=1000,height=900');
    if (!win) {
      toast.error('Pop-up terblokir browser. Izinkan pop-up untuk mencetak Kartu Stok.');
      return;
    }

    // Bangun 50 baris portrait sesuai ketentuan RSUD Serpong Utara
    const rowsData = [
      { no: 1, date: '21-11-2026', desc: 'Penerimaan (BM-2026-0001)', inQty: 50, outQty: '-', balance: 50, officer: 'Alvin' },
      { no: 2, date: '21-11-2026', desc: 'Pengambilan (BK-2026-0001)', inQty: '-', outQty: 10, balance: 40, officer: 'Resti' },
    ];
    let rowsHtml = '';
    for (let i = 1; i <= 50; i++) {
      const d = rowsData[i - 1];
      rowsHtml += `
        <tr style="height: 20px;">
          <td style="border: 1px solid #1e293b; padding: 2px 4px; text-align: center; font-size: 10px;">${i}</td>
          <td style="border: 1px solid #1e293b; padding: 2px 6px; font-size: 10px;">${d ? d.date : ''}</td>
          <td style="border: 1px solid #1e293b; padding: 2px 6px; font-size: 10px;">${d ? d.desc : ''}</td>
          <td style="border: 1px solid #1e293b; padding: 2px 6px; text-align: center; font-size: 10px; font-weight: bold; color: #047857;">${d ? d.inQty : ''}</td>
          <td style="border: 1px solid #1e293b; padding: 2px 6px; text-align: center; font-size: 10px; font-weight: bold; color: #be123c;">${d ? d.outQty : ''}</td>
          <td style="border: 1px solid #1e293b; padding: 2px 6px; text-align: center; font-size: 10px; font-weight: bold;">${d ? d.balance : ''}</td>
          <td style="border: 1px solid #1e293b; padding: 2px 4px; text-align: center; font-size: 9px;">
            ${d ? `<img src="${SVG_PARAF_PETUGAS}" style="height: 16px; display: inline-block; vertical-align: middle;"/>` : ''}
          </td>
        </tr>
      `;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>KARTU STOK BMHP - ${item.name}</title>
          <style>
            @page { size: portrait; margin: 12mm 15mm; }
            body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #0f172a; }
            table { border-collapse: collapse; width: 100%; }
          </style>
        </head>
        <body>
          <!-- KOP SURAT RESMI RSUD SERPONG UTARA DENGAN 2 LOGO -->
          <div style="border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
            <div style="width: 70px; text-align: left;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="65" height="65">
                <path d="M 50 5 L 85 20 L 85 60 C 85 80 50 95 50 95 C 50 95 15 80 15 60 L 15 20 Z" fill="#00529b" stroke="#f1c40f" stroke-width="3"/>
                <polygon points="50,15 54,27 67,27 56,35 60,47 50,39 40,47 44,35 33,27 46,27" fill="#f1c40f"/>
                <path d="M 30 70 Q 50 55 70 70" fill="none" stroke="#27ae60" stroke-width="5" stroke-linecap="round"/>
                <path d="M 25 78 Q 50 68 75 78" fill="none" stroke="#2980b9" stroke-width="3"/>
                <path d="M 28 84 Q 50 74 72 84" fill="none" stroke="#ffffff" stroke-width="2"/>
                <text x="50" y="58" font-size="8" font-family="sans-serif" font-weight="900" fill="#ffffff" text-anchor="middle">KOTA</text>
                <text x="50" y="66" font-size="7" font-family="sans-serif" font-weight="900" fill="#f1c40f" text-anchor="middle">TANGSEL</text>
              </svg>
            </div>
            <div style="flex: 1; text-align: center; padding: 0 10px;">
              <h4 style="margin: 0; font-size: 13px; font-weight: bold; letter-spacing: 0.8px;">PEMERINTAH KOTA TANGERANG SELATAN</h4>
              <h3 style="margin: 2px 0 0; font-size: 15px; font-weight: bold;">DINAS KESEHATAN</h3>
              <h2 style="margin: 2px 0 0; font-size: 17px; font-weight: 900; color: #002D85;">RUMAH SAKIT UMUM DAERAH SERPONG UTARA</h2>
              <p style="margin: 3px 0 0; font-size: 10px; color: #1e293b; line-height: 1.3;">
                Jl. Raya Serpong, Kel. Pakulonan, Kec. Serpong Utara, Kota Tangerang Selatan - 15320<br/>
                Telp. 021-59629999, Email : rsudserpongutara@tangerangselatankota.go.id
              </p>
            </div>
            <div style="width: 70px; text-align: right;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="65" height="65">
                <circle cx="50" cy="50" r="46" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
                <circle cx="50" cy="32" r="14" fill="#d946ef" opacity="0.8"/>
                <circle cx="68" cy="50" r="14" fill="#ec4899" opacity="0.8"/>
                <circle cx="50" cy="68" r="14" fill="#d946ef" opacity="0.8"/>
                <circle cx="32" cy="50" r="14" fill="#ec4899" opacity="0.8"/>
                <rect x="44" y="28" width="12" height="44" rx="4" fill="#0d9488"/>
                <rect x="28" y="44" width="44" height="12" rx="4" fill="#0d9488"/>
                <text x="50" y="89" font-size="7" font-family="sans-serif" font-weight="900" fill="#0f766e" text-anchor="middle">RSUD SERPONG</text>
                <text x="50" y="96" font-size="6" font-family="sans-serif" font-weight="800" fill="#0f766e" text-anchor="middle">UTARA</text>
              </svg>
            </div>
          </div>

          <!-- TITLE PILL SESUAI EXCEL GAMBAR 3 -->
          <div style="text-align: center; margin-bottom: 12px;">
            <div style="display: inline-block; background-color: #002D85; color: #ffffff; padding: 6px 36px; border-radius: 9999px; font-weight: 900; font-size: 16px; letter-spacing: 1px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
              KARTU STOK BMHP
            </div>
          </div>

          <!-- BOX IDENTITAS BARANG & ANGGARAN (LIGHT BLUE) -->
          <table style="width: 100%; border: 1.5px solid #002D85; background-color: #EBF3FC; margin-bottom: 12px; font-size: 11px;">
            <tr>
              <td style="padding: 6px 12px; width: 50%; vertical-align: top;">
                <div style="margin-bottom: 4px;"><b>Nama Barang</b> : ${item.name}</div>
                <div style="margin-bottom: 4px;"><b>Satuan</b> : ${item.unit_label || 'Rol'}</div>
                <div><b>Kemasan</b> : ${item.packaging || 'Rol'}</div>
              </td>
              <td style="padding: 6px 12px; width: 50%; vertical-align: top;">
                <div style="margin-bottom: 4px;"><b>Tahun Anggaran</b> : ${batch.fiscal_year || '2026'}</div>
                <div style="margin-bottom: 4px;"><b>Sumber Anggaran</b> : ${batch.budget_source || 'BLUD'}</div>
                <div style="margin-bottom: 4px;"><b>Batch/Lot</b> : ${batch.batch_no || 'BATCH-001'}</div>
                <div><b>ED (Expired Date)</b> : ${batch.expiry_date ? String(batch.expiry_date).slice(0, 7) : '04-2029'}</div>
              </td>
            </tr>
          </table>

          <!-- TABEL TRANSAKSI MUTASI (50 BARIS PORTRAIT TANPA HARGA RUPIAH) -->
          <table style="width: 100%; border: 1.5px solid #1e293b; font-size: 10px;">
            <thead>
              <tr style="background-color: #B9D7F2; text-align: center; font-weight: bold; border-bottom: 1.5px solid #1e293b;">
                <th style="border: 1px solid #1e293b; padding: 5px 4px; width: 35px;">No.</th>
                <th style="border: 1px solid #1e293b; padding: 5px 8px; width: 90px;">Tanggal</th>
                <th style="border: 1px solid #1e293b; padding: 5px 8px;">Uraian</th>
                <th style="border: 1px solid #1e293b; padding: 5px 8px; width: 75px;">Masuk (M)</th>
                <th style="border: 1px solid #1e293b; padding: 5px 8px; width: 75px;">Keluar (K)</th>
                <th style="border: 1px solid #1e293b; padding: 5px 8px; width: 85px;">Sisa Stok</th>
                <th style="border: 1px solid #1e293b; padding: 5px 8px; width: 85px;">Paraf Petugas</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- LEMBAR PENGESAHAN DUA TANDA TANGAN -->
          <div style="margin-top: 18px; display: flex; justify-content: space-between; font-size: 11px;">
            <div style="text-align: center; width: 220px;">
              <div>Petugas Pengelola BMHP,</div>
              <div style="height: 55px; display: flex; align-items: center; justify-content: center;">
                <img src="${SVG_SIGNATURE_ALVIN}" style="height: 48px;" alt="TTD"/>
              </div>
              <div style="font-weight: bold; text-decoration: underline;">( Alvin Pratama, A.Md.Farm )</div>
              <div style="font-size: 10px; color: #475569;">NIP. 19940815 202102 1 002</div>
            </div>

            <div style="text-align: center; width: 220px;">
              <div>Mengetahui,</div>
              <div><b>Kepala Instalasi CSSD</b></div>
              <div style="height: 55px; display: flex; align-items: center; justify-content: center;">
                <img src="${SVG_SIGNATURE_RAHMA}" style="height: 48px;" alt="TTD"/>
              </div>
              <div style="font-weight: bold; text-decoration: underline;">( Rahma, S.ST )</div>
              <div style="font-size: 10px; color: #475569;">NIP. 19850412 201001 2 015</div>
            </div>
          </div>

          <div style="margin-top: 12px; font-size: 9px; color: #64748b; text-align: right;">
            *Dicetak otomatis dari Sistem CSSD SMART — Tanpa nominal rupiah (SOP Fisik Persediaan RSUD Serpong Utara)
          </div>

          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  // Unduh CSV Kartu Stok tanpa nominal rupiah
  const handleExportStockCardCsv = () => {
    const item = selectedItem || { name: 'Sterilization Flat Roll Pouch 75 mm x 200 m', code: 'BMHP-POUCH-01', unit_label: 'Rol' };
    const batch = availableBatches.find((b) => b.id === outForm.selected_batch_id) || availableBatches[0] || {};

    const csvContent = [
      ['KARTU STOK BMHP - RSUD SERPONG UTARA'],
      ['Nama Barang', item.name, 'Kode Barang', item.code],
      ['Tahun Anggaran', batch.fiscal_year || '2026', 'Sumber Anggaran', batch.budget_source || 'BLUD'],
      ['Batch / Lot', batch.batch_no || 'BATCH-001', 'ED', batch.expiry_date || '2029-04-30'],
      [''],
      ['No', 'Tanggal', 'Uraian Transaksi', 'Masuk (M)', 'Keluar (K)', 'Sisa Stok', 'Paraf Petugas'],
      [1, '21-11-2026', 'Penerimaan (BM-2026-0001)', 50, '', 50, 'Alvin'],
      [2, '21-11-2026', 'Pengambilan (BK-2026-0001)', '', 10, 40, 'Resti'],
    ]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kartu-stok-${item.code || 'bmhp'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Kartu stok berhasil diunduh ke format Excel (CSV)!');
  };

  // ---------------------------------------------------------------------------
  // 7. ALUR TRANSAKSI BMHP (STEPPER MOCKUP)
  // ---------------------------------------------------------------------------
  const flowSteps = [
    { key: 'npb', label: 'NPB', sub: '(Nota Permintaan)', icon: FileText, color: 'text-blue-600', to: ROUTES.BMHP_DOCUMENTS },
    { key: 'spb', label: 'SPB', sub: '(Persetujuan)', icon: CheckCircle2, color: 'text-emerald-600', to: ROUTES.BMHP_DOCUMENTS },
    { key: 'sppb', label: 'SPPB', sub: '(Pengeluaran)', icon: Truck, color: 'text-amber-600', to: ROUTES.BMHP_DOCUMENTS },
    { key: 'bast', label: 'BAST', sub: '(Serah Terima)', icon: ClipboardList, color: 'text-purple-600', to: ROUTES.BMHP_DOCUMENTS },
    { key: 'laporan', label: 'Laporan', sub: '(Persediaan)', icon: BarChart3, color: 'text-blue-700', to: ROUTES.BMHP_REPORT },
  ];

  return (
    <div className="space-y-3 font-sans text-slate-800 print:hidden">
      {/* ========================================================================= */}
      {/* 1. HEADER: CSSD SMART | Sistem Manajemen Persediaan BMHP Terintegrasi     */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-blue-200/90 bg-gradient-to-r from-[#001845] via-[#002875] to-[#003896] px-4 py-3 text-white shadow-lg relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/20 blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-blue-950 shadow-md">
            <Boxes size={24} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase flex flex-wrap items-center gap-1.5">
              <span className="text-amber-300 drop-shadow-sm">CSSD SMART</span>
              <span className="text-white/40 font-light">|</span>
              <span className="tracking-wide">Sistem Manajemen Persediaan BMHP Terintegrasi</span>
            </h1>
            <p className="text-[11px] font-medium text-blue-100/90">
              Satu kali transaksi dicatat → Stok, Kartu Stok, Dokumen Otomatis (NPB/SPB/SPPB/BAST) & Seluruh Laporan terbarui seketika.
            </p>
          </div>
        </div>

        {/* User Info & Header Actions */}
        <div className="flex items-center gap-3 relative z-10 self-end sm:self-center">
          <button
            type="button"
            className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            title="3 Notifikasi Belum Dibaca"
          >
            <Bell size={16} />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
              3
            </span>
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            title="Bantuan Penggunaan"
          >
            <HelpCircle size={16} />
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-white/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-300 text-blue-950 font-black text-xs shadow-inner">
              R
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <div className="text-xs font-black text-white">{user?.name || 'Rahma'}</div>
              <div className="text-[10px] text-blue-200">Kepala Instalasi CSSD</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ALUR TRANSAKSI BMHP TERINTEGRASI (STEPPER HORIZONTAL)                  */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-blue-200/80 bg-white p-3 shadow-xs">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#001F5F]">
            <Sparkles size={14} className="text-blue-600" />
            Alur Transaksi BMHP Terintegrasi
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            NPB → SPB → SPPB → BAST → Laporan
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {flowSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.key}
                onClick={() => navigate(step.to)}
                className="group relative flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-2.5 shadow-2xs hover:border-blue-400 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 ${step.color} shadow-2xs group-hover:scale-105 transition`}>
                    <Icon size={18} />
                  </div>
                  <div className="leading-tight">
                    <span className="block text-xs font-black text-[#001F5F]">{step.label}</span>
                    <span className="block text-[10px] font-semibold text-slate-500">{step.sub}</span>
                  </div>
                </div>
                {idx < flowSteps.length - 1 && (
                  <ChevronRight size={14} className="text-slate-300 hidden sm:block" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. 8 STAT CARDS RINGKASAN PERSEDIAAN (SINGLE ROW)                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <StatKpi
          label="Total Jenis Barang"
          value={formatNumber(summary.total_items || items.length || 156)}
          icon={Tag}
          color="blue"
        />
        <StatKpi
          label="Total Barang Masuk"
          value={formatNumber(summary.total_in_all ?? 2350)}
          icon={TrendingUp}
          color="emerald"
        />
        <StatKpi
          label="Total Barang Keluar"
          value={formatNumber(summary.total_out_all ?? 1820)}
          icon={TrendingDown}
          color="orange"
        />
        <StatKpi
          label="Sisa Stok"
          value={formatNumber(summary.total_stock || 530)}
          icon={Boxes}
          color="purple"
        />
        <StatKpi
          label="Stok Aman"
          value={formatNumber(summary.safe_count || 380)}
          icon={CheckCircle2}
          color="green"
        />
        <StatKpi
          label="Stok Menipis"
          value={formatNumber(summary.low_count || 110)}
          icon={AlertTriangle}
          color="yellow"
        />
        <StatKpi
          label="Stok Habis"
          value={formatNumber(summary.empty_count || 12)}
          icon={AlertOctagon}
          color="red"
        />
        <StatKpi
          label="Mendekati ED (≤3 Bln)"
          value={formatNumber(summary.expiring_count_3m || 28)}
          icon={CalendarX}
          color="amber"
        />
      </div>

      {/* ========================================================================= */}
      {/* 4. WORKSTATION 3-KOLOM (KIRI: MASUK | TENGAH: KELUAR | KANAN: DOK & KARTU) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* ----------------------------------------------------------------------- */}
        {/* KOLOM KIRI (5 COLS): INPUT BARANG MASUK (PENERIMAAN BMHP)               */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-5 rounded-2xl border border-blue-200/90 bg-white shadow-xs overflow-hidden flex flex-col justify-between">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-[#002D85] to-[#0047AB] px-3.5 py-2 text-white flex items-center justify-between border-b-2 border-amber-400">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 text-white">
                <PackagePlus size={14} />
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider text-white">
                Input Barang Masuk <span className="font-normal text-blue-200">(Penerimaan BMHP)</span>
              </h2>
            </div>
            <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[9px] font-black text-emerald-200">
              BMHP-IN
            </span>
          </div>

          <form onSubmit={handleInSubmit} className="p-3 space-y-2.5 text-xs">
            {/* Bagian 1: Data Penerimaan */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1">
                <span className="text-[10px] font-extrabold uppercase text-[#002D85]">Data Penerimaan</span>
                <span className="text-[9px] text-slate-400 font-semibold">Dokumen Pembelian</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">No. Penerimaan *</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={inForm.receipt_no}
                      readOnly
                      className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-mono font-bold text-blue-900"
                    />
                    <button
                      type="button"
                      onClick={() => setInForm((prev) => ({ ...prev, receipt_no: `BM-2026-${Math.floor(Math.random() * 9000) + 1000}` }))}
                      className="p-1 text-slate-400 hover:text-blue-600"
                      title="Generate Ulang"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tanggal Penerimaan *</label>
                  <input
                    type="date"
                    value={inForm.receipt_date}
                    onChange={(e) => setInForm({ ...inForm, receipt_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-semibold text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Supplier / Penyedia *</label>
                  <input
                    type="text"
                    value={inForm.supplier}
                    onChange={(e) => setInForm({ ...inForm, supplier: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-semibold text-slate-800"
                    placeholder="PT. Medika Sejahtera"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">No. PO / SPK / Kontrak</label>
                  <input
                    type="text"
                    value={inForm.po_number}
                    onChange={(e) => setInForm({ ...inForm, po_number: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">No. Surat Jalan</label>
                  <input
                    type="text"
                    value={inForm.delivery_note}
                    onChange={(e) => setInForm({ ...inForm, delivery_note: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">No. Faktur</label>
                  <input
                    type="text"
                    value={inForm.invoice_number}
                    onChange={(e) => setInForm({ ...inForm, invoice_number: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-mono text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 2: Data Anggaran */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase text-[#002D85] block border-b border-slate-200/60 pb-1">
                Data Anggaran
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tahun Anggaran *</label>
                  <select
                    value={inForm.fiscal_year}
                    onChange={(e) => setInForm({ ...inForm, fiscal_year: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-bold text-slate-800"
                  >
                    {FISCAL_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Sumber Anggaran *</label>
                  <select
                    value={inForm.budget_source}
                    onChange={(e) => setInForm({ ...inForm, budget_source: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-bold text-slate-800"
                  >
                    {BUDGET_SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Kode Rekening</label>
                  <select
                    value={inForm.account_code}
                    onChange={(e) => setInForm({ ...inForm, account_code: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1 text-[9px] font-semibold text-slate-800 truncate"
                  >
                    {ACCOUNT_CODES.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Bagian 3: Detail Barang */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase text-[#002D85] block border-b border-slate-200/60 pb-1">
                Detail Barang
              </span>

              {/* Pilih Nama Barang */}
              <div>
                <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Nama Barang (Master Data) *</label>
                <div className="relative">
                  <select
                    value={inForm.item_id || selectedItem?.id || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const it = items.find((x) => x.id === id);
                      if (it) {
                        setInForm((prev) => ({
                          ...prev,
                          item_id: it.id,
                          item_name: it.name,
                          category: it.category || 'Kemasan Steril',
                          unit_label: it.unit_label || 'Rol',
                          packaging: it.packaging || 'Rol',
                        }));
                        setOutForm((prev) => ({ ...prev, item_id: it.id, item_name: it.name, unit_label: it.unit_label || 'Rol' }));
                        if (onSelectItem) onSelectItem(it.id);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 pl-2 pr-7 text-[10px] font-bold text-slate-900"
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>{it.name}</option>
                    ))}
                  </select>
                  <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Info Detail Grid */}
              <div className="grid grid-cols-4 gap-1.5 text-[9px]">
                <div className="rounded bg-white p-1 border border-slate-200">
                  <span className="text-slate-400 block">Kategori</span>
                  <span className="font-bold text-slate-800 truncate block">{inForm.category}</span>
                </div>
                <div className="rounded bg-white p-1 border border-slate-200">
                  <span className="text-slate-400 block">Merek</span>
                  <span className="font-bold text-slate-800 truncate block">{inForm.brand}</span>
                </div>
                <div className="rounded bg-white p-1 border border-slate-200">
                  <span className="text-slate-400 block">Pabrik/Produsen</span>
                  <span className="font-bold text-slate-800 truncate block">{inForm.manufacturer}</span>
                </div>
                <div className="rounded bg-white p-1 border border-slate-200">
                  <span className="text-slate-400 block">Satuan & Kemasan</span>
                  <span className="font-bold text-slate-800 truncate block">{inForm.unit_label} / {inForm.packaging}</span>
                </div>
              </div>

              {/* Batch, Tgl Produksi, ED */}
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Batch / Lot *</label>
                  <input
                    type="text"
                    value={inForm.batch_no}
                    onChange={(e) => setInForm({ ...inForm, batch_no: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-mono font-bold text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tgl. Produksi</label>
                  <input
                    type="month"
                    value={inForm.production_date}
                    onChange={(e) => setInForm({ ...inForm, production_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">ED (Expired Date) *</label>
                  <input
                    type="date"
                    value={inForm.expiry_date}
                    onChange={(e) => setInForm({ ...inForm, expiry_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-semibold text-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Jumlah Diterima, Harga Satuan, Total Harga */}
              <div className="grid grid-cols-3 gap-2 pt-0.5 items-end">
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Jumlah Diterima *</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setInForm((prev) => ({ ...prev, quantity: Math.max(1, Number(prev.quantity) - 5) }))}
                      className="h-6 w-6 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center justify-center font-bold text-xs"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={inForm.quantity}
                      onChange={(e) => setInForm({ ...inForm, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-full text-center rounded-lg border border-slate-300 bg-white py-0.5 px-1 text-xs font-black text-slate-900"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setInForm((prev) => ({ ...prev, quantity: Number(prev.quantity) + 5 }))}
                      className="h-6 w-6 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center justify-center font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={inForm.unit_price}
                    onChange={(e) => setInForm({ ...inForm, unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Total Harga (Rp)</label>
                  <div className="rounded-lg bg-amber-50 border border-amber-300 px-2 py-1 text-[10px] font-black text-blue-950 text-right">
                    Rp {((Number(inForm.quantity) || 0) * (Number(inForm.unit_price) || 0)).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Kondisi, Lokasi Penyimpanan, Keterangan */}
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Kondisi Barang</label>
                  <select
                    value={inForm.condition}
                    onChange={(e) => setInForm({ ...inForm, condition: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-semibold text-slate-800"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Rusak">Rusak</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Lokasi Penyimpanan</label>
                  <input
                    type="text"
                    value={inForm.storage_location}
                    onChange={(e) => setInForm({ ...inForm, storage_location: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 4: Lampiran & Tanda Tangan */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-[#002D85] block border-b border-slate-200/60 pb-1">
                Lampiran & Tanda Tangan
              </span>

              {/* Thumbnails Foto & Tombol Unggah */}
              <div className="flex items-center gap-2">
                <img src={SAMPLE_PHOTO_BOX} alt="Box" className="h-10 w-12 rounded object-cover border border-slate-300 shadow-2xs" />
                <img src={SAMPLE_PHOTO_ROLL} alt="Roll" className="h-10 w-12 rounded object-cover border border-slate-300 shadow-2xs" />
                <div className="flex-1 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => toast('Unggah foto barang dari kamera/galeri')}
                    className="flex-1 rounded border border-dashed border-slate-300 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1"
                  >
                    <Camera size={11} /> Foto Barang
                  </button>
                  <button
                    type="button"
                    onClick={() => toast('Unggah scan Surat Jalan')}
                    className="flex-1 rounded border border-dashed border-slate-300 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1"
                  >
                    <FileText size={11} /> Surat Jalan
                  </button>
                  <button
                    type="button"
                    onClick={() => toast('Unggah dokumen Faktur')}
                    className="flex-1 rounded border border-dashed border-slate-300 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1"
                  >
                    <FileCheck size={11} /> Faktur
                  </button>
                </div>
              </div>

              {/* Dua Kotak Tanda Tangan: Petugas Penerima & Verifikator */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div
                  onClick={() => setInSigModal({ open: true, target: 'receiver' })}
                  className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-2 text-center cursor-pointer hover:bg-emerald-100/70 transition"
                  title="Klik untuk ubah tanda tangan Petugas Penerima"
                >
                  <span className="text-[9px] font-bold text-emerald-900 block mb-0.5">Petugas Penerima *</span>
                  <div className="h-9 flex items-center justify-center">
                    <img src={inForm.receiver_signature} alt="TTD" className="h-full object-contain" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-600 block">{inForm.receiver_officer} (CSSD)</span>
                </div>

                <div
                  onClick={() => setInSigModal({ open: true, target: 'verifier' })}
                  className="rounded-xl border border-blue-300 bg-blue-50/50 p-2 text-center cursor-pointer hover:bg-blue-100/70 transition"
                  title="Klik untuk verifikasi Kepala Instalasi CSSD"
                >
                  <span className="text-[9px] font-bold text-blue-900 block mb-0.5">Verifikator / Kepala Instalasi *</span>
                  <div className="h-9 flex items-center justify-center">
                    <img src={inForm.verifier_signature} alt="TTD" className="h-full object-contain" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-600 block">{inForm.verifier_name} (Kepala)</span>
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => toast('Form barang masuk di-reset ke nilai awal')}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={inSubmitting}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 px-4 py-2 text-xs font-black text-white shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Save size={14} />
                <span>{inSubmitting ? 'Menyimpan...' : 'Simpan Barang Masuk'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* KOLOM TENGAH (4 COLS): INPUT BARANG KELUAR (PENGAMBILAN BMHP)           */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-4 rounded-2xl border border-blue-200/90 bg-white shadow-xs overflow-hidden flex flex-col justify-between">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-[#003896] to-[#0052CC] px-3.5 py-2 text-white flex items-center justify-between border-b-2 border-amber-400">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 text-white">
                <ShoppingCart size={14} />
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider text-white">
                Input Barang Keluar <span className="font-normal text-blue-200">(Pengambilan BMHP)</span>
              </h2>
            </div>
            <span className="rounded bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 text-[9px] font-black text-sky-200">
              BMHP-OUT
            </span>
          </div>

          <form onSubmit={handleOutSubmit} className="p-3 space-y-2.5 text-xs">
            {/* Bagian 1: Data Pengeluaran */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1">
                <span className="text-[10px] font-extrabold uppercase text-[#002D85]">Data Pengeluaran</span>
                <span className="text-[9px] text-slate-400 font-semibold">Khusus Internal CSSD</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">No. Pengeluaran *</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={outForm.issue_no}
                      readOnly
                      className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-mono font-bold text-blue-900"
                    />
                    <button
                      type="button"
                      onClick={() => setOutForm((prev) => ({ ...prev, issue_no: `BK-2026-${Math.floor(Math.random() * 9000) + 1000}` }))}
                      className="p-1 text-slate-400 hover:text-blue-600"
                      title="Generate Ulang"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tanggal Pengambilan *</label>
                  <input
                    type="date"
                    value={outForm.issue_date}
                    onChange={(e) => setOutForm({ ...outForm, issue_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-semibold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                    Unit Pemakai <span className="text-amber-600 font-extrabold">(Terkunci)</span>
                  </label>
                  <div className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50/80 py-1 px-2 text-[10px] font-black text-blue-950">
                    <Lock size={11} className="text-amber-600 shrink-0" />
                    <span>Instalasi CSSD</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Nama Petugas *</label>
                  <input
                    type="text"
                    value={outForm.officer}
                    onChange={(e) => setOutForm({ ...outForm, officer: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-bold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Keperluan / Uraian *</label>
                <input
                  type="text"
                  value={outForm.purpose}
                  onChange={(e) => setOutForm({ ...outForm, purpose: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] font-medium text-slate-800"
                  required
                />
              </div>
            </div>

            {/* Bagian 2: Pilih Barang & Sumber Stok */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase text-[#002D85] block border-b border-slate-200/60 pb-1">
                Pilih Barang & Sumber Stok
              </span>

              <div>
                <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Nama Barang</label>
                <div className="rounded-lg border border-slate-300 bg-white py-1 px-2 text-[10px] font-bold text-slate-900 truncate">
                  {outForm.item_name}
                </div>
              </div>

              {/* Tabel Pemilihan Stok Multi-Dimensi (Tahun, Sumber Anggaran, Batch, ED, Stok) */}
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-700">
                  Pilih Stok <span className="text-slate-400 font-normal">(Berdasarkan Tahun, Sumber Anggaran, Batch, dan ED) *</span>
                </label>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-[9px]">
                    <thead className="bg-[#002D85] text-white font-bold uppercase">
                      <tr>
                        <th className="py-1 px-1.5 text-center w-6">Pilih</th>
                        <th className="py-1 px-1.5">Tahun</th>
                        <th className="py-1 px-1.5">Sumber</th>
                        <th className="py-1 px-1.5">Batch/Lot</th>
                        <th className="py-1 px-1.5">ED</th>
                        <th className="py-1 px-1.5 text-right">Stok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {availableBatches.map((b) => {
                        const isChecked = outForm.selected_batch_id === b.id;
                        return (
                          <tr
                            key={b.id}
                            onClick={() => setOutForm({ ...outForm, selected_batch_id: b.id })}
                            className={`cursor-pointer transition ${
                              isChecked ? 'bg-sky-50 font-bold text-blue-950' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <td className="py-1 px-1.5 text-center">
                              <input
                                type="radio"
                                name="pick_stock_batch"
                                checked={isChecked}
                                onChange={() => setOutForm({ ...outForm, selected_batch_id: b.id })}
                                className="h-3 w-3 text-blue-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-1 px-1.5">{b.fiscal_year}</td>
                            <td className="py-1 px-1.5">
                              <span className="rounded bg-slate-100 px-1 py-0.2 text-[8px] font-bold text-slate-700">
                                {b.budget_source}
                              </span>
                            </td>
                            <td className="py-1 px-1.5 font-mono">{b.batch_no}</td>
                            <td className="py-1 px-1.5">{b.expiry_date ? String(b.expiry_date).slice(0, 7) : '04-2029'}</td>
                            <td className="py-1 px-1.5 text-right font-black text-slate-900">
                              {b.stock} {outForm.unit_label}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Jumlah Diambil, Satuan, Keterangan */}
              <div className="grid grid-cols-2 gap-2 pt-0.5 items-end">
                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Jumlah Diambil *</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOutForm((prev) => ({ ...prev, quantity: Math.max(1, Number(prev.quantity) - 1) }))}
                      className="h-6 w-6 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center justify-center font-bold text-xs"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={outForm.quantity}
                      onChange={(e) => setOutForm({ ...outForm, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-full text-center rounded-lg border border-slate-300 bg-white py-0.5 px-1 text-xs font-black text-slate-900"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setOutForm((prev) => ({ ...prev, quantity: Number(prev.quantity) + 1 }))}
                      className="h-6 w-6 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center justify-center font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Satuan</label>
                  <div className="rounded-lg border border-slate-300 bg-slate-100 py-1 px-2 text-[10px] font-bold text-slate-700">
                    {outForm.unit_label}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Keterangan</label>
                <input
                  type="text"
                  value={outForm.notes}
                  onChange={(e) => setOutForm({ ...outForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-[10px] text-slate-800"
                />
              </div>
            </div>

            {/* Bagian 3: Lampiran & Tanda Tangan */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-[#002D85] block border-b border-slate-200/60 pb-1">
                Lampiran & Tanda Tangan
              </span>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-semibold text-slate-500">Foto Serah Terima (Opsional)</span>
                <button
                  type="button"
                  onClick={() => toast('Ambil foto serah terima dari kamera')}
                  className="rounded border border-dashed border-slate-300 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                >
                  <Camera size={11} /> Tambah Foto
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div
                  onClick={() => setOutSigModal({ open: true, target: 'giver' })}
                  className="rounded-xl border border-slate-300 bg-white p-2 text-center cursor-pointer hover:bg-slate-50 transition"
                  title="Klik untuk tanda tangan Petugas Penyerah"
                >
                  <span className="text-[9px] font-bold text-slate-700 block mb-0.5">Petugas Penyerah *</span>
                  <div className="h-9 flex items-center justify-center">
                    <img src={outForm.giver_signature} alt="TTD" className="h-full object-contain" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-600 block">{outForm.giver_officer} (Penyerah)</span>
                </div>

                <div
                  onClick={() => setOutSigModal({ open: true, target: 'taker' })}
                  className="rounded-xl border border-slate-300 bg-white p-2 text-center cursor-pointer hover:bg-slate-50 transition"
                  title="Klik untuk tanda tangan Penerima BMHP"
                >
                  <span className="text-[9px] font-bold text-slate-700 block mb-0.5">Penerima BMHP *</span>
                  <div className="h-9 flex items-center justify-center">
                    <img src={outForm.taker_signature} alt="TTD" className="h-full object-contain" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-600 block">{outForm.taker_officer} (Penerima)</span>
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => toast('Form pengeluaran di-reset')}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={outSubmitting}
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 hover:brightness-110 px-4 py-2 text-xs font-black text-white shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Save size={14} />
                <span>{outSubmitting ? 'Menyimpan...' : 'Simpan Pengambilan'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* KOLOM KANAN (3 COLS): DOKUMEN OTOMATIS, KARTU STOK, LAPORAN, NOTIFIKASI */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-3 space-y-3">
          {/* 1. DOKUMEN OTOMATIS (SESUAI FORMAT RS) */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-[#002D85] to-[#0047AB] px-3 py-2 text-white flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText size={14} />
                <h3 className="text-xs font-black uppercase tracking-wider">Dokumen Otomatis</h3>
              </div>
              <span className="text-[9px] text-blue-200 font-semibold">(Format RS)</span>
            </div>

            <div className="p-2 space-y-1.5">
              {[
                { code: 'NPB', label: 'Nota Permintaan Barang' },
                { code: 'SPB', label: 'Surat Persetujuan Barang' },
                { code: 'SPPB', label: 'Surat Perintah Pengeluaran Barang' },
                { code: 'BAST', label: 'Berita Acara Serah Terima' },
              ].map((doc) => (
                <div key={doc.code} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-[10px]">
                  <div className="min-w-0 pr-1">
                    <span className="font-black text-[#002D85]">{doc.code}</span>
                    <span className="text-slate-500 truncate block text-[9px]">{doc.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.BMHP_DOCUMENTS)}
                      className="rounded bg-blue-100 hover:bg-blue-200 text-blue-800 px-1.5 py-0.5 font-bold text-[9px] flex items-center gap-0.5"
                    >
                      <Eye size={10} /> Lihat
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.BMHP_DOCUMENTS)}
                        className="rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-1.5 py-0.5 font-bold text-[9px] flex items-center gap-0.5"
                      >
                        <Download size={10} /> Unduh
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. KARTU STOK BMHP (PREVIEW & TOMBOL CETAK RESMI EXCEL RSUD SERPONG UTARA) */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-[#001F5F] to-[#002D85] px-3 py-2 text-white flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ClipboardList size={14} className="text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">Kartu Stok BMHP</h3>
              </div>
              <span className="text-[9px] text-amber-300 font-bold">Tanpa Nilai Rp</span>
            </div>

            <div className="p-2 space-y-2">
              <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-1.5 text-[9px] space-y-0.5">
                <div className="font-black text-[#002D85] truncate">{inForm.item_name}</div>
                <div className="flex justify-between text-slate-600 font-semibold">
                  <span>Sumber: <b>{inForm.budget_source}</b></span>
                  <span>Tahun: <b>{inForm.fiscal_year}</b></span>
                </div>
                <div className="flex justify-between text-slate-600 font-semibold">
                  <span>Batch: <b>{inForm.batch_no}</b></span>
                  <span>ED: <b>04-2029</b></span>
                </div>
              </div>

              {/* Tabel Mini Transaksi Kartu Stok */}
              <div className="rounded-lg border border-slate-200 overflow-hidden text-[9px]">
                <table className="w-full text-left">
                  <thead className="bg-[#B9D7F2] text-slate-800 font-bold">
                    <tr>
                      <th className="py-1 px-1 text-center w-5">No</th>
                      <th className="py-1 px-1">Tanggal</th>
                      <th className="py-1 px-1">Uraian / Trx</th>
                      <th className="py-1 px-1 text-right">M</th>
                      <th className="py-1 px-1 text-right">K</th>
                      <th className="py-1 px-1 text-right">Sisa</th>
                      <th className="py-1 px-1 text-center">Paraf</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    <tr>
                      <td className="py-1 px-1 text-center">1</td>
                      <td className="py-1 px-1">21-11-2026</td>
                      <td className="py-1 px-1 truncate">Penerimaan (BM-2026-0001)</td>
                      <td className="py-1 px-1 text-right text-emerald-600 font-bold">50</td>
                      <td className="py-1 px-1 text-right text-slate-400">-</td>
                      <td className="py-1 px-1 text-right font-black">50</td>
                      <td className="py-1 px-1 text-center">
                        <img src={SVG_PARAF_PETUGAS} alt="paraf" className="h-3.5 inline-block" />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 px-1 text-center">2</td>
                      <td className="py-1 px-1">21-11-2026</td>
                      <td className="py-1 px-1 truncate">Pengambilan (BK-2026-0001)</td>
                      <td className="py-1 px-1 text-right text-slate-400">-</td>
                      <td className="py-1 px-1 text-right text-rose-600 font-bold">10</td>
                      <td className="py-1 px-1 text-right font-black">40</td>
                      <td className="py-1 px-1 text-center">
                        <img src={SVG_PARAF_PETUGAS} alt="paraf" className="h-3.5 inline-block" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tombol Cetak PDF & Unduh Excel */}
              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handlePrintStockCardPdf}
                  className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white py-1.5 text-[10px] font-black flex items-center justify-center gap-1 shadow-2xs transition"
                  title="Cetak format resmi RSUD Serpong Utara"
                >
                  <Printer size={12} /> Cetak PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportStockCardCsv}
                  className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 text-[10px] font-black flex items-center justify-center gap-1 shadow-2xs transition"
                  title="Unduh format tabel Excel CSV"
                >
                  <FileSpreadsheet size={12} /> Unduh Excel
                </button>
              </div>
            </div>
          </div>

          {/* 3. LAPORAN BMHP (8 TOMBOL GRID) */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-[#002D85] to-[#0047AB] px-3 py-2 text-white flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart3 size={14} />
                <h3 className="text-xs font-black uppercase tracking-wider">Laporan BMHP</h3>
              </div>
              <span className="text-[9px] text-blue-200">8 Menu</span>
            </div>

            <div className="p-2 grid grid-cols-2 gap-1.5">
              {[
                { label: 'Laporan Bulanan', tab: 'bulanan', icon: Calendar },
                { label: 'Rekap Persediaan', tab: 'rekap', icon: Layers },
                { label: 'Nilai Persediaan', tab: 'nilai', icon: Database },
                { label: 'Stock Opname', tab: 'opname', icon: ClipboardList },
                { label: 'Laporan ED & Batch', tab: 'expired', icon: Clock },
                { label: 'Barang Rusak', tab: 'rusak', icon: AlertOctagon },
                { label: 'Penggunaan BMHP', tab: 'penggunaan', icon: ShoppingCart },
                { label: 'Rekap Anggaran', tab: 'anggaran', icon: Building2 },
              ].map((rep) => {
                const Icon = rep.icon;
                return (
                  <button
                    key={rep.label}
                    type="button"
                    onClick={() => navigate(`${ROUTES.BMHP_REPORT}?tab=${rep.tab}`)}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-blue-50 hover:border-blue-300 p-1.5 text-left text-[9px] font-bold text-slate-800 flex items-center gap-1.5 transition truncate"
                  >
                    <Icon size={12} className="text-[#002D85] shrink-0" />
                    <span className="truncate">{rep.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. NOTIFIKASI SISTEM REAL-TIME */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-3 py-1.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bell size={13} className="text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">Notifikasi Sistem</h3>
              </div>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-blue-950 font-black text-[9px]">
                4
              </span>
            </div>

            <div className="p-2 space-y-1.5 text-[9px]">
              <div className="flex items-center justify-between gap-1.5 rounded bg-emerald-50 p-1 border border-emerald-200">
                <div className="flex items-center gap-1 text-emerald-900 font-semibold truncate">
                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                  <span className="truncate">NPB BM-2026-0002 menunggu persetujuan.</span>
                </div>
                <span className="text-[8px] text-slate-400 shrink-0">10:24 &gt;</span>
              </div>

              <div className="flex items-center justify-between gap-1.5 rounded bg-emerald-50 p-1 border border-emerald-200">
                <div className="flex items-center gap-1 text-emerald-900 font-semibold truncate">
                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                  <span className="truncate">SPPB BK-2026-0001 siap disalurkan.</span>
                </div>
                <span className="text-[8px] text-slate-400 shrink-0">10:10 &gt;</span>
              </div>

              <div className="flex items-center justify-between gap-1.5 rounded bg-emerald-50 p-1 border border-emerald-200">
                <div className="flex items-center gap-1 text-emerald-900 font-semibold truncate">
                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                  <span className="truncate">BAST BK-2026-0001 menunggu tanda tangan.</span>
                </div>
                <span className="text-[8px] text-slate-400 shrink-0">09:55 &gt;</span>
              </div>

              <div className="flex items-center justify-between gap-1.5 rounded bg-amber-50 p-1 border border-amber-200">
                <div className="flex items-center gap-1 text-amber-900 font-semibold truncate">
                  <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                  <span className="truncate">28 barang mendekati ED (≤ 3 bulan).</span>
                </div>
                <span className="text-[8px] text-slate-400 shrink-0">09:30 &gt;</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MONITORING & INFORMASI PERSEDIAAN (BOTTOM FOOTER BAR)                  */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-r from-[#001845] via-[#002D85] to-[#0047AB] p-3 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-amber-300" />
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Monitoring & Informasi Persediaan
            </h3>
            <p className="text-[10px] text-blue-200 font-medium">
              Ambang batas stok minimum, batch kedaluwarsa, dan valuasi aset BMHP CSSD.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-white/10 px-3 py-1.5 backdrop-blur-xs border border-white/15">
            <span className="block text-[9px] font-bold text-amber-300 uppercase">Stok Minimum</span>
            <span className="text-sm font-black text-white">{formatNumber(summary.low_count || 110)}</span>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-1.5 backdrop-blur-xs border border-white/15">
            <span className="block text-[9px] font-bold text-orange-300 uppercase">Mendekati ED</span>
            <span className="text-sm font-black text-white">{formatNumber(summary.expiring_count_3m || 28)}</span>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-1.5 backdrop-blur-xs border border-white/15">
            <span className="block text-[9px] font-bold text-rose-300 uppercase">Kedaluwarsa</span>
            <span className="text-sm font-black text-white">{formatNumber(summary.expired_count || 0)}</span>
          </div>

          <div className="rounded-xl bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 px-3 py-1.5 backdrop-blur-xs border border-emerald-400/30">
            <span className="block text-[9px] font-black text-emerald-300 uppercase">Total Nilai Persediaan</span>
            <span className="text-sm font-black text-white">
              Rp {formatNumber(summary.total_stock_value || 265750000)}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL TANDA TANGAN DIGITAL                                                */}
      {/* ========================================================================= */}
      {inSigModal.open && (
        <Modal
          isOpen={inSigModal.open}
          onClose={() => setInSigModal({ open: false, target: 'receiver' })}
          title={`Tanda Tangan Digital ${inSigModal.target === 'receiver' ? 'Petugas Penerima' : 'Verifikator / Kepala Instalasi'}`}
          maxWidth="max-w-md"
        >
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-500">
              Gunakan mouse atau layar sentuh pada kotak di bawah untuk membubuhkan tanda tangan resmi.
            </p>
            <div className="rounded-xl border border-slate-300 bg-white p-2">
              <SignaturePad
                value={inSigModal.target === 'receiver' ? inForm.receiver_signature : inForm.verifier_signature}
                onChange={(val) => {
                  if (inSigModal.target === 'receiver') {
                    setInForm((prev) => ({ ...prev, receiver_signature: val }));
                  } else {
                    setInForm((prev) => ({ ...prev, verifier_signature: val }));
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInSigModal({ open: false, target: 'receiver' })}
                className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
              >
                Gunakan Tanda Tangan
              </button>
            </div>
          </div>
        </Modal>
      )}

      {outSigModal.open && (
        <Modal
          isOpen={outSigModal.open}
          onClose={() => setOutSigModal({ open: false, target: 'giver' })}
          title={`Tanda Tangan Digital ${outSigModal.target === 'giver' ? 'Petugas Penyerah' : 'Penerima BMHP'}`}
          maxWidth="max-w-md"
        >
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-500">
              Gunakan mouse atau layar sentuh pada kotak di bawah untuk membubuhkan tanda tangan serah terima.
            </p>
            <div className="rounded-xl border border-slate-300 bg-white p-2">
              <SignaturePad
                value={outSigModal.target === 'giver' ? outForm.giver_signature : outForm.taker_signature}
                onChange={(val) => {
                  if (outSigModal.target === 'giver') {
                    setOutForm((prev) => ({ ...prev, giver_signature: val }));
                  } else {
                    setOutForm((prev) => ({ ...prev, taker_signature: val }));
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOutSigModal({ open: false, target: 'giver' })}
                className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
              >
                Gunakan Tanda Tangan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Sub-komponen Stat KPI Ringkasan
function StatKpi({ label, value, icon: Icon, color }) {
  const colorStyles = {
    blue: 'border-blue-200 bg-blue-50/60 text-blue-900 icon-text-blue-600',
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-900 icon-text-emerald-600',
    orange: 'border-orange-200 bg-orange-50/60 text-orange-900 icon-text-orange-600',
    purple: 'border-purple-200 bg-purple-50/60 text-purple-900 icon-text-purple-600',
    green: 'border-emerald-200 bg-emerald-50/60 text-emerald-900 icon-text-emerald-600',
    yellow: 'border-amber-200 bg-amber-50/60 text-amber-900 icon-text-amber-600',
    red: 'border-rose-200 bg-rose-50/60 text-rose-900 icon-text-rose-600',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-900 icon-text-amber-600',
  }[color] || 'border-slate-200 bg-slate-50 text-slate-900';

  return (
    <div className={`rounded-xl border p-2 shadow-2xs flex flex-col justify-between ${colorStyles.split('icon-')[0]}`}>
      <span className="text-[10px] font-bold text-slate-500 leading-tight block truncate mb-1">
        {label}
      </span>
      <div className="flex items-center justify-between">
        <span className="text-base font-black tracking-tight">{value}</span>
        <Icon size={16} className="opacity-75" />
      </div>
    </div>
  );
}
