import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  RefreshCw,
  Search,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/utils/api';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatNumber } from '@/utils/format';
import { getErrorMessage } from '@/utils/request';

// Helper parse Excel date
function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val)) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    // Excel serial date to JS Date
    const utc_days = Math.floor(val - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  // Format DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Format YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str.slice(0, 10);
}

// Helper auto-match column keys
function findColumnValue(row, possibleNames) {
  const rowKeys = Object.keys(row);
  for (const name of possibleNames) {
    const cleanTarget = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const foundKey = rowKeys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
      return row[foundKey];
    }
  }
  return null;
}

export default function BmhpBulkImportModal({ open, onClose, onSuccess }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dynamic fiscal years generator (2024 to current + 5)
  const currentYear = new Date().getFullYear();
  const fiscalYearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear + 4; y >= 2024; y--) {
      years.push(String(y));
    }
    return years;
  }, [currentYear]);

  const [defaultFiscalYear, setDefaultFiscalYear] = useState(String(currentYear));
  const [defaultBudgetSource, setDefaultBudgetSource] = useState('BLUD');
  const [duplicateStrategy, setDuplicateStrategy] = useState('skip');

  // Reset modal state
  const handleClose = () => {
    if (loading) return;
    setFile(null);
    setParsedRows([]);
    setSearchFilter('');
    setStatusFilter('all');
    onClose();
  };

  // Download official Excel template
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          'No': 1,
          'Kode Barang': 'BMHP-001',
          'Barcode': '899123456001',
          'Nama Barang *': 'Sterilization Flat Roll Pouch 75mm x 200m',
          'Kategori': 'Kemasan Steril',
          'Jenis Barang': 'Pouch Roll',
          'Spesifikasi': 'Medical paper 60gsm + laminated film, dual indicator steam & EO, 75mm x 200m',
          'Satuan': 'Rol',
          'Kemasan': 'Rol',
          'Isi Kemasan': 1,
          'Lokasi Penyimpanan': 'Gudang BMHP CSSD',
          'Tahun Anggaran *': defaultFiscalYear,
          'Sumber Anggaran *': 'BLUD',
          'Kode Rekening': '5.1.02.01.01',
          'Nomor Batch / Lot *': `BATCH-${defaultFiscalYear}-001`,
          'Tanggal Kadaluarsa (ED) *': '2029-04-30',
          'Tanggal Produksi': '2026-04-01',
          'Jumlah Saldo Awal *': 50,
          'Harga Satuan (Rp)': 250000,
          'Stok Minimum': 10,
          'Merek': 'SterilPack',
          'Pabrik / Produsen': 'PT. Sterilindo Medika',
          'Catatan / Keterangan': `Saldo Awal Pembukuan BMHP ${defaultFiscalYear}`,
        },
        {
          'No': 2,
          'Kode Barang': 'BMHP-002',
          'Barcode': '899123456002',
          'Nama Barang *': 'Chemical Indicator Strip Class 4 (Steam)',
          'Kategori': 'Indikator Kimia & Biologi',
          'Jenis Barang': 'Strip Indikator',
          'Spesifikasi': 'Multi-variable internal indicator strip for steam sterilization (134C & 121C)',
          'Satuan': 'Box',
          'Kemasan': 'Box',
          'Isi Kemasan': 200,
          'Lokasi Penyimpanan': 'Gudang BMHP CSSD',
          'Tahun Anggaran *': defaultFiscalYear,
          'Sumber Anggaran *': 'BLUD',
          'Kode Rekening': '5.1.02.01.01',
          'Nomor Batch / Lot *': `LOT-${defaultFiscalYear.slice(-2)}05-B`,
          'Tanggal Kadaluarsa (ED) *': '2028-11-15',
          'Tanggal Produksi': '2025-11-01',
          'Jumlah Saldo Awal *': 25,
          'Harga Satuan (Rp)': 175000,
          'Stok Minimum': 5,
          'Merek': 'SterilGuard',
          'Pabrik / Produsen': 'PT. Medika Sejahtera',
          'Catatan / Keterangan': `Saldo Awal Pembukuan BMHP ${defaultFiscalYear}`,
        },
        {
          'No': 3,
          'Kode Barang': 'BMHP-003',
          'Barcode': '899123456003',
          'Nama Barang *': 'Bowie Dick Test Pack',
          'Kategori': 'Indikator Kimia & Biologi',
          'Jenis Barang': 'Test Pack',
          'Spesifikasi': 'Daily air removal and steam penetration test pack for prevacuum steam sterilizer',
          'Satuan': 'Box',
          'Kemasan': 'Box',
          'Isi Kemasan': 30,
          'Lokasi Penyimpanan': 'Gudang BMHP CSSD',
          'Tahun Anggaran *': '2025',
          'Sumber Anggaran *': 'APBD',
          'Kode Rekening': '5.1.02.01.01',
          'Nomor Batch / Lot *': 'BD-2510-A',
          'Tanggal Kadaluarsa (ED) *': '2027-10-31',
          'Tanggal Produksi': '2025-01-15',
          'Jumlah Saldo Awal *': 15,
          'Harga Satuan (Rp)': 320000,
          'Stok Minimum': 3,
          'Merek': '3M',
          'Pabrik / Produsen': '3M Health Care',
          'Catatan / Keterangan': 'Sisa Persediaan Anggaran APBD 2025',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 5 },  // No
        { wch: 14 }, // Kode
        { wch: 16 }, // Barcode
        { wch: 42 }, // Nama Barang
        { wch: 22 }, // Kategori
        { wch: 18 }, // Jenis
        { wch: 35 }, // Spesifikasi
        { wch: 10 }, // Satuan
        { wch: 10 }, // Kemasan
        { wch: 12 }, // Isi Kemasan
        { wch: 20 }, // Lokasi
        { wch: 16 }, // Tahun Anggaran
        { wch: 16 }, // Sumber Anggaran
        { wch: 15 }, // Kode Rekening
        { wch: 20 }, // Batch
        { wch: 24 }, // ED
        { wch: 18 }, // Tanggal Produksi
        { wch: 18 }, // Jumlah Saldo Awal
        { wch: 18 }, // Harga Satuan
        { wch: 14 }, // Stok Minimum
        { wch: 15 }, // Merek
        { wch: 25 }, // Produsen
        { wch: 30 }, // Catatan
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template Saldo Awal BMHP');
      XLSX.writeFile(wb, `Template_Bulk_Import_BMHP_CSSD_SMART_${defaultFiscalYear}.xlsx`);
      toast.success('Format Template Excel berhasil diunduh!');
    } catch (err) {
      toast.error('Gagal mengunduh template Excel: ' + getErrorMessage(err));
    }
  };

  // Process Excel File
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Harap pilih file Excel berformat .xlsx, .xls, atau .csv');
      return;
    }

    setFile(selectedFile);
    parseExcel(selectedFile);
  };

  const parseExcel = (uploadedFile) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          toast.error('File Excel kosong atau tidak memiliki baris data.');
          setParsedRows([]);
          return;
        }

        // Map and validate rows
        const processed = rawJson.map((row, idx) => {
          const name = findColumnValue(row, ['Nama Barang *', 'Nama Barang', 'Nama', 'Item Name', 'Item', 'Deskripsi']) || '';
          const code = findColumnValue(row, ['Kode Barang', 'Kode', 'Item Code', 'Code']) || '';
          const barcode = findColumnValue(row, ['Barcode', 'Barcode Produk']) || '';
          const category = findColumnValue(row, ['Kategori', 'Category']) || 'Kemasan Steril';
          const itemType = findColumnValue(row, ['Jenis Barang', 'Jenis', 'Item Type', 'Type']) || '';
          const specification = findColumnValue(row, ['Spesifikasi', 'Specification', 'Spec']) || '';
          const unitLabel = findColumnValue(row, ['Satuan', 'Unit', 'Satuan Unit', 'Unit Label']) || 'pcs';
          const packagingLabel = findColumnValue(row, ['Kemasan', 'Packaging', 'Kemasan Satuan']) || unitLabel;
          const contentsPerPackage = parseInt(findColumnValue(row, ['Isi Kemasan', 'Isi per Kemasan', 'Isi', 'Contents']) || 1, 10) || 1;
          const storageLocation = findColumnValue(row, ['Lokasi Penyimpanan', 'Lokasi', 'Storage Location']) || 'Gudang BMHP CSSD';
          const accountCode = findColumnValue(row, ['Kode Rekening', 'Account Code', 'No Rekening']) || '';
          const fiscalYear = String(findColumnValue(row, ['Tahun Anggaran *', 'Tahun Anggaran', 'Tahun', 'Fiscal Year', 'Thn']) || defaultFiscalYear).trim();
          const budgetSource = String(findColumnValue(row, ['Sumber Anggaran *', 'Sumber Anggaran', 'Sumber', 'Budget Source', 'Anggaran']) || defaultBudgetSource).trim();
          const batchNo = String(findColumnValue(row, ['Nomor Batch / Lot *', 'Nomor Batch/Lot', 'Nomor Batch', 'Batch/Lot', 'Batch', 'Lot', 'No Batch']) || `BATCH-${fiscalYear}-01`).trim();
          const rawEd = findColumnValue(row, ['Tanggal Kadaluarsa (ED) *', 'Tanggal Kadaluarsa', 'Tanggal Expired', 'Expired Date', 'ED', 'Exp Date']);
          const expiryDate = parseExcelDate(rawEd);
          const rawProd = findColumnValue(row, ['Tanggal Produksi', 'Production Date', 'Tgl Produksi']);
          const productionDate = parseExcelDate(rawProd);
          const rawQty = findColumnValue(row, ['Jumlah Saldo Awal *', 'Jumlah Saldo Awal', 'Saldo Awal', 'Jumlah', 'Qty', 'Stock', 'Kuantitas']);
          const initialStock = rawQty !== null && rawQty !== '' ? parseInt(rawQty, 10) : 0;
          const rawPrice = findColumnValue(row, ['Harga Satuan (Rp)', 'Harga Satuan', 'Harga', 'Unit Price', 'Price']);
          const unitPrice = rawPrice ? parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0 : 0;
          const minStock = parseInt(findColumnValue(row, ['Stok Minimum', 'Min Stock', 'Minimum']) || 10, 10) || 10;
          const brand = findColumnValue(row, ['Merek', 'Brand']) || '';
          const manufacturer = findColumnValue(row, ['Pabrik / Produsen', 'Produsen', 'Manufacturer', 'Pabrik']) || '';
          const notes = findColumnValue(row, ['Catatan / Keterangan', 'Catatan', 'Keterangan', 'Notes']) || `Saldo Awal Tahun Anggaran ${fiscalYear} (${budgetSource})`;

          // Validation rules
          const errors = [];
          const warnings = [];

          if (!name.trim()) {
            errors.push('Nama Barang wajib diisi');
          }
          if (isNaN(initialStock) || initialStock < 0) {
            errors.push('Jumlah saldo awal tidak valid (harus angka ≥ 0)');
          }
          if (!fiscalYear) {
            warnings.push('Tahun anggaran default diterapkan');
          }
          if (!budgetSource) {
            warnings.push('Sumber anggaran default diterapkan');
          }
          if (!batchNo) {
            warnings.push('Nomor batch otomatis digenerate');
          }
          if (!expiryDate) {
            warnings.push('Tanggal kedaluwarsa belum ditentukan');
          }

          let status = 'valid';
          if (errors.length > 0) {
            status = 'error';
          } else if (warnings.length > 0) {
            status = 'warning';
          }

          return {
            rowNumber: idx + 1,
            name: name.trim(),
            code: code.trim(),
            barcode: barcode.trim(),
            category,
            item_type: itemType,
            specification,
            unit_label: unitLabel,
            packaging_label: packagingLabel,
            contents_per_package: contentsPerPackage,
            storage_location: storageLocation,
            account_code: accountCode,
            fiscal_year: fiscalYear,
            budget_source: budgetSource,
            batch_no: batchNo,
            expiry_date: expiryDate,
            production_date: productionDate,
            initial_stock: isNaN(initialStock) ? 0 : initialStock,
            unit_price: unitPrice,
            min_stock: minStock,
            brand,
            manufacturer,
            notes,
            status,
            errors,
            warnings,
          };
        });

        setParsedRows(processed);
        toast.success(`${processed.length} baris data berhasil dibaca dari Excel!`);
      } catch (err) {
        toast.error('Gagal membaca file Excel: ' + getErrorMessage(err));
        setParsedRows([]);
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
        toast.error('Harap pilih file Excel berformat .xlsx, .xls, atau .csv');
        return;
      }
      setFile(droppedFile);
      parseExcel(droppedFile);
    }
  };

  // Filtered rows for preview table
  const filteredRows = useMemo(() => {
    return parsedRows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchFilter) {
        const query = searchFilter.toLowerCase();
        return (
          r.name.toLowerCase().includes(query) ||
          r.code.toLowerCase().includes(query) ||
          r.batch_no.toLowerCase().includes(query) ||
          r.fiscal_year.includes(query) ||
          r.budget_source.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [parsedRows, statusFilter, searchFilter]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const valid = parsedRows.filter((r) => r.status === 'valid').length;
    const warning = parsedRows.filter((r) => r.status === 'warning').length;
    const error = parsedRows.filter((r) => r.status === 'error').length;
    const totalStock = parsedRows
      .filter((r) => r.status !== 'error')
      .reduce((sum, r) => sum + (r.initial_stock || 0), 0);
    return { total, valid, warning, error, totalStock };
  }, [parsedRows]);

  // Submit bulk import
  const handleImportSubmit = async () => {
    const validRows = parsedRows.filter((r) => r.status !== 'error');
    if (validRows.length === 0) {
      toast.error('Tidak ada baris data valid yang dapat diimport.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        items: validRows,
        default_fiscal_year: defaultFiscalYear,
        default_budget_source: defaultBudgetSource,
        duplicate_strategy: duplicateStrategy,
      };

      const res = await api.post(API_ENDPOINTS.BMHP_ITEMS.BULK_IMPORT, payload);
      const data = res.data;

      toast.success(
        `Sukses! ${data.data?.imported_count || validRows.length} saldo awal BMHP berhasil diimport ke Sistem Terintegrasi.`,
        { duration: 5000 }
      );

      if (onSuccess) onSuccess(data.data);
      handleClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Terjadi kesalahan saat memproses bulk import'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} size="full" title="Bulk Import Data BMHP Excel (Saldo Awal Persediaan)">
      <div className="flex flex-col h-full space-y-3.5 text-slate-800">
        {/* ========================================================================= */}
        {/* 1. TOP HEADER & QUICK CONTROLS BAR                                        */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-900 via-indigo-900 to-[#002D85] p-3.5 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white shadow-2xs">
                <FileSpreadsheet size={16} />
              </span>
              <h2 className="text-sm font-black uppercase tracking-wide text-white">
                Bulk Import Data Persediaan BMHP
              </h2>
              <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-black text-emerald-200">
                Multi-Tahun Anggaran
              </span>
            </div>
            <p className="text-[11px] text-blue-200/90 leading-relaxed max-w-2xl">
              Import ribuan data saldo awal BMHP sekaligus. Otomatis dipetakan berdasarkan Tahun Anggaran dinamis, Sumber Anggaran, Batch/Lot, dan ED ke Stok Keseluruhan & Kartu Stok.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300/40 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition shadow-2xs"
            >
              <Download size={14} className="text-amber-300" />
              <span>Unduh Format Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3.5 py-1.5 text-xs font-extrabold text-blue-950 hover:from-amber-300 hover:to-amber-400 transition shadow-sm"
            >
              <UploadCloud size={14} />
              <span>{file ? 'Ganti File Excel' : 'Pilih File Excel'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CONFIGURATION STRATEGY & DEFAULT FALLBACKS                             */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-xs">
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
              Tahun Anggaran Default (Dinamis)
            </label>
            <div className="flex items-center gap-1">
              <select
                value={defaultFiscalYear}
                onChange={(e) => setDefaultFiscalYear(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {fiscalYearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Custom..."
                value={defaultFiscalYear}
                onChange={(e) => setDefaultFiscalYear(e.target.value)}
                className="w-20 rounded-lg border border-slate-300 bg-white py-1.5 px-1.5 text-xs font-mono font-bold text-blue-900"
                title="Bisa ketik tahun bebas (misal 2027, 2028)"
              />
            </div>
            <span className="text-[9px] text-slate-400 mt-0.5 block">Digunakan jika kolom tahun di baris kosong</span>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
              Sumber Anggaran Default
            </label>
            <select
              value={defaultBudgetSource}
              onChange={(e) => setDefaultBudgetSource(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="BLUD">BLUD (Badan Layanan Umum Daerah)</option>
              <option value="APBD">APBD (Anggaran Pendapatan & Belanja Daerah)</option>
              <option value="DAK">DAK (Dana Alokasi Khusus)</option>
              <option value="BOK">BOK (Bantuan Operasional Kesehatan)</option>
              <option value="HIBAH">HIBAH / Bantuan</option>
            </select>
            <span className="text-[9px] text-slate-400 mt-0.5 block">Digunakan jika kolom sumber di baris kosong</span>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
              Pencegahan Duplikasi & Double Counting
            </label>
            <select
              value={duplicateStrategy}
              onChange={(e) => setDuplicateStrategy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="skip">Lewati Duplikat (Rekomendasi - Cegah Double Count)</option>
              <option value="update">Perbarui Saldo Awal (Ganti dengan Kuantitas Baru)</option>
              <option value="add">Tambahkan ke Stok yang Ada (Akumulasi)</option>
            </select>
            <span className="text-[9px] text-slate-400 mt-0.5 block">Kunci: Barang + Tahun + Sumber + Batch/Lot</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. UPLOAD DROPZONE (JIKA BELUM PILIH FILE ATAU MAU DRAG & DROP)           */}
        {/* ========================================================================= */}
        {parsedRows.length === 0 ? (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 p-8 text-center hover:bg-blue-50/70 hover:border-blue-500 transition cursor-pointer my-2"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm text-blue-600 mb-3 border border-blue-200">
              <UploadCloud size={30} />
            </div>
            <h3 className="text-sm font-black text-slate-800">
              Seret & Letakkan File Excel di sini, atau Klik untuk Memilih
            </h3>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Mendukung format <strong className="text-blue-700">.xlsx, .xls, .csv</strong>. Pastikan file menggunakan kolom standar atau unduh template resmi di atas.
            </p>
          </div>
        ) : (
          <>
            {/* ======================================================================= */}
            {/* 4. SUMMARY STATISTICS BAR & LIVE FILTER                                 */}
            {/* ======================================================================= */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white p-2 text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Baris</span>
                <span className="text-base font-black text-slate-800">{formatNumber(stats.total)}</span>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2 text-center shadow-2xs">
                <span className="text-[10px] font-extrabold text-emerald-700 uppercase block">Siap Diimport</span>
                <span className="text-base font-black text-emerald-700">{formatNumber(stats.valid)}</span>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-2 text-center shadow-2xs">
                <span className="text-[10px] font-extrabold text-amber-700 uppercase block">Peringatan</span>
                <span className="text-base font-black text-amber-700">{formatNumber(stats.warning)}</span>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-2 text-center shadow-2xs">
                <span className="text-[10px] font-extrabold text-rose-700 uppercase block">Eror (Dilewati)</span>
                <span className="text-base font-black text-rose-700">{formatNumber(stats.error)}</span>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2 text-center shadow-2xs">
                <span className="text-[10px] font-extrabold text-blue-700 uppercase block">Total Saldo Awal</span>
                <span className="text-base font-black text-blue-800">{formatNumber(stats.totalStock)}</span>
              </div>
            </div>

            {/* Live Filter Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama, kode, batch..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <span className="text-[10px] font-bold text-slate-500">Tampilkan:</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`rounded-md px-2 py-1 transition ${statusFilter === 'all' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Semua ({stats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('valid')}
                    className={`rounded-md px-2 py-1 transition ${statusFilter === 'valid' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Valid ({stats.valid})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('warning')}
                    className={`rounded-md px-2 py-1 transition ${statusFilter === 'warning' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Peringatan ({stats.warning})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('error')}
                    className={`rounded-md px-2 py-1 transition ${statusFilter === 'error' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Eror ({stats.error})
                  </button>
                </div>
              </div>
            </div>

            {/* ======================================================================= */}
            {/* 5. PREVIEW VALIDATION TABLE                                             */}
            {/* ======================================================================= */}
            <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xs max-h-[360px]">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-100 to-blue-50/50 text-[10px] font-black uppercase tracking-wider text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2.5 text-center w-10">No</th>
                    <th className="py-2 px-2.5 w-24">Status</th>
                    <th className="py-2 px-2.5 min-w-[200px]">Nama Barang & Spesifikasi</th>
                    <th className="py-2 px-2.5 w-24">Kategori</th>
                    <th className="py-2 px-2.5 w-20">Satuan</th>
                    <th className="py-2 px-2.5 w-20 text-center">Thn Anggaran</th>
                    <th className="py-2 px-2.5 w-20 text-center">Sumber</th>
                    <th className="py-2 px-2.5 w-28">Batch / Lot</th>
                    <th className="py-2 px-2.5 w-24">ED</th>
                    <th className="py-2 px-2.5 text-right w-24">Saldo Awal</th>
                    <th className="py-2 px-2.5 text-right w-24">Harga (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400 italic">
                        Tidak ada baris data yang cocok dengan filter
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`hover:bg-blue-50/40 transition ${row.status === 'error' ? 'bg-rose-50/30' : row.status === 'warning' ? 'bg-amber-50/20' : ''}`}
                      >
                        <td className="py-1.5 px-2.5 text-center font-mono text-[10px] text-slate-500">
                          {row.rowNumber}
                        </td>
                        <td className="py-1.5 px-2.5">
                          {row.status === 'valid' && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[9px] font-bold">
                              <CheckCircle2 size={10} /> Valid
                            </span>
                          )}
                          {row.status === 'warning' && (
                            <span
                              className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-bold"
                              title={row.warnings.join(', ')}
                            >
                              <AlertTriangle size={10} /> Peringatan
                            </span>
                          )}
                          {row.status === 'error' && (
                            <span
                              className="inline-flex items-center gap-1 rounded bg-rose-100 text-rose-800 px-1.5 py-0.5 text-[9px] font-bold"
                              title={row.errors.join(', ')}
                            >
                              <AlertCircle size={10} /> Eror
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <div className="font-bold text-slate-900 leading-tight">{row.name}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">
                            {row.code && <span className="font-mono text-blue-900 font-bold mr-1">[{row.code}]</span>}
                            {row.specification || row.item_type || '-'}
                          </div>
                          {row.errors.length > 0 && (
                            <div className="text-[9px] font-bold text-rose-600 mt-0.5">
                              {row.errors.join(' • ')}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-[10px] text-slate-600">
                          {row.category}
                        </td>
                        <td className="py-1.5 px-2.5 text-[10px] font-semibold text-slate-700">
                          {row.unit_label}
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          <span className="rounded bg-blue-100 text-blue-900 px-1.5 py-0.5 text-[10px] font-mono font-bold">
                            {row.fiscal_year}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          <span className="rounded bg-indigo-100 text-indigo-900 px-1.5 py-0.5 text-[10px] font-bold">
                            {row.budget_source}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-700">
                          {row.batch_no}
                        </td>
                        <td className="py-1.5 px-2.5 text-[10px] text-slate-700">
                          {row.expiry_date || <span className="italic text-slate-400">Tanpa ED</span>}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-black text-slate-900">
                          {formatNumber(row.initial_stock)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-[10px] text-slate-600">
                          {row.unit_price ? `Rp ${formatNumber(row.unit_price)}` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* 6. MODAL ACTIONS & SUBMISSION FOOTER                                      */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 ? (
              <span>
                File: <strong className="text-slate-800">{file?.name}</strong> • Siap import{' '}
                <strong className="text-emerald-700">{formatNumber(stats.valid + stats.warning)}</strong> baris ke transaksi{' '}
                <code className="text-blue-900 font-bold bg-blue-50 px-1 rounded">SALDO_AWAL</code>.
              </span>
            ) : (
              <span>Silakan pilih file Excel untuk melihat preview dan validasi.</span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleImportSubmit}
              disabled={loading || parsedRows.length === 0 || (stats.valid === 0 && stats.warning === 0)}
              loading={loading}
              icon={FileCheck}
            >
              <span>Import {formatNumber(stats.valid + stats.warning)} Data Saldo Awal</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
