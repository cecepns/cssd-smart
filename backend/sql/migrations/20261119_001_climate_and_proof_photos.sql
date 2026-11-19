-- Migration: 20261119_001_climate_and_proof_photos.sql
-- Kebutuhan:
-- 1. Penambahan kolom foto bukti serah terima (proof_image) pada 4 tabel serah terima
-- 2. Dukungan pengambilan DTT langsung dari Master Data (dtt_receipt_id NULL)
-- 3. Tabel baru pemantauan suhu dan kelembaban ruang penyimpanan alat steril

-- 1. Tambah kolom proof_image pada dirty_receipts
ALTER TABLE `dirty_receipts`
  ADD COLUMN `proof_image` LONGTEXT DEFAULT NULL AFTER `notes`;

-- 2. Tambah kolom proof_image pada distributions
ALTER TABLE `distributions`
  ADD COLUMN `proof_image` LONGTEXT DEFAULT NULL AFTER `notes`;

-- 3. Tambah kolom proof_image pada dtt_receipts
ALTER TABLE `dtt_receipts`
  ADD COLUMN `proof_image` LONGTEXT DEFAULT NULL AFTER `notes`;

-- 4. Modifikasi dtt_distributions: izinkan dtt_receipt_id NULL dan tambah proof_image
ALTER TABLE `dtt_distributions`
  MODIFY COLUMN `dtt_receipt_id` INT UNSIGNED DEFAULT NULL,
  ADD COLUMN `proof_image` LONGTEXT DEFAULT NULL AFTER `notes`;

-- 5. Tabel Pemantauan Suhu dan Kelembaban Udara Ruangan (Standar RSUD Serpong Utara)
CREATE TABLE IF NOT EXISTS `storage_climate_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_name` VARCHAR(100) NOT NULL DEFAULT 'Ruang Penyimpanan Alat Steril',
  `check_date` DATE NOT NULL,
  `check_time` TIME NOT NULL,
  `temperature` DECIMAL(4, 1) NOT NULL,
  `humidity` DECIMAL(4, 1) NOT NULL,
  `temp_status` ENUM('NORMAL', 'WARNING') NOT NULL DEFAULT 'NORMAL',
  `humidity_status` ENUM('NORMAL', 'WARNING') NOT NULL DEFAULT 'NORMAL',
  `overall_status` ENUM('NORMAL', 'WARNING') NOT NULL DEFAULT 'NORMAL',
  `officer` VARCHAR(100) NOT NULL,
  `officer_signature` TEXT DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `corrective_action` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_climate_date` (`check_date`),
  INDEX `idx_climate_room` (`room_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
