-- ============================================================================
-- Migration: 20261123_001_bmhp_master_data_revisi
-- Tanggal : 2026-11-23
-- Deskripsi: Menambah kolom Master Data BMHP sesuai dokumen revisi BMHP
--            (NUSP, merek, pabrik/produsen, supplier, kemasan, isi per kemasan,
--             kode rekening, sumber anggaran, tahun anggaran, harga acuan,
--             lokasi penyimpanan, foto barang)
--            + kolom penerimaan di bmhp_transactions
--            (supplier, PO, surat jalan, faktur, kondisi, lokasi)
-- ============================================================================

-- ===== 1. KOLOM BARU DI bmhp_items (Master Data BMHP) =====

-- NUSP (Nomor/kode NUSP sesuai data rumah sakit)
ALTER TABLE bmhp_items ADD COLUMN nusp VARCHAR(50) DEFAULT NULL AFTER barcode;

-- Merek / Brand produk
ALTER TABLE bmhp_items ADD COLUMN brand VARCHAR(100) DEFAULT NULL AFTER specification;

-- Pabrik / Produsen
ALTER TABLE bmhp_items ADD COLUMN manufacturer VARCHAR(150) DEFAULT NULL AFTER brand;

-- Supplier / Penyedia default (penyedia aktual dipilih pada Barang Masuk)
ALTER TABLE bmhp_items ADD COLUMN default_supplier VARCHAR(150) DEFAULT NULL AFTER manufacturer;

-- Kemasan (box, pack, dus, karton, roll, dsb)
ALTER TABLE bmhp_items ADD COLUMN packaging_label VARCHAR(50) DEFAULT NULL AFTER unit_label;

-- Isi per Kemasan (misal: 100 pcs per box/dus)
ALTER TABLE bmhp_items ADD COLUMN contents_per_package INT DEFAULT NULL AFTER packaging_label;

-- Kode Rekening belanja sesuai data RS
ALTER TABLE bmhp_items ADD COLUMN account_code VARCHAR(50) DEFAULT NULL AFTER contents_per_package;

-- Sumber Anggaran default (APBD, BLUD, dll)
ALTER TABLE bmhp_items ADD COLUMN default_budget_source VARCHAR(50) DEFAULT NULL AFTER account_code;

-- Tahun Anggaran default
ALTER TABLE bmhp_items ADD COLUMN default_fiscal_year VARCHAR(10) DEFAULT NULL AFTER default_budget_source;

-- Harga Acuan / Referensi (bukan harga beli aktual)
ALTER TABLE bmhp_items ADD COLUMN reference_price DECIMAL(15,2) DEFAULT 0 AFTER default_fiscal_year;

-- Lokasi Penyimpanan BMHP
ALTER TABLE bmhp_items ADD COLUMN storage_location VARCHAR(100) DEFAULT NULL AFTER reference_price;

-- Foto referensi barang (URL/path)
ALTER TABLE bmhp_items ADD COLUMN photo VARCHAR(500) DEFAULT NULL AFTER storage_location;


-- ===== 2. KOLOM BARU DI bmhp_transactions (Data Penerimaan Lengkap) =====

-- Supplier/Penyedia aktual pada transaksi penerimaan
ALTER TABLE bmhp_transactions ADD COLUMN supplier_name VARCHAR(150) DEFAULT NULL AFTER unit_name;

-- No. PO/SPK/Kontrak
ALTER TABLE bmhp_transactions ADD COLUMN po_number VARCHAR(60) DEFAULT NULL AFTER supplier_name;

-- No. Surat Jalan
ALTER TABLE bmhp_transactions ADD COLUMN delivery_note VARCHAR(60) DEFAULT NULL AFTER po_number;

-- No. Faktur
ALTER TABLE bmhp_transactions ADD COLUMN invoice_number VARCHAR(60) DEFAULT NULL AFTER delivery_note;

-- Kondisi barang (Baik, Rusak, dll)
ALTER TABLE bmhp_transactions ADD COLUMN item_condition VARCHAR(30) DEFAULT 'Baik' AFTER invoice_number;

-- Lokasi penyimpanan (pada penerimaan)
ALTER TABLE bmhp_transactions ADD COLUMN storage_location VARCHAR(100) DEFAULT NULL AFTER item_condition;

