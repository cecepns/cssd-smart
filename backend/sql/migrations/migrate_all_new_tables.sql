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

-- ------------------------------------------------------------
-- 5. Tabel Riwayat Instrumen Hilang, Rusak, & Kurang
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `instrument_discrepancy_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `set_id` INT UNSIGNED NOT NULL,
  `instrument_name` VARCHAR(150) NOT NULL,
  `incident_type` ENUM('Kurang', 'Hilang', 'Rusak', 'Ditemukan Kembali', 'Diganti Baru') NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_origin` VARCHAR(100) DEFAULT NULL,
  `officer` VARCHAR(100) NOT NULL,
  `incident_date` DATE NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `resolution_status` ENUM('Belum Selesai', 'Selesai') NOT NULL DEFAULT 'Belum Selesai',
  `resolution_notes` TEXT DEFAULT NULL,
  `resolved_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_disc_set_id` (`set_id`),
  KEY `idx_disc_status` (`resolution_status`),
  CONSTRAINT `fk_disc_set` FOREIGN KEY (`set_id`) REFERENCES `instrument_sets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `instrument_discrepancy_logs` (`id`, `set_id`, `instrument_name`, `incident_type`, `quantity`, `unit_origin`, `officer`, `incident_date`, `notes`, `resolution_status`)
VALUES
(1, 4, 'Gunting episiotomi', 'Rusak', 1, 'Ruang Bersalin (VK)', 'Inge Kusryaningsih', '2026-11-01', 'Gunting episiotomi mata gunting tumpul / dalam perbaikan teknisi', 'Belum Selesai')
ON DUPLICATE KEY UPDATE `instrument_name` = VALUES(`instrument_name`);

-- ------------------------------------------------------------
-- 6. Tabel Master Satuan (item_units) & Data Awal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `item_units` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `category` ENUM('Semua', 'Steril', 'DTT') NOT NULL DEFAULT 'Semua',
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_item_units_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `item_units` (`id`, `code`, `name`, `category`, `description`) VALUES
(1, 'SET', 'Set', 'Semua', 'Set instrumen bedah/tindakan lengkap'),
(2, 'PCS', 'Pcs', 'Semua', 'Alat satuan / lepasan per pcs'),
(3, 'BUAH', 'Buah', 'Semua', 'Alat satuan per buah'),
(4, 'TABUNG', 'Tabung', 'DTT', 'Instrumen berbentuk tabung / kanul suction / trocar DTT'),
(5, 'SUNGKUP', 'Sungkup', 'DTT', 'Sungkup anestesi / resusitasi / nebulizer DTT'),
(6, 'PASANG', 'Pasang', 'Steril', 'Alat / sarung tangan berpasangan'),
(7, 'LEMBAR', 'Lembar', 'Steril', 'Duk, kain linen, wrap steril'),
(8, 'ROL', 'Rol', 'Steril', 'Kasa rol dan pita indikator'),
(9, 'PAKET', 'Paket', 'Semua', 'Paket gabungan alat atau linen'),
(10, 'POUCH', 'Pouch', 'Steril', 'Kemasan steril pouch')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category` = VALUES(`category`), `description` = VALUES(`description`);

-- ------------------------------------------------------------
-- 7. Pembaruan Tabel Users (Role Unit & Relasi Unit Luar)
-- ------------------------------------------------------------
ALTER TABLE `users` MODIFY COLUMN `role` ENUM('admin', 'petugas', 'unit') NOT NULL DEFAULT 'petugas';

DROP PROCEDURE IF EXISTS `AddColIfNotExist`;
DELIMITER $$
CREATE PROCEDURE `AddColIfNotExist`(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_coldef TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = p_table AND column_name = p_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_coldef);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$
DELIMITER ;

CALL `AddColIfNotExist`('users', 'unit_id', 'INT UNSIGNED DEFAULT NULL AFTER `role`');

-- ------------------------------------------------------------
-- 8. Pembaruan Tabel Distributions & Items (Alat Medis)
-- ------------------------------------------------------------
CALL `AddColIfNotExist`('distributions', 'gauze_type', 'VARCHAR(100) DEFAULT NULL AFTER `quantity`');
CALL `AddColIfNotExist`('distributions', 'officer_signature', 'TEXT DEFAULT NULL AFTER `officer`');
CALL `AddColIfNotExist`('distributions', 'receiver_signature', 'TEXT DEFAULT NULL AFTER `receiver_name`');

