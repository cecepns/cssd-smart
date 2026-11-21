-- ============================================================
-- CSSD SMART - RSUD Serpong Utara
-- Migration: 20261121_001_dtt_and_climate_schema_fix_direct.sql
-- Direct SQL (Hanya kolom-kolom baru yang belum ada di database)
-- ============================================================

-- 1. Tambah kolom baru DTT pada dtt_receipts (yang menyebabkan error dtt_method)
ALTER TABLE `dtt_receipts`
  ADD `dtt_method` VARCHAR(100) DEFAULT 'DTT Manual (Perendaman Enzimatik & Disinfektan Tingkat Tinggi)',
  ADD `dtt_liquid` VARCHAR(100) DEFAULT 'Glutaraldehyde 2%',
  ADD `dtt_duration_min` INT UNSIGNED DEFAULT 20,
  ADD `verification_result` ENUM('Belum Diverifikasi', 'Lolos', 'Gagal / Cuci Ulang') NOT NULL DEFAULT 'Belum Diverifikasi',
  ADD `max_reuse_limit` INT UNSIGNED NOT NULL DEFAULT 4,
  ADD `started_at` DATETIME DEFAULT NULL,
  ADD `completed_at` DATETIME DEFAULT NULL;

-- 2. Modifikasi kolom pada dtt_distributions
ALTER TABLE `dtt_distributions`
  MODIFY COLUMN `dtt_receipt_id` INT UNSIGNED DEFAULT NULL,
  ADD `officer` VARCHAR(100) DEFAULT NULL,
  ADD `officer_signature` TEXT DEFAULT NULL,
  ADD `started_at` DATETIME DEFAULT NULL,
  ADD `completed_at` DATETIME DEFAULT NULL;

-- 3. Sinkronkan nama petugas dari data lama
UPDATE `dtt_distributions` SET `officer` = `sender_name` WHERE (`officer` IS NULL OR `officer` = '') AND `sender_name` IS NOT NULL;

-- 4. Buat tabel monitoring suhu & kelembaban jika belum ada
CREATE TABLE IF NOT EXISTS `storage_climate_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_name` VARCHAR(100) NOT NULL DEFAULT 'Ruang Penyimpanan Alat Steril',
  `check_date` DATE NOT NULL,
  `check_time` TIME NOT NULL,
  `temperature` DECIMAL(4, 1) NOT NULL DEFAULT 20.0,
  `humidity` DECIMAL(4, 1) NOT NULL DEFAULT 45.0,
  `temp_status` ENUM('NORMAL', 'WARNING') NOT NULL DEFAULT 'NORMAL',
  `humidity_status` ENUM('NORMAL', 'WARNING') NOT NULL DEFAULT 'NORMAL',
  `overall_status` ENUM('NORMAL', 'WARNING') NOT NULL DEFAULT 'NORMAL',
  `officer` VARCHAR(100) NOT NULL DEFAULT 'Petugas CSSD',
  `officer_signature` TEXT DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `corrective_action` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_climate_date` (`check_date`),
  INDEX `idx_climate_room` (`room_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
