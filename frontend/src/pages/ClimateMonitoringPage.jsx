import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  Filter,
  PlusCircle,
  Printer,
  RefreshCw,
  Search,
  Thermometer,
  User,
  X,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { api } from '@/utils/api';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, todayISO, wibDateTimeNow } from '@/utils/format';
import { getErrorMessage } from '@/utils/request';
import { useAuth } from '@/context/AuthContext';

const ROOM_OPTIONS = [
  'Ruang Penyimpanan Alat Steril',
  'Ruang Pengemasan & Perakitan',
  'Ruang Dekontaminasi / Cuci',
  'Ruang Sterilisasi (Mesin)',
];

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function ClimateMonitoringPage() {
  const { user } = useAuth();
  const currentDate = new Date();
  const [selectedRoom, setSelectedRoom] = useState('Ruang Penyimpanan Alat Steril');
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [loading, setLoading] = useState(true);
  const [dataPayload, setDataPayload] = useState({
    matrix: [],
    raw_logs: [],
    stats: {},
    standards: { temp_min: 18.0, temp_max: 22.0, humidity_min: 35.0, humidity_max: 55.0 },
  });

  const [activeTab, setActiveTab] = useState('CHARTS'); // 'CHARTS' | 'MATRIX' | 'LOGS'
  const [showInputModal, setShowInputModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form input state
  const [formData, setFormData] = useState({
    room_name: 'Ruang Penyimpanan Alat Steril',
    check_date: todayISO(),
    check_time: wibDateTimeNow().slice(11, 19),
    temperature: '20.0',
    humidity: '45.0',
    officer: user?.name || 'Petugas CSSD',
    notes: '',
    corrective_action: '',
  });

  const fetchMonthlyData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.CLIMATE_MONITORING.MONTHLY, {
        params: {
          room_name: selectedRoom,
          month: selectedMonth,
          year: selectedYear,
        },
      });
      if (res.data?.success && res.data?.data) {
        setDataPayload(res.data.data);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memuat data monitoring suhu & kelembaban'));
    } finally {
      setLoading(false);
    }
  }, [selectedRoom, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData]);

  // Live validation status in modal
  const liveTemp = parseFloat(formData.temperature);
  const liveHum = parseFloat(formData.humidity);
  const isTempNormal = !isNaN(liveTemp) && liveTemp >= 18.0 && liveTemp <= 22.0;
  const isHumNormal = !isNaN(liveHum) && liveHum >= 35.0 && liveHum <= 55.0;

  const handleOpenInputModal = () => {
    setFormData({
      room_name: selectedRoom,
      check_date: todayISO(),
      check_time: wibDateTimeNow().slice(11, 19),
      temperature: '20.0',
      humidity: '45.0',
      officer: user?.name || 'Petugas CSSD',
      notes: '',
      corrective_action: '',
    });
    setShowInputModal(true);
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!formData.temperature || isNaN(parseFloat(formData.temperature))) {
      toast.error('Masukkan nilai suhu ruangan yang valid');
      return;
    }
    if (!formData.humidity || isNaN(parseFloat(formData.humidity))) {
      toast.error('Masukkan nilai kelembaban udara yang valid');
      return;
    }
    if (!formData.officer?.trim()) {
      toast.error('Nama petugas pemeriksa wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(API_ENDPOINTS.CLIMATE_MONITORING.LIST, {
        ...formData,
        temperature: parseFloat(formData.temperature),
        humidity: parseFloat(formData.humidity),
      });
      toast.success('Hasil pengukuran suhu & kelembaban berhasil dicatat!');
      setShowInputModal(false);
      fetchMonthlyData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyimpan hasil pengukuran'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintOfficialForm = () => {
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) {
      toast.error('Pop-up diblokir oleh browser. Izinkan pop-up untuk mencetak formulir resmi.');
      return;
    }

    const daysCount = dataPayload.days_in_month || 31;
    const daysArr = Array.from({ length: 31 }, (_, i) => i + 1);

    // Siapkan baris suhu dari 35°C turun ke 16°C
    const tempRows = [];
    for (let t = 35; t >= 16; t--) {
      tempRows.push(t);
    }

    // Siapkan baris kelembaban dari 100% turun ke 20% (kelipatan 5%)
    const humRows = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20];

    const monthTitle = `${MONTH_NAMES[selectedMonth - 1].toUpperCase()} ${selectedYear}`;

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>FORMULIR PEMANTAUAN SUHU DAN KELEMBABAN UDARA - ${selectedRoom}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5px; color: #000; margin: 0; padding: 12px; }
            .header-text { text-align: center; font-weight: bold; font-size: 13px; margin-bottom: 12px; line-height: 1.3; }
            .meta-table { width: 100%; margin-bottom: 8px; font-size: 10px; font-weight: bold; border-collapse: collapse; }
            .meta-table td { padding: 2px 0; }
            .grid-table { width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 12px; table-layout: fixed; }
            .grid-table th, .grid-table td { border: 1px solid #000; padding: 2px 1px; height: 13px; font-size: 8px; }
            .grid-table th { background-color: #f2f2f2; font-weight: bold; }
            .safe-temp { background-color: #e6f4ea !important; }
            .safe-hum { background-color: #e6f4ea !important; }
            .marked { font-weight: bold; font-size: 9px; color: #000; }
            .warning-mark { color: #d93025; font-weight: bold; }
            .sig-table { width: 100%; margin-top: 18px; text-align: center; font-size: 10px; border-collapse: collapse; }
            .sig-table td { width: 50%; padding-bottom: 50px; }
            .footer-info { font-size: 8px; color: #555; margin-top: 10px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header-text">
            FORMULIR PEMANTAUAN SUHU DAN KELEMBABAN UDARA<br/>
            RSUD SERPONG UTARA
          </div>

          <table class="meta-table">
            <tr>
              <td style="width: 80px;">RUANG</td>
              <td>: ${selectedRoom.toUpperCase()}</td>
            </tr>
            <tr>
              <td>BULAN</td>
              <td>: ${monthTitle}</td>
            </tr>
          </table>

          <!-- TABEL PEMANTAUAN SUHU (16°C - 35°C) -->
          <table class="grid-table">
            <thead>
              <tr>
                <th style="width: 48px;">SUHU</th>
                ${daysArr.map((d) => `<th style="${d > daysCount ? 'color: #999;' : ''}">${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tempRows.map((tempDeg) => {
                const isSafe = tempDeg >= 18 && tempDeg <= 22;
                return `
                  <tr class="${isSafe ? 'safe-temp' : ''}">
                    <td style="font-weight: bold; text-align: left; padding-left: 3px;">${tempDeg}°C</td>
                    ${daysArr.map((d) => {
                      if (d > daysCount) return '<td style="background: #fafafa;"></td>';
                      const cell = dataPayload.matrix?.find((m) => m.day === d);
                      const roundedVal = cell?.temperature !== null ? Math.round(cell.temperature) : null;
                      const hasMark = roundedVal === tempDeg;
                      const isWarn = hasMark && (tempDeg < 18 || tempDeg > 22);
                      return `<td>${hasMark ? `<span class="${isWarn ? 'warning-mark' : 'marked'}">●</span>` : ''}</td>`;
                    }).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- TABEL PEMANTAUAN KELEMBABAN (20% - 100%) -->
          <table class="grid-table">
            <thead>
              <tr>
                <th style="width: 48px;">KELEMBABAN</th>
                ${daysArr.map((d) => `<th style="${d > daysCount ? 'color: #999;' : ''}">${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${humRows.map((humPct) => {
                const isSafe = humPct >= 35 && humPct <= 55;
                return `
                  <tr class="${isSafe ? 'safe-hum' : ''}">
                    <td style="font-weight: bold; text-align: left; padding-left: 3px;">${humPct}%</td>
                    ${daysArr.map((d) => {
                      if (d > daysCount) return '<td style="background: #fafafa;"></td>';
                      const cell = dataPayload.matrix?.find((m) => m.day === d);
                      if (!cell || cell.humidity === null) return '<td></td>';
                      // Rounding to nearest step of 5%
                      const roundedVal = Math.round(cell.humidity / 5) * 5;
                      const hasMark = roundedVal === humPct;
                      const isWarn = hasMark && (humPct < 35 || humPct > 55);
                      return `<td>${hasMark ? `<span class="${isWarn ? 'warning-mark' : 'marked'}">●</span>` : ''}</td>`;
                    }).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <table class="sig-table">
            <tr>
              <td>
                Mengetahui,<br/>
                <b>Penanggung Jawab Pengelolaan Udara</b><br/><br/><br/><br/>
                ( ............................................................ )
              </td>
              <td>
                <b>Penanggung Jawab Ruangan</b><br/><br/><br/><br/><br/>
                ( ............................................................ )
              </td>
            </tr>
          </table>

          <div class="footer-info">
            Dicetak otomatis dari Sistem CSSD SMART RSUD Serpong Utara • Standar Suhu: 18–22°C • Kelembaban: 35–55% RH
          </div>

          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  // Helper data grafik garis SVG responsif
  const daysInMonth = dataPayload.days_in_month || 31;
  const matrix = dataPayload.matrix || [];

  // SVG Chart: Suhu (Y: 16°C s.d. 35°C)
  const tempChartWidth = 750;
  const tempChartHeight = 220;
  const tempMinY = 15;
  const tempMaxY = 35;
  const getTempY = (val) => {
    if (val === null || val === undefined) return null;
    return tempChartHeight - 25 - ((val - tempMinY) / (tempMaxY - tempMinY)) * (tempChartHeight - 45);
  };
  const getDayX = (day) => {
    return 45 + ((day - 1) / (daysInMonth - 1 || 1)) * (tempChartWidth - 65);
  };

  // Titik suhu yang valid
  const tempPoints = matrix
    .filter((m) => m.is_valid_day && m.temperature !== null)
    .map((m) => ({ day: m.day, x: getDayX(m.day), y: getTempY(m.temperature), val: m.temperature, isNormal: m.temp_status === 'NORMAL' }));

  const tempLinePath = tempPoints.length > 0
    ? tempPoints.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')
    : '';

  // SVG Chart: Kelembaban (Y: 20% s.d. 100%)
  const humMinY = 20;
  const humMaxY = 100;
  const getHumY = (val) => {
    if (val === null || val === undefined) return null;
    return tempChartHeight - 25 - ((val - humMinY) / (humMaxY - humMinY)) * (tempChartHeight - 45);
  };
  const humPoints = matrix
    .filter((m) => m.is_valid_day && m.humidity !== null)
    .map((m) => ({ day: m.day, x: getDayX(m.day), y: getHumY(m.humidity), val: m.humidity, isNormal: m.humidity_status === 'NORMAL' }));

  const humLinePath = humPoints.length > 0
    ? humPoints.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')
    : '';

  return (
    <div className="space-y-4 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#002D85] to-blue-600 text-white shadow-sm">
            <Thermometer size={24} className="text-amber-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Monitoring Suhu & Kelembaban
              </h1>
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">
                Standar RSUD Serpong Utara
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Ruang Penyimpanan Alat Steril • Standar Suhu: <strong>18–22°C</strong> • Kelembaban: <strong>35–55% RH</strong> (Warning Otomatis).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchMonthlyData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Muat Ulang</span>
          </Button>

          <Button variant="secondary" size="sm" onClick={handlePrintOfficialForm}>
            <Printer size={14} />
            <span>Cetak Formulir Resmi (PDF)</span>
          </Button>

          <Button size="sm" onClick={handleOpenInputModal}>
            <PlusCircle size={15} />
            <span>Catat Pengukuran Harian</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar (Ruangan, Bulan, Tahun) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Lokasi Ruangan
          </label>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="input-base text-xs font-bold"
          >
            {ROOM_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Bulan Pemeriksaan
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="input-base text-xs font-bold"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Tahun
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input-base text-xs font-bold"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Suhu Rata-rata */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Suhu Rata-rata</span>
            <Thermometer size={18} className="text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {dataPayload.stats?.avg_temp ? `${dataPayload.stats.avg_temp}°C` : '-'}
            </span>
            <span className="text-xs text-slate-400">
              {dataPayload.stats?.min_temp ? `(${dataPayload.stats.min_temp} - ${dataPayload.stats.max_temp}°C)` : ''}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              <CheckCircle2 size={12} /> Standar: 18–22°C
            </span>
          </div>
        </div>

        {/* Card 2: Kelembaban Rata-rata */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Kelembaban Rata-rata</span>
            <Droplets size={18} className="text-cyan-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {dataPayload.stats?.avg_humidity ? `${dataPayload.stats.avg_humidity}%` : '-'}
            </span>
            <span className="text-xs text-slate-400">
              {dataPayload.stats?.min_humidity ? `(${dataPayload.stats.min_humidity} - ${dataPayload.stats.max_humidity}%)` : ''}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              <CheckCircle2 size={12} /> Standar: 35–55% RH
            </span>
          </div>
        </div>

        {/* Card 3: Total Pengukuran */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Pengukuran Harian</span>
            <Calendar size={18} className="text-slate-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {dataPayload.stats?.total_checks || 0}
            </span>
            <span className="text-xs text-slate-400">dari {daysInMonth} hari</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Pencatatan manual 1x atau 2x per hari
          </p>
        </div>

        {/* Card 4: Total Peringatan / Warning */}
        <div className={`rounded-2xl border p-4 shadow-xs ${
          (dataPayload.stats?.total_warnings || 0) > 0
            ? 'border-rose-200 bg-rose-50/50'
            : 'border-slate-200 bg-white'
        }`}>
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Status Peringatan (Warning)</span>
            <AlertTriangle size={18} className={(dataPayload.stats?.total_warnings || 0) > 0 ? 'text-rose-600' : 'text-slate-400'} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${
              (dataPayload.stats?.total_warnings || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}>
              {dataPayload.stats?.total_warnings || 0}
            </span>
            <span className="text-xs text-slate-500">hari di luar batas</span>
          </div>
          <p className="mt-2 text-[11px] font-bold">
            {(dataPayload.stats?.total_warnings || 0) > 0 ? (
              <span className="text-rose-700">⚠️ Ada nilai suhu / RH tidak normal!</span>
            ) : (
              <span className="text-emerald-700">✓ Seluruh kondisi ruang terkontrol aman</span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs Switcher: Grafik Bulanan / Formulir Matriks 1-31 / Log Riwayat */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('CHARTS')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'CHARTS'
              ? 'bg-brand-700 text-white shadow-xs'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          1. Grafik Garis Suhu & Kelembaban (Tanggal 1–31)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('MATRIX')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'MATRIX'
              ? 'bg-brand-700 text-white shadow-xs'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          2. Formulir Matriks Harian (Standar RSUD)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('LOGS')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'LOGS'
              ? 'bg-brand-700 text-white shadow-xs'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          3. Log Riwayat Pengukuran ({dataPayload.raw_logs?.length || 0})
        </button>
      </div>

      {/* TAB 1: DUA GRAFIK GARIS (SUHU & KELEMBABAN) */}
      {activeTab === 'CHARTS' && (
        <div className="space-y-4">
          {/* Grafik 1: Suhu Ruangan (°C) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Thermometer size={16} className="text-blue-600" />
                  Grafik Pemantauan Suhu Ruangan (°C) — Bulan {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </h3>
                <p className="text-xs text-slate-500">
                  Rentang aman: <strong>18°C – 22°C</strong> (Area hijau). Titik merah menandakan WARNING.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-semibold text-emerald-800">
                  <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" /> Normal (18–22°C)
                </span>
                <span className="flex items-center gap-1 font-semibold text-rose-700">
                  <span className="inline-block h-3 w-3 rounded-full bg-rose-500" /> Warning (&lt;18 / &gt;22°C)
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <svg viewBox={`0 0 ${tempChartWidth} ${tempChartHeight}`} className="w-full min-w-[650px] overflow-visible">
                {/* Area hijau batas aman suhu 18 - 22°C */}
                <rect
                  x="45"
                  y={getTempY(22)}
                  width={tempChartWidth - 65}
                  height={getTempY(18) - getTempY(22)}
                  fill="#d1fae5"
                  opacity="0.6"
                />
                <line x1="45" y1={getTempY(22)} x2={tempChartWidth - 20} y2={getTempY(22)} stroke="#059669" strokeDasharray="3 3" strokeWidth="1" />
                <line x1="45" y1={getTempY(18)} x2={tempChartWidth - 20} y2={getTempY(18)} stroke="#059669" strokeDasharray="3 3" strokeWidth="1" />
                <text x="40" y={getTempY(22) + 3} textAnchor="end" fontSize="9" fill="#059669" fontWeight="bold">22°C</text>
                <text x="40" y={getTempY(18) + 3} textAnchor="end" fontSize="9" fill="#059669" fontWeight="bold">18°C</text>

                {/* Grid lines horizontal */}
                {[16, 25, 30, 35].map((val) => (
                  <g key={val}>
                    <line x1="45" y1={getTempY(val)} x2={tempChartWidth - 20} y2={getTempY(val)} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="40" y={getTempY(val) + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{val}°C</text>
                  </g>
                ))}

                {/* Grid lines vertical tanggal 1..31 */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <g key={d}>
                    <line x1={getDayX(d)} y1={20} x2={getDayX(d)} y2={tempChartHeight - 25} stroke="#f8fafc" strokeWidth="1" />
                    <text x={getDayX(d)} y={tempChartHeight - 10} textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="600">{d}</text>
                  </g>
                ))}

                {/* Garis penghubung titik suhu */}
                {tempLinePath && (
                  <path d={tempLinePath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* Titik-titik suhu harian */}
                {tempPoints.map((pt) => (
                  <g key={pt.day} className="cursor-pointer">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.isNormal ? 4 : 5}
                      fill={pt.isNormal ? '#10b981' : '#ef4444'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 7}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="bold"
                      fill={pt.isNormal ? '#065f46' : '#b91c1c'}
                    >
                      {pt.val}°C
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Grafik 2: Kelembaban Udara (%RH) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Droplets size={16} className="text-cyan-600" />
                  Grafik Pemantauan Kelembaban Udara (%RH) — Bulan {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </h3>
                <p className="text-xs text-slate-500">
                  Rentang aman: <strong>35% – 55% RH</strong> (Area hijau). Titik merah menandakan WARNING.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-semibold text-emerald-800">
                  <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" /> Normal (35–55% RH)
                </span>
                <span className="flex items-center gap-1 font-semibold text-rose-700">
                  <span className="inline-block h-3 w-3 rounded-full bg-rose-500" /> Warning (&lt;35 / &gt;55%)
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <svg viewBox={`0 0 ${tempChartWidth} ${tempChartHeight}`} className="w-full min-w-[650px] overflow-visible">
                {/* Area hijau batas aman kelembaban 35 - 55% RH */}
                <rect
                  x="45"
                  y={getHumY(55)}
                  width={tempChartWidth - 65}
                  height={getHumY(35) - getHumY(55)}
                  fill="#d1fae5"
                  opacity="0.6"
                />
                <line x1="45" y1={getHumY(55)} x2={tempChartWidth - 20} y2={getHumY(55)} stroke="#059669" strokeDasharray="3 3" strokeWidth="1" />
                <line x1="45" y1={getHumY(35)} x2={tempChartWidth - 20} y2={getHumY(35)} stroke="#059669" strokeDasharray="3 3" strokeWidth="1" />
                <text x="40" y={getHumY(55) + 3} textAnchor="end" fontSize="9" fill="#059669" fontWeight="bold">55%</text>
                <text x="40" y={getHumY(35) + 3} textAnchor="end" fontSize="9" fill="#059669" fontWeight="bold">35%</text>

                {/* Grid lines horizontal */}
                {[20, 70, 85, 100].map((val) => (
                  <g key={val}>
                    <line x1="45" y1={getHumY(val)} x2={tempChartWidth - 20} y2={getHumY(val)} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="40" y={getHumY(val) + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{val}%</text>
                  </g>
                ))}

                {/* Grid lines vertical tanggal 1..31 */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <g key={d}>
                    <line x1={getDayX(d)} y1={20} x2={getDayX(d)} y2={tempChartHeight - 25} stroke="#f8fafc" strokeWidth="1" />
                    <text x={getDayX(d)} y={tempChartHeight - 10} textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="600">{d}</text>
                  </g>
                ))}

                {/* Garis penghubung titik kelembaban */}
                {humLinePath && (
                  <path d={humLinePath} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* Titik-titik kelembaban harian */}
                {humPoints.map((pt) => (
                  <g key={pt.day} className="cursor-pointer">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.isNormal ? 4 : 5}
                      fill={pt.isNormal ? '#10b981' : '#ef4444'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 7}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="bold"
                      fill={pt.isNormal ? '#065f46' : '#b91c1c'}
                    >
                      {pt.val}%
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MATRIKS TABEL HARIAN (TANGGAL 1 - 31) */}
      {activeTab === 'MATRIX' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Formulir Matriks Pemantauan Harian (Tanggal 1–31)
              </h3>
              <p className="text-xs text-slate-500">
                Sesuai formulir cetak RSUD Serpong Utara. Tanda titik (●) otomatis terplot pada nilai suhu dan kelembaban hari terkait.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={handlePrintOfficialForm}>
              <Printer size={13} />
              <span>Cetak Versi Formulir Cetak</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-[11px] border-collapse border border-slate-300">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="border border-slate-300 px-2 py-1.5 w-16 text-left">SUHU</th>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <th key={d} className={`border border-slate-300 px-1 py-1.5 w-7 ${d > daysInMonth ? 'text-slate-300 bg-slate-50' : ''}`}>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16].map((deg) => {
                  const isSafe = deg >= 18 && deg <= 22;
                  return (
                    <tr key={deg} className={isSafe ? 'bg-emerald-50/70 hover:bg-emerald-100/50' : 'hover:bg-slate-50'}>
                      <td className="border border-slate-300 px-2 py-0.5 text-left font-bold text-slate-800">
                        {deg}°C
                      </td>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                        if (d > daysInMonth) return <td key={d} className="border border-slate-300 bg-slate-100/50" />;
                        const cell = matrix.find((m) => m.day === d);
                        const rounded = cell?.temperature !== null ? Math.round(cell.temperature) : null;
                        const match = rounded === deg;
                        const isWarn = match && (deg < 18 || deg > 22);
                        return (
                          <td key={d} className="border border-slate-300 px-0.5 py-0.5">
                            {match && (
                              <span className={`inline-block font-black text-xs ${isWarn ? 'text-rose-600' : 'text-emerald-800'}`}>
                                ●
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-center text-[11px] border-collapse border border-slate-300">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="border border-slate-300 px-2 py-1.5 w-16 text-left">KELEMBABAN</th>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <th key={d} className={`border border-slate-300 px-1 py-1.5 w-7 ${d > daysInMonth ? 'text-slate-300 bg-slate-50' : ''}`}>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20].map((pct) => {
                  const isSafe = pct >= 35 && pct <= 55;
                  return (
                    <tr key={pct} className={isSafe ? 'bg-emerald-50/70 hover:bg-emerald-100/50' : 'hover:bg-slate-50'}>
                      <td className="border border-slate-300 px-2 py-0.5 text-left font-bold text-slate-800">
                        {pct}%
                      </td>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                        if (d > daysInMonth) return <td key={d} className="border border-slate-300 bg-slate-100/50" />;
                        const cell = matrix.find((m) => m.day === d);
                        if (!cell || cell.humidity === null) return <td key={d} className="border border-slate-300" />;
                        const rounded = Math.round(cell.humidity / 5) * 5;
                        const match = rounded === pct;
                        const isWarn = match && (pct < 35 || pct > 55);
                        return (
                          <td key={d} className="border border-slate-300 px-0.5 py-0.5">
                            {match && (
                              <span className={`inline-block font-black text-xs ${isWarn ? 'text-rose-600' : 'text-emerald-800'}`}>
                                ●
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LOG RIWAYAT PENGUKURAN */}
      {activeTab === 'LOGS' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Tanggal & Waktu</th>
                  <th className="px-3 py-3">Ruangan</th>
                  <th className="px-3 py-3">Suhu (°C)</th>
                  <th className="px-3 py-3">Kelembaban (%RH)</th>
                  <th className="px-3 py-3">Status Kontrol</th>
                  <th className="px-3 py-3">Petugas</th>
                  <th className="px-4 py-3">Catatan / Tindakan Koreksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataPayload.raw_logs?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Belum ada data pengukuran pada bulan ini. Klik "Catat Pengukuran Harian" untuk memulai.
                    </td>
                  </tr>
                ) : (
                  dataPayload.raw_logs?.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{formatDate(row.check_date)}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{row.check_time} WIB</div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{row.room_name}</td>
                      <td className="px-3 py-3 font-extrabold text-slate-900">
                        {row.temperature}°C
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          row.temp_status === 'NORMAL' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {row.temp_status}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-extrabold text-slate-900">
                        {row.humidity}% RH
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          row.humidity_status === 'NORMAL' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {row.humidity_status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {row.overall_status === 'NORMAL' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                            <CheckCircle2 size={12} /> Normal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                            <AlertTriangle size={12} /> WARNING
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-800 font-medium">{row.officer}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.notes || row.corrective_action || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Input Pengukuran Harian */}
      <Modal
        open={showInputModal}
        onClose={() => setShowInputModal(false)}
        busy={submitting}
        size="md"
        title="Catat Pengukuran Suhu & Kelembaban"
        subtitle="Hasil pengukuran harian ruang penyimpanan alat steril CSSD SMART"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowInputModal(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleSubmitLog} loading={submitting}>
              Simpan Hasil Pengukuran
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmitLog} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Lokasi Ruangan *</label>
            <select
              value={formData.room_name}
              onChange={(e) => setFormData({ ...formData, room_name: e.target.value })}
              className="input-base text-xs font-semibold"
            >
              {ROOM_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tanggal Pemeriksaan *</label>
              <input
                type="date"
                value={formData.check_date}
                onChange={(e) => setFormData({ ...formData, check_date: e.target.value })}
                className="input-base text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Waktu Pemeriksaan *</label>
              <input
                type="time"
                step="1"
                value={formData.check_time}
                onChange={(e) => setFormData({ ...formData, check_time: e.target.value })}
                className="input-base text-xs font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Input Suhu */}
            <div className={`p-3 rounded-xl border ${isTempNormal ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800">Suhu (°C) *</label>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isTempNormal ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                  {isTempNormal ? 'NORMAL (18–22°C)' : 'WARNING!'}
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                placeholder="mis. 20.5"
                className="input-base text-base font-extrabold mt-1.5 bg-white text-slate-900"
                required
              />
              <p className="mt-1 text-[10px] text-slate-500">Standar aman: 18.0 s/d 22.0°C</p>
            </div>

            {/* Input Kelembaban */}
            <div className={`p-3 rounded-xl border ${isHumNormal ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800">Kelembaban (%RH) *</label>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isHumNormal ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                  {isHumNormal ? 'NORMAL (35–55%)' : 'WARNING!'}
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                value={formData.humidity}
                onChange={(e) => setFormData({ ...formData, humidity: e.target.value })}
                placeholder="mis. 45.0"
                className="input-base text-base font-extrabold mt-1.5 bg-white text-slate-900"
                required
              />
              <p className="mt-1 text-[10px] text-slate-500">Standar aman: 35.0 s/d 55.0% RH</p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Petugas Pemeriksa *</label>
            <input
              type="text"
              value={formData.officer}
              onChange={(e) => setFormData({ ...formData, officer: e.target.value })}
              placeholder="Nama petugas pengukur suhu & kelembaban"
              className="input-base text-xs"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan / Tindakan Koreksi</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Catatan kondisi AC, dehumidifier, atau tindakan penyesuaian..."
              className="input-base text-xs"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