-- Kategori Proses (Steril / DTT) dan Satuan Standar pada Master Data Alat
CALL `AddColIfNotExist`('items', 'process_type', "ENUM('Steril','DTT') NOT NULL DEFAULT 'Steril' AFTER `name`");
CALL `AddColIfNotExist`('items', 'unit_label', "VARCHAR(50) NOT NULL DEFAULT 'Set' AFTER `category`");

-- ------------------------------------------------------------
-- 9. Modul DTT (RIUS) & Buku Kontrol Penggunaan Ulang Alat Medis
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dtt_receipts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `barcode` VARCHAR(50) NOT NULL,
  `receipt_datetime` DATETIME NOT NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `item_code` VARCHAR(50) DEFAULT NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'Pcs',
  `reuse_count` INT UNSIGNED NOT NULL DEFAULT 1,
  `max_reuse_limit` INT UNSIGNED NOT NULL DEFAULT 10,
  `tool_condition` ENUM('Baik', 'Perlu Perbaikan', 'Rusak') NOT NULL DEFAULT 'Baik',
  `sender_name` VARCHAR(100) NOT NULL,
  `sender_signature` TEXT DEFAULT NULL,
  `receiver_name` VARCHAR(100) NOT NULL,
  `receiver_signature` TEXT DEFAULT NULL,
  `process_stage` ENUM('Penerimaan', 'Pencucian & DTT', 'Penyimpanan', 'Selesai') NOT NULL DEFAULT 'Penerimaan',
  `verification_result` ENUM('Memenuhi Syarat', 'Tidak Memenuhi Syarat', 'Pending') NOT NULL DEFAULT 'Memenuhi Syarat',
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dtt_receipts_barcode` (`barcode`),
  KEY `idx_dtt_receipts_unit` (`unit_id`),
  KEY `idx_dtt_receipts_datetime` (`receipt_datetime`),
  KEY `idx_dtt_receipts_condition` (`tool_condition`),
  KEY `idx_dtt_receipts_stage` (`process_stage`),
  CONSTRAINT `fk_dtt_receipts_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dtt_distributions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `barcode` VARCHAR(50) NOT NULL,
  `dist_datetime` DATETIME NOT NULL,
  `dtt_receipt_id` INT UNSIGNED NOT NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `item_code` VARCHAR(50) DEFAULT NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'Pcs',
  `reuse_count` INT UNSIGNED NOT NULL DEFAULT 1,
  `tool_condition` ENUM('Baik', 'Perlu Perbaikan', 'Rusak') NOT NULL DEFAULT 'Baik',
  `sender_name` VARCHAR(100) NOT NULL,
  `sender_signature` TEXT DEFAULT NULL,
  `receiver_name` VARCHAR(100) NOT NULL,
  `receiver_signature` TEXT DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dtt_dist_barcode` (`barcode`),
  KEY `idx_dtt_dist_receipt` (`dtt_receipt_id`),
  KEY `idx_dtt_dist_unit` (`unit_id`),
  KEY `idx_dtt_dist_datetime` (`dist_datetime`),
  CONSTRAINT `fk_dtt_dist_receipt` FOREIGN KEY (`dtt_receipt_id`) REFERENCES `dtt_receipts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dtt_dist_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 10. Master Mesin Sterilisasi 5 Pilihan Sesuai SOP
-- ------------------------------------------------------------
ALTER TABLE `machines` MODIFY COLUMN `type` VARCHAR(50) NOT NULL;

INSERT INTO `machines` (`id`, `code`, `name`, `type`) VALUES
(1, 'AU1', 'Autoclave 1', 'Autoclave 1'),
(2, 'AU2', 'Autoclave 2', 'Autoclave 2'),
(3, 'ST1', 'Steam Sterilizer', 'Steam Sterilizer'),
(4, 'PL1', 'Plasma Sterilizer', 'Plasma Sterilizer'),
(5, 'DT1', 'DTT Manual', 'DTT Manual')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `type` = VALUES(`type`);

-- ------------------------------------------------------------
-- 11. Inisialisasi Counter Barcode DTT
-- ------------------------------------------------------------
INSERT IGNORE INTO `counters` (`name`, `counter_date`, `value`) VALUES
('RD', CURDATE(), 0),
('DDTT', CURDATE(), 0);

DROP PROCEDURE IF EXISTS `AddColIfNotExist`;

SET FOREIGN_KEY_CHECKS = 1;

