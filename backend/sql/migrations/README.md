# 🗄️ Database Migrations CSSD SMART

Folder ini berisi file migrasi SQL terstruktur untuk memperbarui database tanpa harus mengimpor ulang seluruh tabel (`database.sql`).

## 📁 Daftar File Migrasi

| File | Keterangan |
|------|------------|
| `20261102_001_create_officers.sql` | Tabel master petugas CSSD (`officers`) & tanda tangan digital |
| `20261102_002_create_instrument_sets.sql` | Tabel Set Instrumen (`instrument_sets`) & rincian instrumen (`instrument_set_items`) |
| `20261103_001_update_categories_4_types.sql` | Pembaruan 4 kategori jenis alat (Alat Satuan, Set Instrumen, Duk & Jas Operasi, Kasa Steril) |
| `migrate_all_new_tables.sql` | **(Recommended)** Seluruh migrasi gabungan idempotent (aman dijalankan berulang kali) |

---

## 🚀 Cara Menjalankan Migrasi

### 1. Melalui phpMyAdmin (cPanel / XAMPP)
1. Buka database Anda (misal `kinq6231_cssd-smart` atau `cssd_smart`).
2. Masuk ke tab **Import** atau **SQL**.
3. Buka file `migrate_all_new_tables.sql` lalu copy dan paste isinya ke kotak query SQL.
4. Klik **Go** / **Kirim**.

### 2. Melalui Terminal / MySQL CLI
```bash
mysql -u root -p cssd_smart < backend/sql/migrations/migrate_all_new_tables.sql
```