-- Tanggal produksi
ALTER TABLE bmhp_transactions ADD COLUMN production_date DATE DEFAULT NULL AFTER storage_location;

-- Foto lampiran dokumen (surat jalan, faktur, label batch)
ALTER TABLE bmhp_transactions ADD COLUMN attachment_photos LONGTEXT DEFAULT NULL AFTER proof_image;

-- TTD Verifikator / Kepala Instalasi CSSD
ALTER TABLE bmhp_transactions ADD COLUMN verifier_signature LONGTEXT DEFAULT NULL AFTER officer_signature;

-- Nama verifikator
ALTER TABLE bmhp_transactions ADD COLUMN verifier_name VARCHAR(100) DEFAULT NULL AFTER verifier_signature;

-- Foto serah terima (opsional, untuk barang keluar)
ALTER TABLE bmhp_transactions ADD COLUMN handover_photo LONGTEXT DEFAULT NULL AFTER attachment_photos;


-- ===== 3. INDEX TAMBAHAN =====

-- Index untuk pencarian berdasarkan supplier
ALTER TABLE bmhp_transactions ADD INDEX idx_bmhp_trx_supplier (supplier_name);

-- Index untuk pencarian berdasarkan PO number
ALTER TABLE bmhp_transactions ADD INDEX idx_bmhp_trx_po (po_number);

-- Index untuk pencarian berdasarkan doc_type (NPB, SPB, SPPB, BAST)
ALTER TABLE bmhp_transactions ADD INDEX idx_bmhp_trx_doc_type (doc_type);

-- Index expiring di bmhp_batches untuk query monitoring ED
ALTER TABLE bmhp_batches ADD INDEX idx_batch_expiry (expiry_date);


-- ===== 4. TABEL MASTER PENDUKUNG (Opsional - jika belum ada) =====

-- Master Supplier/Penyedia BMHP
CREATE TABLE IF NOT EXISTS bmhp_suppliers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  address VARCHAR(500) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_supplier_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Kemasan BMHP
CREATE TABLE IF NOT EXISTS bmhp_packaging_types (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_packaging_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Pabrik/Produsen BMHP
CREATE TABLE IF NOT EXISTS bmhp_manufacturers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_manufacturer_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Kode Rekening BMHP
CREATE TABLE IF NOT EXISTS bmhp_account_codes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_account_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Lokasi Penyimpanan BMHP
CREATE TABLE IF NOT EXISTS bmhp_storage_locations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_storage_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Sumber Anggaran BMHP
CREATE TABLE IF NOT EXISTS bmhp_budget_sources (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_budget_source (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Tahun Anggaran BMHP
CREATE TABLE IF NOT EXISTS bmhp_fiscal_years (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  year VARCHAR(10) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fiscal_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Unit Pemakai (khusus BMHP, hanya Instalasi CSSD)
CREATE TABLE IF NOT EXISTS bmhp_consumer_units (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL DEFAULT 'Instalasi CSSD',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_consumer_unit (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ===== 5. INSERT DATA AWAL MASTER PENDUKUNG =====

-- Sumber Anggaran
INSERT IGNORE INTO bmhp_budget_sources (name) VALUES ('BLUD'), ('APBD'), ('DAK'), ('BOK');

-- Tahun Anggaran
INSERT IGNORE INTO bmhp_fiscal_years (year) VALUES ('2023'), ('2024'), ('2025'), ('2026'), ('2027');

-- Kemasan
INSERT IGNORE INTO bmhp_packaging_types (name) VALUES
  ('Box'), ('Pack'), ('Dus'), ('Karton'), ('Roll'), ('Botol'), ('Pouch'), ('Sachet'), ('Tube');

-- Lokasi Penyimpanan
INSERT IGNORE INTO bmhp_storage_locations (name) VALUES
  ('Gudang BMHP CSSD'), ('Rak A'), ('Rak B'), ('Rak C'), ('Lemari Penyimpanan');

-- Unit Pemakai
INSERT IGNORE INTO bmhp_consumer_units (name) VALUES ('Instalasi CSSD');

-- Kode Rekening contoh
INSERT IGNORE INTO bmhp_account_codes (code, description) VALUES
  ('5.1.02.01.01', 'Belanja BMHP');
