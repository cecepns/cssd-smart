-- Migration: 20261120_001_distributions_multi_set.sql
-- Kebutuhan:
-- 1. Penambahan kolom items_detail dan extra_items pada tabel distributions (pengambilan multi-set & alat satuan)
-- 2. Memastikan tabel storage_climate_logs ada untuk monitoring suhu & kelembaban
-- 3. Memastikan kolom officer dan officer_signature ada pada dtt_distributions untuk Laporan Reuse DTT

ALTER TABLE `distributions`
  ADD COLUMN `items_detail` LONGTEXT DEFAULT NULL AFTER `quantity`,
  ADD COLUMN `extra_items` LONGTEXT DEFAULT NULL AFTER `items_detail`;

-- Pastikan kolom officer dan officer_signature ada pada dtt_distributions
ALTER TABLE `dtt_distributions`
  ADD COLUMN `officer` VARCHAR(100) DEFAULT NULL AFTER `tool_condition`,
  ADD COLUMN `officer_signature` TEXT DEFAULT NULL AFTER `officer`;

-- Sinkronkan data jika sebelumnya memakai nama kolom sender_name
UPDATE `dtt_distributions`
  SET `officer` = `sender_name`
  WHERE (`officer` IS NULL OR `officer` = '') AND `sender_name` IS NOT NULL;

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
