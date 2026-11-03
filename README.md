# CSSD SMART — Sterile Management System (RSU Serpong Utara)

Sistem pencatatan otomatis alat kesehatan CSSD. Barcode hanya dipakai pada 3 transaksi utama
(Alat Kotor Masuk, Distribusi Alat Steril, Distribusi Kasa Steril); tahap proses lain terhubung
otomatis dan terkunci per tahap.

## Alur
Alat Kotor Masuk (barcode) → Pencucian → Pengeringan & Pemeriksaan → Pengemasan → Sterilisasi →
Verifikasi → **Lulus**: masuk Stok Alat Steril → Distribusi Alat/Kasa Steril (barcode).
**Gagal**: otomatis masuk Karantina/Gagal. Ada juga Manajemen Stok BMHP, Laporan, dan Ketertelusuran.

## Stack
- Frontend: React + Vite + JSX, PWA, TailwindCSS, Lucide React, react-hot-toast
- Backend: Express JS + MySQL (REST API, satu file `backend/server.js`)
- Aturan lengkap: lihat `AGENTS.md`

## Menjalankan
```bash
# 1. Database (Setup Awal)
mysql -u root -p < backend/sql/database.sql

# Jika melakukan update/migrasi tabel pada database yang sudah berjalan:
mysql -u root -p < backend/sql/migrations/migrate_all_new_tables.sql

# 2. Backend
cd backend
cp .env.example .env      # isi DB_*, JWT_SECRET
npm install
npm run dev               # http://localhost:5000

# 3. Frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```
Login awal: `admin` / `admin123` (dibuat otomatis jika tabel users kosong) — **ganti di production**.

## Production
`npm run build` di `frontend/` menghasilkan `dist/` (sajikan lewat Nginx dengan HTTPS;
kamera scan barcode dan install PWA membutuhkan HTTPS). Jalankan backend dengan `npm start` (pm2/systemd).
Upload tersimpan di `backend/uploads-cssd-smart/`.
# cssd-smart
