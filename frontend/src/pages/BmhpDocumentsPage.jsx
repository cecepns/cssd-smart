import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FilePlus2, Printer, RefreshCw, Search } from 'lucide-react';
import SubNav from '@/components/ui/SubNav';
import Modal from '@/components/ui/Modal';
import { BMHP_TABS } from '@/config/resources/stock';
import { api } from '@/utils/api';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, formatNumber } from '@/utils/format';
import { getErrorMessage } from '@/utils/request';
import useDebounce from '@/hooks/useDebounce';

const DOC_META = {
  NPB: { title: 'NOTA PERMINTAAN BARANG (NPB)', color: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100' },
  SPB: { title: 'SURAT PERINTAH BARANG (SPB)', color: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' },
  SPPB: { title: 'SURAT PENYERAHAN BARANG (SPPB)', color: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' },
  BAST: { title: 'BERITA ACARA SERAH TERIMA (BAST)', color: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100' },
};

export default function BmhpDocumentsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [budgetSource, setBudgetSource] = useState('Semua');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null); // { row, type: 'NPB'|'SPB'|'SPPB'|'BAST' }

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.BMHP_ITEMS.DOCUMENTS, {
        params: {
          search: debouncedSearch || undefined,
          budget_source: budgetSource !== 'Semua' ? budgetSource : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      });
      setRows(res.data?.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memuat riwayat dokumen BMHP'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, budgetSource, startDate, endDate]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handlePrintDoc = (row, type) => {
    const meta = DOC_META[type];
    const docNo =
      type === 'NPB' ? row.npb_number :
      type === 'SPB' ? row.spb_number :
      type === 'SPPB' ? row.sppb_number : row.bast_number;

    const win = window.open('', '_blank', 'width=1000,height=850');
    if (!win) {
      toast.error('Pop-up diblokir browser. Izinkan pop-up untuk mencetak dokumen.');
      return;
    }

    const tangselLogoUrl = window.location.origin + '/logo-tangerang.png';
    const rsudLogoUrl = window.location.origin + '/logo-rsud-serpong.png';

    const officialKop = `
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #000; padding-bottom: 6px; margin-bottom: 12px; font-family: Arial, sans-serif;">
        <div style="width: 75px; text-align: left;">
          <img src="${tangselLogoUrl}" style="height: 58px; max-width: 70px; object-fit: contain;" alt="Logo Pemkot Tangsel" />
        </div>
        <div style="flex: 1; text-align: center; padding: 0 8px;">
          <h4 style="margin: 0; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; color: #000;">PEMERINTAH KOTA TANGERANG SELATAN</h4>
          <h3 style="margin: 2px 0 0; font-size: 13px; font-weight: bold; color: #000;">DINAS KESEHATAN</h3>
          <h2 style="margin: 2px 0 0; font-size: 15px; font-weight: 900; color: #002D85;">RUMAH SAKIT UMUM DAERAH SERPONG UTARA</h2>
          <p style="margin: 3px 0 0; font-size: 8.5px; color: #333; line-height: 1.3;">
            Jl. Raya Serpong, Kel. Pakulonan, Kec. Serpong Utara, Kota Tangerang Selatan - 15320<br/>
            Telp. 021-59629999, Pos-el rsudserpongutara@tangerangselatankota.go.id, Laman rsudserpongutara.tangerangselatankota.go.id
          </p>
        </div>
        <div style="width: 75px; text-align: right;">
          <img src="${rsudLogoUrl}" style="height: 58px; max-width: 70px; object-fit: contain;" alt="Logo RSUD Serpong Utara" />
        </div>
      </div>
    `;

    if (type === 'SPB') {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>SURAT PERMINTAAN BARANG (SPB) - ${docNo}</title></head>
          <body style="font-family: Arial, sans-serif; padding: 18px 24px; color: #000; font-size: 10px;">
            ${officialKop}
            <div style="text-align: center; margin-bottom: 14px;">
              <h2 style="margin: 0; font-size: 14px; text-decoration: underline; font-weight: bold;">SURAT PERMINTAAN BARANG (SPB)</h2>
              <div style="margin-top: 3px; font-size: 11px;">Nomor : <b>${docNo}</b></div>
            </div>

            <table style="width: 100%; font-size: 10px; margin-bottom: 12px; border-collapse: collapse;">
              <tr><td style="width: 150px; font-weight: bold;">Daftar Permintaan:</td><td></td></tr>
              <tr><td style="padding-left: 12px;">Nomor Transaksi</td><td>: ${row.doc_number || '-'}</td></tr>
              <tr><td style="padding-left: 12px;">Tanggal Transaksi</td><td>: ${formatDate(row.trx_date)} ${row.trx_time || ''} WIB</td></tr>
              <tr><td style="padding-left: 12px;">Pihak Yang Meminta</td><td>: <b>${row.unit_name || 'Instalasi CSSD'}</b></td></tr>
              <tr><td style="padding-left: 12px;">Sumber Anggaran / Tahun</td><td>: ${row.budget_source || 'BLUD'} / ${row.fiscal_year || '2026'}</td></tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: center; margin-bottom: 18px;">
              <thead>
                <tr style="background: #e2e8f0;">
                  <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 25px;">NO</th>
                  <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 85px;">KODE BARANG</th>
                  <th rowspan="2" style="border: 1px solid #000; padding: 4px; text-align: left;">NAMA BARANG</th>
                  <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 50px;">NUSP</th>
                  <th rowspan="2" style="border: 1px solid #000; padding: 4px; text-align: left;">SPESIFIKASI NAMA BARANG</th>
                  <th colspan="2" style="border: 1px solid #000; padding: 3px;">PENGAJUAN PERMINTAAN</th>
                  <th colspan="2" style="border: 1px solid #000; padding: 3px;">INFORMASI SISA PERSEDIAAN</th>
                  <th colspan="2" style="border: 1px solid #000; padding: 3px;">USULAN PERSETUJUAN</th>
                  <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 90px;">KEPERLUAN</th>
                  <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 80px;">KETERANGAN</th>
                </tr>
                <tr style="background: #f1f5f9;">
                  <th style="border: 1px solid #000; padding: 3px; width: 45px;">JUMLAH</th>
                  <th style="border: 1px solid #000; padding: 3px; width: 45px;">SATUAN</th>
                  <th style="border: 1px solid #000; padding: 3px; width: 45px;">JUMLAH</th>
                  <th style="border: 1px solid #000; padding: 3px; width: 45px;">SATUAN</th>
                  <th style="border: 1px solid #000; padding: 3px; width: 45px;">JUMLAH</th>
                  <th style="border: 1px solid #000; padding: 3px; width: 45px;">SATUAN</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #000; padding: 6px;">1</td>
                  <td style="border: 1px solid #000; padding: 6px; font-family: monospace;">${row.item_code || '-'}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: left; font-weight: bold;">${row.item_name}</td>
                  <td style="border: 1px solid #000; padding: 6px;">-</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: left;">${row.specification || row.category || 'BMHP Sterilisasi CSSD'}</td>
                  <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${formatNumber(row.quantity)}</td>
                  <td style="border: 1px solid #000; padding: 6px;">${row.unit_label || 'Pcs'}</td>
                  <td style="border: 1px solid #000; padding: 6px;">${formatNumber(row.stock_after || row.quantity)}</td>
                  <td style="border: 1px solid #000; padding: 6px;">${row.unit_label || 'Pcs'}</td>
                  <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${formatNumber(row.quantity)}</td>
                  <td style="border: 1px solid #000; padding: 6px;">${row.unit_label || 'Pcs'}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: left;">${row.purpose || 'Pelayanan CSSD'}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: left;">Batch: ${row.batch_no || '-'}</td>
                </tr>
                ${Array.from({ length: 9 }).map((_, idx) => `
                  <tr style="height: 18px;">
                    <td style="border: 1px solid #000; padding: 2px;">${idx + 2}</td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <table style="width: 100%; font-size: 10px; margin-top: 24px; text-align: center;">
              <tr>
                <td style="width: 50%;"></td>
                <td style="width: 50%;">
                  <div>Tangerang Selatan, ${formatDate(row.trx_date)}</div>
                  <div style="font-weight: bold; margin-top: 4px;">Pengurus Barang Pembantu</div>
                  <div style="height: 60px;"></div>
                  <div style="font-weight: bold;">( ___________________________ )</div>
                  <div style="font-size: 9px; margin-top: 2px;">NIP. ........................................................</div>
                </td>
              </tr>
            </table>

            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
      win.document.close();
      return;
    }

    if (type === 'BAST') {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>BERITA ACARA SERAH TERIMA (BAST) - ${docNo}</title></head>
          <body style="font-family: Arial, sans-serif; padding: 18px 24px; color: #000; font-size: 10px; line-height: 1.4;">
            ${officialKop}
            <div style="text-align: center; margin-bottom: 12px;">
              <h2 style="margin: 0; font-size: 13px; text-decoration: underline; font-weight: bold;">BERITA ACARA SERAH TERIMA PENYALURAN BARANG PERSEDIAAN</h2>
              <div style="margin-top: 3px; font-size: 11px;">Nomor : <b>${docNo}</b></div>
            </div>

            <p style="margin: 0 0 8px; text-align: justify;">
              Pada hari ini <b>${formatDate(row.trx_date)}</b> bertempat di RSUD Serpong Utara, yang bertanda tangan di bawah ini :
            </p>
            <table style="width: 100%; font-size: 10px; margin-bottom: 6px; margin-left: 8px;">
              <tr><td style="width: 18px; vertical-align: top;"><b>1.</b></td><td style="width: 110px;">Nama</td><td>: ........................................................</td></tr>
              <tr><td></td><td>NIP</td><td>: -</td></tr>
              <tr><td></td><td>Pangkat / Gol</td><td>: -</td></tr>
              <tr><td></td><td colspan="2" style="font-style: italic; color: #333;">Dalam hal ini bertindak sebagai pemberi laporan BMD berupa barang persediaan, selanjutnya sebagai <b>PIHAK PERTAMA</b>.</td></tr>
              <tr><td style="vertical-align: top; padding-top: 4px;"><b>2.</b></td><td style="padding-top: 4px;">Nama</td><td style="padding-top: 4px;">: <b>${row.unit_name || 'Instalasi CSSD'}</b></td></tr>
              <tr><td></td><td>NIP</td><td>: -</td></tr>
              <tr><td></td><td>Pangkat / Gol</td><td>: -</td></tr>
              <tr><td></td><td colspan="2" style="font-style: italic; color: #333;">Dalam hal ini bertindak sebagai Pengurus Barang Pembantu / Unit Penerima RSUD Serpong Utara, selanjutnya sebagai <b>PIHAK KEDUA</b>.</td></tr>
            </table>

            <p style="margin: 6px 0 8px; text-align: justify;">
              <b>PIHAK PERTAMA</b> telah melakukan serah terima laporan BMD, pada <b>PIHAK KEDUA</b> berupa laporan barang Persediaan, dengan rincian sebagai berikut:
            </p>

            <table style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: center; margin-bottom: 12px;">
              <thead>
                <tr style="background: #e2e8f0; font-weight: bold;">
                  <th style="border: 1px solid #000; padding: 4px; width: 25px;">NO</th>
                  <th style="border: 1px solid #000; padding: 4px; width: 85px;">KODE REKENING</th>
                  <th style="border: 1px solid #000; padding: 4px; width: 75px;">KODE BARANG</th>
                  <th style="border: 1px solid #000; padding: 4px; text-align: left;">NAMA BARANG</th>
                  <th style="border: 1px solid #000; padding: 4px; text-align: left;">SPESIFIKASI NAMA BARANG</th>
                  <th style="border: 1px solid #000; padding: 4px; width: 45px;">JUMLAH</th>
                  <th style="border: 1px solid #000; padding: 4px; width: 45px;">SATUAN</th>
                  <th style="border: 1px solid #000; padding: 4px; width: 70px;">HARGA SATUAN</th>
                  <th style="border: 1px solid #000; padding: 4px; width: 80px;">TOTAL HARGA</th>
                  <th style="border: 1px solid #000; padding: 4px; width: 65px;">SUMBER ANGGARAN</th>
                  <th style="border: 1px solid #000; padding: 4px; width: 75px;">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #000; padding: 6px;">1</td>
                  <td style="border: 1px solid #000; padding: 6px;">${row.account_code || '5.1.02.01.01'}</td>
                  <td style="border: 1px solid #000; padding: 6px; font-family: monospace;">${row.item_code || '-'}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: left; font-weight: bold;">${row.item_name}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: left;">${row.specification || row.category || '-'}</td>
                  <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${formatNumber(row.quantity)}</td>
                  <td style="border: 1px solid #000; padding: 6px;">${row.unit_label || 'Pcs'}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: right;">${row.unit_price ? `Rp ${formatNumber(row.unit_price)}` : '-'}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${row.total_price ? `Rp ${formatNumber(row.total_price)}` : '-'}</td>
                  <td style="border: 1px solid #000; padding: 6px;">${row.budget_source || 'BLUD'}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: left;">Batch ${row.batch_no || '-'}</td>
                </tr>
                ${Array.from({ length: 5 }).map((_, idx) => `
                  <tr style="height: 18px;">
                    <td style="border: 1px solid #000; padding: 2px;">${idx + 2}</td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                    <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                  </tr>
                `).join('')}
                <tr style="background: #f8fafc; font-weight: bold;">
                  <td colspan="8" style="border: 1px solid #000; padding: 6px; text-align: right;">TOTAL:</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: right;">${row.total_price ? `Rp ${formatNumber(row.total_price)}` : '-'}</td>
                  <td colspan="2" style="border: 1px solid #000;"></td>
                </tr>
              </tbody>
            </table>

            <p style="margin: 0 0 16px;">
              Berita Acara serah terima ini dibuat sebagai bukti pengeluaran barang: Persediaan.
            </p>

            <table style="width: 100%; font-size: 10px; text-align: center;">
              <tr>
                <td style="width: 50%;">
                  <div style="font-weight: bold;">PIHAK PERTAMA</div>
                  <div style="height: 60px;"></div>
                  <div style="font-weight: bold;">( ___________________________ )</div>
                  <div style="font-size: 9px; margin-top: 2px;">NIP. ........................................................</div>
                </td>
                <td style="width: 50%;">
                  <div style="font-weight: bold;">PIHAK KEDUA</div>
                  <div style="height: 60px;"></div>
                  <div style="font-weight: bold;">( ___________________________ )</div>
                  <div style="font-size: 9px; margin-top: 2px;">NIP. ........................................................</div>
                </td>
              </tr>
            </table>

            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
      win.document.close();
      return;
    }

    // Default template untuk NPB dan SPPB
    win.document.write(`
      <html>
        <head><title>${meta.title} - ${docNo}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a;">
          ${officialKop}
          <div style="text-align: center; margin-bottom: 18px;">
            <h1 style="margin: 0; font-size: 15px; text-decoration: underline; font-weight: bold;">${meta.title}</h1>
            <p style="margin: 4px 0 0; font-size: 12px;">Nomor Dokumen: <b>${docNo}</b></p>
          </div>
          <table style="width: 100%; font-size: 11px; margin-bottom: 16px;">
            <tr><td style="width: 180px;">Tanggal Transaksi</td><td>: <b>${formatDate(row.trx_date)} ${row.trx_time || ''}</b></td></tr>
            <tr><td>Unit Peminta / Penerima</td><td>: <b>${row.unit_name || 'Instalasi CSSD'}</b></td></tr>
            <tr><td>Sumber Anggaran / Tahun</td><td>: <b>${row.budget_source || 'BLUD'} / ${row.fiscal_year || '2026'}</b></td></tr>
            <tr><td>Keperluan / Keterangan</td><td>: ${row.purpose || row.notes || '-'}</td></tr>
          </table>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="border: 1px solid #94a3b8; padding: 8px;">No</th>
                <th style="border: 1px solid #94a3b8; padding: 8px; text-align: left;">Kode & Nama Barang BMHP</th>
                <th style="border: 1px solid #94a3b8; padding: 8px;">Batch / Lot</th>
                <th style="border: 1px solid #94a3b8; padding: 8px;">Kedaluwarsa (ED)</th>
                <th style="border: 1px solid #94a3b8; padding: 8px; text-align: right;">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #94a3b8; padding: 8px; text-align: center;">1</td>
                <td style="border: 1px solid #94a3b8; padding: 8px;"><b>${row.item_name}</b><br/><span style="font-size: 11px; color: #475569;">${row.item_code} • ${row.category}</span></td>
                <td style="border: 1px solid #94a3b8; padding: 8px; text-align: center;">${row.batch_no || '-'}</td>
                <td style="border: 1px solid #94a3b8; padding: 8px; text-align: center;">${row.expiry_date ? formatDate(row.expiry_date) : '-'}</td>
                <td style="border: 1px solid #94a3b8; padding: 8px; text-align: right;"><b>${formatNumber(row.quantity)} ${row.unit_label}</b></td>
              </tr>
            </tbody>
          </table>
          <p style="font-size: 11px; color: #475569; margin-bottom: 32px;">
            Dokumen ini dicetak otomatis dari Sistem Manajemen Persediaan BMHP Terintegrasi CSSD SMART RSUD Serpong Utara.
          </p>
          <table style="width: 100%; text-align: center; font-size: 11px;">
            <tr>
              <td style="width: 50%;">
                <div>Yang Menyerahkan (Petugas CSSD)</div>
                <div style="height: 64px;"></div>
                <div><b>( ___________________________ )</b></div>
                <div style="font-size: 9px; margin-top: 2px;">NIP. ........................................................</div>
              </td>
              <td style="width: 50%;">
                <div>Yang Menerima / Meminta (${row.unit_name || 'Unit'})</div>
                <div style="height: 64px;"></div>
                <div><b>( ___________________________ )</b></div>
                <div style="font-size: 9px; margin-top: 2px;">NIP. ........................................................</div>
              </td>
            </tr>
          </table>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-4 pb-8">
      <SubNav items={BMHP_TABS} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#002D85] to-blue-600 text-amber-300 shadow-sm">
            <FilePlus2 size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Riwayat Dokumen Barang Keluar BMHP
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Terhubung otomatis dengan setiap transaksi Pengambilan BMHP — siap lihat & cetak ulang NPB, SPB, SPPB, dan BAST.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchDocs}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Muat Ulang
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari no dokumen, barang, unit, petugas..."
            className="input-base pl-8 text-xs"
          />
        </div>
        <select
          value={budgetSource}
          onChange={(e) => setBudgetSource(e.target.value)}
          className="input-base text-xs font-semibold"
        >
          <option value="Semua">Semua Anggaran (APBD/BLUD)</option>
          <option value="BLUD">BLUD</option>
          <option value="APBD">APBD</option>
          <option value="DAK">DAK</option>
          <option value="BOK">BOK</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="input-base text-xs"
          title="Tanggal Mulai"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="input-base text-xs"
          title="Tanggal Selesai"
        />
      </div>

      {/* Table Riwayat Dokumen */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">No. Referensi & Tanggal</th>
                <th className="px-3 py-3">Nama Barang & Batch</th>
                <th className="px-3 py-3">Unit Peminta</th>
                <th className="px-3 py-3 text-right">Jumlah</th>
                <th className="px-3 py-3">Petugas</th>
                <th className="px-4 py-3 text-center">Cetak Ulang Dokumen (NPB / SPB / SPPB / BAST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Memuat riwayat dokumen...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">Belum ada dokumen barang keluar BMHP. Input Pengambilan BMHP agar dokumen otomatis terbentuk.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-brand-700">{r.doc_number}</div>
                      <div className="text-[11px] text-slate-500">{formatDate(r.trx_date)} {r.trx_time || ''}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-900">{r.item_name}</div>
                      <div className="text-[10px] text-slate-500">
                        {r.fiscal_year} • {r.budget_source} • Batch {r.batch_no || '-'}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{r.unit_name || 'Instalasi CSSD'}</td>
                    <td className="px-3 py-3 text-right font-extrabold text-slate-900">
                      {formatNumber(r.quantity)} <span className="font-normal text-slate-500">{r.unit_label}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{r.officer}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {['NPB', 'SPB', 'SPPB', 'BAST'].map((docType) => (
                          <button
                            key={docType}
                            type="button"
                            onClick={() => setPreviewDoc({ row: r, type: docType })}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition ${DOC_META[docType].color}`}
                          >
                            <Printer size={11} /> {docType}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Preview Dokumen Sebelum Cetak */}
      <Modal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        size="lg"
        title={previewDoc ? DOC_META[previewDoc.type].title : ''}
        subtitle={
          previewDoc
            ? `Nomor: ${
                previewDoc.type === 'NPB'
                  ? previewDoc.row.npb_number
                  : previewDoc.type === 'SPB'
                  ? previewDoc.row.spb_number
                  : previewDoc.type === 'SPPB'
                  ? previewDoc.row.sppb_number
                  : previewDoc.row.bast_number
              }`
            : ''
        }
        footer={
          previewDoc && (
            <>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => handlePrintDoc(previewDoc.row, previewDoc.type)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 px-4 py-2 text-xs font-bold text-white"
              >
                <Printer size={14} /> Cetak Dokumen {previewDoc.type}
              </button>
            </>
          )
        }
      >
        {previewDoc && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 grid grid-cols-2 gap-2">
              <div><span className="text-slate-500">Tanggal:</span> <b>{formatDate(previewDoc.row.trx_date)} {previewDoc.row.trx_time || ''}</b></div>
              <div><span className="text-slate-500">Unit:</span> <b>{previewDoc.row.unit_name || 'Instalasi CSSD'}</b></div>
              <div><span className="text-slate-500">Anggaran:</span> <b>{previewDoc.row.budget_source} ({previewDoc.row.fiscal_year})</b></div>
              <div><span className="text-slate-500">Petugas:</span> <b>{previewDoc.row.officer}</b></div>
              <div className="col-span-2"><span className="text-slate-500">Keperluan:</span> <b>{previewDoc.row.purpose || previewDoc.row.notes || '-'}</b></div>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-[11px] font-bold text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Barang BMHP</th>
                    <th className="px-3 py-2">Batch</th>
                    <th className="px-3 py-2">ED</th>
                    <th className="px-3 py-2 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{previewDoc.row.item_name}</td>
                    <td className="px-3 py-2.5 font-mono">{previewDoc.row.batch_no || '-'}</td>
                    <td className="px-3 py-2.5">{previewDoc.row.expiry_date ? formatDate(previewDoc.row.expiry_date) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-brand-700">
                      {formatNumber(previewDoc.row.quantity)} {previewDoc.row.unit_label}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
