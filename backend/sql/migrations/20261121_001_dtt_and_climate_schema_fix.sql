-- ============================================================
-- CSSD SMART - RSUD Serpong Utara
-- Migration: 20261121_001_dtt_and_climate_schema_fix.sql
-- Fix: Missing DTT columns & Storage Climate Monitoring schema
-- Idempotent: Aman dieksekusi berkali-kali tanpa error #1060
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. Helper Stored Procedure: Cek kolom sebelum ADD COLUMN
--    (Mencegah error #1060 Duplicate Column di MySQL / MariaDB)
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS `AddColSafe`;
DELIMITER $$
CREATE PROCEDURE `AddColSafe`(
    IN in_table_name VARCHAR(64),
    IN in_col_name VARCHAR(64),
    IN in_col_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = in_table_name 
          AND COLUMN_NAME = in_col_name
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', in_table_name, '` ADD `', in_col_name, '` ', in_col_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- ------------------------------------------------------------
-- 2. Pastikan seluruh kolom pada dtt_receipts tersedia
-- ------------------------------------------------------------
CALL AddColSafe('dtt_receipts', 'item_code', 'VARCHAR(50) DEFAULT NULL');
CALL AddColSafe('dtt_receipts', 'item_name', 'VARCHAR(150) NOT NULL DEFAULT ""');
CALL AddColSafe('dtt_receipts', 'quantity', 'INT UNSIGNED NOT NULL DEFAULT 1');
CALL AddColSafe('dtt_receipts', 'unit_label', "VARCHAR(30) NOT NULL DEFAULT 'pcs'");
CALL AddColSafe('dtt_receipts', 'reuse_count', 'INT UNSIGNED NOT NULL DEFAULT 1');
CALL AddColSafe('dtt_receipts', 'max_reuse_limit', 'INT UNSIGNED NOT NULL DEFAULT 4');
CALL AddColSafe('dtt_receipts', 'tool_condition', "ENUM('Baik', 'Perlu Perbaikan', 'Rusak / Afkir') NOT NULL DEFAULT 'Baik'");
CALL AddColSafe('dtt_receipts', 'sender_name', 'VARCHAR(100) NOT NULL DEFAULT ""');
CALL AddColSafe('dtt_receipts', 'sender_signature', 'TEXT DEFAULT NULL');
CALL AddColSafe('dtt_receipts', 'receiver_name', 'VARCHAR(100) NOT NULL DEFAULT ""');
CALL AddColSafe('dtt_receipts', 'receiver_signature', 'TEXT DEFAULT NULL');
CALL AddColSafe('dtt_receipts', 'proof_image', 'LONGTEXT DEFAULT NULL');
CALL AddColSafe('dtt_receipts', 'process_stage', "ENUM('Diterima', 'Pencucian DTT', 'Penyimpanan DTT', 'Siap Distribusi', 'Selesai') NOT NULL DEFAULT 'Diterima'");
CALL AddColSafe('dtt_receipts', 'dtt_method', "VARCHAR(100) DEFAULT 'DTT Manual (Perendaman Enzimatik & Disinfektan Tingkat Tinggi)'");
CALL AddColSafe('dtt_receipts', 'dtt_liquid', "VARCHAR(100) DEFAULT 'Glutaraldehyde 2%'");
CALL AddColSafe('dtt_receipts', 'dtt_duration_min', 'INT UNSIGNED DEFAULT 20');
CALL AddColSafe('dtt_receipts', 'verification_result', "ENUM('Belum Diverifikasi', 'Lolos', 'Gagal / Cuci Ulang') NOT NULL DEFAULT 'Belum Diverifikasi'");
CALL AddColSafe('dtt_receipts', 'notes', 'TEXT DEFAULT NULL');
CALL AddColSafe('dtt_receipts', 'started_at', 'DATETIME DEFAULT NULL');
CALL AddColSafe('dtt_receipts', 'completed_at', 'DATETIME DEFAULT NULL');

-- ------------------------------------------------------------
-- 3. Pastikan seluruh kolom pada dtt_distributions tersedia
-- ------------------------------------------------------------
CALL AddColSafe('dtt_distributions', 'dtt_receipt_id', 'INT UNSIGNED DEFAULT NULL');
CALL AddColSafe('dtt_distributions', 'item_name', 'VARCHAR(150) NOT NULL DEFAULT ""');
CALL AddColSafe('dtt_distributions', 'quantity', 'INT UNSIGNED NOT NULL DEFAULT 1');
CALL AddColSafe('dtt_distributions', 'unit_label', "VARCHAR(30) NOT NULL DEFAULT 'pcs'");
CALL AddColSafe('dtt_distributions', 'reuse_count', 'INT UNSIGNED NOT NULL DEFAULT 1');
CALL AddColSafe('dtt_distributions', 'tool_condition', "ENUM('Baik', 'Perlu Perbaikan', 'Rusak / Afkir') NOT NULL DEFAULT 'Baik'");
CALL AddColSafe('dtt_distributions', 'officer', 'VARCHAR(100) DEFAULT NULL');
CALL AddColSafe('dtt_distributions', 'officer_signature', 'TEXT DEFAULT NULL');
CALL AddColSafe('dtt_distributions', 'receiver_name', 'VARCHAR(100) NOT NULL DEFAULT ""');
CALL AddColSafe('dtt_distributions', 'receiver_signature', 'TEXT DEFAULT NULL');
CALL AddColSafe('dtt_distributions', 'proof_image', 'LONGTEXT DEFAULT NULL');
CALL AddColSafe('dtt_distributions', 'notes', 'TEXT DEFAULT NULL');
CALL AddColSafe('dtt_distributions', 'started_at', 'DATETIME DEFAULT NULL');
CALL AddColSafe('dtt_distributions', 'completed_at', 'DATETIME DEFAULT NULL');

-- Modifikasi dtt_receipt_id agar boleh NULL
ALTER TABLE `dtt_distributions` MODIFY COLUMN `dtt_receipt_id` INT UNSIGNED DEFAULT NULL;

-- Backfill legacy officer column di dtt_distributions jika ada data lama
UPDATE `dtt_distributions` SET `officer` = `sender_name` WHERE (`officer` IS NULL OR `officer` = '') AND `sender_name` IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Tabel Pemantauan Suhu & Kelembaban Ruangan CSSD
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 5. Bersihkan Stored Procedure Helper
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS `AddColSafe`;

SET FOREIGN_KEY_CHECKS = 1;
