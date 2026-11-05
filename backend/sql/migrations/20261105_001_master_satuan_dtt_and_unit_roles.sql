-- ============================================================
-- CSSD SMART - MIGRATION SCRIPT
-- File: backend/sql/migrations/20261105_001_master_satuan_dtt_and_unit_roles.sql
-- Tanggal: 2026-11-05
-- 
-- Pembaruan:
-- 1. Master Satuan (item_units) & Seed Data Satuan Medis
-- 2. Hak Akses Unit Luar: Role 'unit' & unit_id pada tabel users
-- 3. Distribusi Kasa Steril (gauze_type) & Tanda Tangan Digital Layar HP
-- 4. Modul DTT (RIUS) & Buku Kontrol Penggunaan Ulang Alat Medis:
--    - Tabel dtt_receipts (Penerimaan Alat Kotor DTT: Unit -> CSSD)
--    - Tabel dtt_distributions (Distribusi Alat Hasil DTT: CSSD -> Unit)
-- 5. Master Mesin 5 Pilihan (Autoclave 1, 2, Steam, Plasma, DTT Manual)
-- 6. Counter Barcode Otomatis RD (Penerimaan DTT) & DDTT (Distribusi DTT)
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. Tabel Master Satuan (item_units)
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

-- Data Awal Master Satuan Alat / Instrumen
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
-- Prosedur Helper: Tambah kolom jika belum ada (Aman / Idempotent)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 2. Pembaruan Tabel Users (Role Unit & Relasi Unit Luar)
-- ------------------------------------------------------------
-- Perluas enum role agar mendukung 'unit'
ALTER TABLE `users` MODIFY COLUMN `role` ENUM('admin', 'petugas', 'unit') NOT NULL DEFAULT 'petugas';

-- Tambahkan unit_id pada tabel users jika belum ada
CALL `AddColIfNotExist`('users', 'unit_id', 'INT UNSIGNED DEFAULT NULL AFTER `role`');

-- Tambahkan foreign key index jika belum ada
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_unit_id'
);
SET @sql_idx = IF(@idx_exists = 0, 'ALTER TABLE `users` ADD KEY `idx_users_unit_id` (`unit_id`)', 'SELECT 1');
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- ------------------------------------------------------------
-- 3. Pembaruan Tabel Distributions & Items (Alat Medis)
-- ------------------------------------------------------------
CALL `AddColIfNotExist`('distributions', 'gauze_type', 'VARCHAR(100) DEFAULT NULL AFTER `quantity`');
CALL `AddColIfNotExist`('distributions', 'officer_signature', 'TEXT DEFAULT NULL AFTER `officer`');
CALL `AddColIfNotExist`('distributions', 'receiver_signature', 'TEXT DEFAULT NULL AFTER `receiver_name`');

-- Kategori Proses (Steril / DTT) dan Satuan Standar pada Master Data Alat
CALL `AddColIfNotExist`('items', 'process_type', "ENUM('Steril','DTT') NOT NULL DEFAULT 'Steril' AFTER `name`");
CALL `AddColIfNotExist`('items', 'unit_label', "VARCHAR(50) NOT NULL DEFAULT 'Set' AFTER `category`");

-- ------------------------------------------------------------
-- 4. Modul DTT (RIUS) & Buku Kontrol Penggunaan Ulang Alat Medis
-- ------------------------------------------------------------

-- Transaksi 1: Penerimaan Alat Kotor DTT/RIUS (Unit -> CSSD)
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

-- Transaksi 2: Distribusi Alat Hasil DTT/RIUS (CSSD -> Unit)
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
-- 5. Master Mesin Sterilisasi 5 Pilihan Sesuai SOP
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
-- 6. Inisialisasi Counter Barcode DTT jika belum ada
-- ------------------------------------------------------------
INSERT IGNORE INTO `counters` (`name`, `counter_date`, `value`) VALUES
('RD', CURDATE(), 0),
('DDTT', CURDATE(), 0);

-- Hapus prosedur helper setelah selesai
DROP PROCEDURE IF EXISTS `AddColIfNotExist`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Selesai: Migrasi Database CSSD SMART Berhasil Dijalankan
-- ============================================================

