-- ============================================================
-- CSSD SMART - COMBINED MIGRATION SCRIPT
-- File: backend/sql/migrations/migrate_all_new_tables.sql
-- 
-- Skrip ini aman dijalankan di MySQL phpMyAdmin / CLI / DBeaver
-- pada database yang sudah berjalan (tidak merusak data lama).
--
-- Mencakup:
-- 1. Tabel master petugas CSSD (officers)
-- 2. Tabel master Set Instrumen (instrument_sets)
-- 3. Tabel rincian instrumen per set (instrument_set_items)
-- 4. Sample data awal lengkap & stok set laparotomi
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. Tabel Officers (Petugas CSSD & Tanda Tangan)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `officers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nip` VARCHAR(50) DEFAULT NULL,
  `name` VARCHAR(100) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'Petugas CSSD',
  `phone` VARCHAR(30) DEFAULT NULL,
  `signature` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_officers_active` (`is_active`),
  KEY `idx_officers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `officers` (`id`, `nip`, `name`, `role`, `phone`) VALUES
(1, 'PEG-001', 'Inge Kusryaningsih', 'Petugas CSSD', '081234567890'),
(2, 'PEG-002', 'Rahma', 'Petugas Penerima CSSD', '081234567891'),
(3, 'PEG-003', 'Zamra', 'Petugas Pengeringan', '081234567892'),
(4, 'PEG-004', 'Inge', 'Petugas CSSD', '081234567894'),
(5, 'PEG-005', 'Budi Santoso', 'Operator Sterilisasi', '081234567893')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ------------------------------------------------------------
-- 2. Tabel Master Set Instrumen
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `instrument_sets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `completeness_status` ENUM('Lengkap','Tidak Lengkap') NOT NULL DEFAULT 'Lengkap',
  `missing_notes` VARCHAR(255) DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_instrument_sets_code` (`code`),
  KEY `idx_instrument_sets_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. Tabel Rincian Instrumen per Set
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `instrument_set_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `set_id` INT UNSIGNED NOT NULL,
  `instrument_name` VARCHAR(150) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'Buah',
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_set_items_set_id` (`set_id`),
  CONSTRAINT `fk_set_items_set` FOREIGN KEY (`set_id`) REFERENCES `instrument_sets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. Sample Data Set Instrumen
-- ------------------------------------------------------------
INSERT INTO `instrument_sets` (`id`, `code`, `name`, `completeness_status`, `missing_notes`, `description`) VALUES
(1, 'SET-LAP', 'SET LAPAROTOMI', 'Lengkap', NULL, 'Set instrumen bedah laparotomi mayor'),
(2, 'SET-MNR', 'SET MINOR', 'Lengkap', NULL, 'Set bedah minor rawat jalan & IGD'),
(3, 'SET-SC', 'SET SECTIO CAESAREA', 'Lengkap', NULL, 'Set bedah sesar / SC kamar operasi VK'),
(4, 'SET-PRT', 'SET PARTUS', 'Tidak Lengkap', 'Gunting episiotomi kurang 1 pcs dalam perbaikan teknisi', 'Set pertolongan persalinan normal')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `instrument_set_items` (`id`, `set_id`, `instrument_name`, `quantity`, `unit_label`, `sort_order`) VALUES
-- Set Laparotomi (14 buah sesuai referensi)
(1, 1, 'Pinset anatomis', 2, 'Buah', 1),
(2, 1, 'Pinset sirurgis', 2, 'Buah', 2),
(3, 1, 'Gunting Mayo', 2, 'Buah', 3),
(4, 1, 'Klem Pean', 6, 'Buah', 4),
(5, 1, 'Needle holder', 2, 'Buah', 5),

-- Set Minor (10 buah)
(6, 2, 'Gunting bedah lurus', 1, 'Buah', 1),
(7, 2, 'Gunting bedah bengkok', 1, 'Buah', 2),
(8, 2, 'Pinset anatomis', 2, 'Buah', 3),
(9, 2, 'Pinset sirurgis', 2, 'Buah', 4),
(10, 2, 'Klem arteri Pean', 2, 'Buah', 5),
(11, 2, 'Needle holder', 1, 'Buah', 6),
(12, 2, 'Bak instrumen', 1, 'Buah', 7),

-- Set SC (22 buah)
(13, 3, 'Pinset sirurgis', 2, 'Buah', 1),
(14, 3, 'Pinset anatomis', 2, 'Buah', 2),
(15, 3, 'Gunting Metzenbaum', 2, 'Buah', 3),
(16, 3, 'Gunting Mayo', 2, 'Buah', 4),
(17, 3, 'Klem Kocher', 4, 'Buah', 5),
(18, 3, 'Klem Pean', 4, 'Buah', 6),
(19, 3, 'Needle holder', 2, 'Buah', 7),
(20, 3, 'Retraktor Abdomen', 2, 'Buah', 8),
(21, 3, 'Ring forceps / Klem kassa', 2, 'Buah', 9),

-- Set Partus (8 buah)
(22, 4, 'Gunting episiotomi', 1, 'Buah', 1),
(23, 4, 'Gunting tali pusat', 1, 'Buah', 2),
(24, 4, 'Klem tali pusat', 2, 'Buah', 3),
(25, 4, 'Pinset anatomis', 1, 'Buah', 4),
(26, 4, 'Needle holder', 1, 'Buah', 5),
(27, 4, 'Catheter nelaton', 1, 'Buah', 6),
(28, 4, 'Setengah kocher', 1, 'Buah', 7)
ON DUPLICATE KEY UPDATE `instrument_name` = VALUES(`instrument_name`), `quantity` = VALUES(`quantity`);

-- Stok Awal Set Laparotomi di Stok Steril (5 Set Tersedia)
INSERT INTO `sterile_stock` (`packaging_id`, `barcode`, `category`, `item_name`, `batch_no`, `sterile_date`, `expiry_date`, `quantity`, `unit_label`, `status`)
SELECT 1, 'SM-301026-003', 'Set Instrumen', 'SET LAPAROTOMI', 'AU1-301026-025', '2026-10-30', '2027-04-30', 5, 'set', 'Tersedia'
WHERE NOT EXISTS (
  SELECT 1 FROM `sterile_stock` WHERE `barcode` = 'SM-301026-003'
);

-- ------------------------------------------------------------
-- 4. Pembaruan 4 Kategori Jenis Alat CSSD
-- ------------------------------------------------------------
-- Buka ENUM
ALTER TABLE `items` MODIFY COLUMN `category` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Instrumen / Set Alat') NOT NULL;
ALTER TABLE `packagings` MODIFY COLUMN `package_type` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Instrumen / Set Alat') NOT NULL;
ALTER TABLE `sterile_stock` MODIFY COLUMN `category` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Instrumen / Set Alat') NOT NULL;

-- Migrasi data lama
UPDATE `items` SET `category` = CASE 
  WHEN `name` LIKE '%Set%' OR `name` LIKE '%SET%' OR `code` LIKE 'SET%' OR `code` LIKE 'INS%' THEN 'Set Instrumen'
  ELSE 'Alat Satuan'
END WHERE `category` = 'Instrumen / Set Alat';

UPDATE `packagings` SET `package_type` = CASE
  WHEN `material` = 'Container' OR `unit_label` = 'set' THEN 'Set Instrumen'
  ELSE 'Alat Satuan'
END WHERE `package_type` = 'Instrumen / Set Alat';

UPDATE `sterile_stock` SET `category` = CASE
  WHEN `item_name` LIKE '%Set%' OR `item_name` LIKE '%SET%' OR `unit_label` = 'set' THEN 'Set Instrumen'
  ELSE 'Alat Satuan'
END WHERE `category` = 'Instrumen / Set Alat';

-- Kunci ENUM 4 kategori
ALTER TABLE `items` MODIFY COLUMN `category` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril') NOT NULL;
ALTER TABLE `packagings` MODIFY COLUMN `package_type` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril') NOT NULL;
ALTER TABLE `sterile_stock` MODIFY COLUMN `category` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril') NOT NULL;

-- Tambah sample Alat Satuan jika belum ada
INSERT INTO `items` (`code`, `name`, `category`, `shelf_life_months`, `description`)
SELECT 'ALT-GNT', 'Gunting Hecting Satuan', 'Alat Satuan', 6, 'Gunting angkat jahitan / hecting lepasan'
WHERE NOT EXISTS (SELECT 1 FROM `items` WHERE `code` = 'ALT-GNT');

INSERT INTO `items` (`code`, `name`, `category`, `shelf_life_months`, `description`)
SELECT 'ALT-PNS', 'Pinset Sirurgis Satuan', 'Alat Satuan', 6, 'Pinset sirurgis lepasan IGD/Poli'
WHERE NOT EXISTS (SELECT 1 FROM `items` WHERE `code` = 'ALT-PNS');

SET FOREIGN_KEY_CHECKS = 1;

