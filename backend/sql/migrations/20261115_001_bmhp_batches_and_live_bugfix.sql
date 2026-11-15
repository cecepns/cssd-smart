-- =============================================================================
-- CSSD SMART - MIGRATION SCRIPT UNTUK DATABASE LIVE (cPanel / phpMyAdmin)
-- File    : 20261115_001_bmhp_batches_and_live_bugfix.sql
-- Support : MySQL 5.7+, MySQL 8.0+, MariaDB 10.x+
-- Fitur   : Idempotent (Aman diupload 1x maupun berulang kali tanpa error 1060/1064)
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Helper Stored Procedure: Tambah kolom hanya jika belum ada di tabel
--    (Mencegah error #1060 Duplicate Column dan #1064 Syntax Error di MySQL)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2. Perbaikan bug kolom dirty_receipts (Unknown column 'confirmed_at')
-- -----------------------------------------------------------------------------
CALL AddColSafe('dirty_receipts', 'confirmed_at', 'DATETIME DEFAULT NULL');
CALL AddColSafe('dirty_receipts', 'confirmed_by', 'VARCHAR(100) DEFAULT NULL');
CALL AddColSafe('dirty_receipts', 'items_detail', 'LONGTEXT DEFAULT NULL');
CALL AddColSafe('dirty_receipts', 'extra_items', 'LONGTEXT DEFAULT NULL');
CALL AddColSafe('dirty_receipts', 'checklist_status', "ENUM('Lengkap', 'Tidak Lengkap', 'Ada Kerusakan') DEFAULT 'Lengkap'");

-- -----------------------------------------------------------------------------
-- 3. Tabel Batch & Kelompok Anggaran BMHP (Tahun Anggaran & Sumber Dana Terpisah)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bmhp_batches` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `bmhp_item_id` INT UNSIGNED NOT NULL,
  `fiscal_year` VARCHAR(10) NOT NULL DEFAULT '2026',
  `budget_source` VARCHAR(50) NOT NULL DEFAULT 'BLUD',
  `batch_no` VARCHAR(50) NOT NULL,
  `expiry_date` DATE DEFAULT NULL,
  `initial_stock` INT NOT NULL DEFAULT 0,
  `stock` INT NOT NULL DEFAULT 0,
  `unit_price` DECIMAL(15,2) DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batch_item` (`bmhp_item_id`),
  KEY `idx_batch_group` (`bmhp_item_id`, `fiscal_year`, `budget_source`, `batch_no`),
  CONSTRAINT `fk_bmhp_batches_item` FOREIGN KEY (`bmhp_item_id`) REFERENCES `bmhp_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL AddColSafe('bmhp_batches', 'unit_price', 'DECIMAL(15,2) DEFAULT 0');

-- -----------------------------------------------------------------------------
-- 4. Penambahan kolom pada bmhp_transactions untuk alur BMHP terpadu & harga
-- -----------------------------------------------------------------------------
CALL AddColSafe('bmhp_transactions', 'fiscal_year', "VARCHAR(10) DEFAULT '2026'");
CALL AddColSafe('bmhp_transactions', 'budget_source', "VARCHAR(50) DEFAULT 'BLUD'");
CALL AddColSafe('bmhp_transactions', 'batch_id', 'INT UNSIGNED DEFAULT NULL');
CALL AddColSafe('bmhp_transactions', 'unit_price', 'DECIMAL(15,2) DEFAULT 0');
CALL AddColSafe('bmhp_transactions', 'total_price', 'DECIMAL(15,2) DEFAULT 0');
CALL AddColSafe('bmhp_transactions', 'purpose', 'VARCHAR(255) DEFAULT NULL');
CALL AddColSafe('bmhp_transactions', 'proof_image', 'LONGTEXT DEFAULT NULL');
CALL AddColSafe('bmhp_transactions', 'officer_signature', 'LONGTEXT DEFAULT NULL');
CALL AddColSafe('bmhp_transactions', 'unit_name', "VARCHAR(100) DEFAULT 'Instalasi CSSD'");
CALL AddColSafe('bmhp_transactions', 'trx_time', 'VARCHAR(20) DEFAULT NULL');

-- Hapus stored procedure pembantu setelah migrasi kolom selesai
DROP PROCEDURE IF EXISTS `AddColSafe`;

-- -----------------------------------------------------------------------------
-- 5. Master Data Unit: Pastikan 'Instalasi CSSD' terdaftar untuk kebutuhan internal
-- -----------------------------------------------------------------------------
INSERT INTO `units` (`code`, `name`, `pic_name`, `phone`, `is_active`)
SELECT 'CSSD', 'Instalasi CSSD', 'Kepala Instalasi CSSD', '081200000007', 1
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `code` = 'CSSD' OR `name` LIKE '%CSSD%');

-- -----------------------------------------------------------------------------
-- 6. Nonaktifkan Kassa & Linen dari Master BMHP jika ada data lama
-- -----------------------------------------------------------------------------
UPDATE `bmhp_items` SET `is_active` = 0 
WHERE `category` LIKE '%Kassa%' OR `category` LIKE '%Linen%' OR `name` LIKE '%Kassa%' OR `name` LIKE '%Linen%';

-- -----------------------------------------------------------------------------
-- 7. Seed sample batch awal untuk Sterilization Flat Roll Pouch (BMHP-POUCH-01)
-- -----------------------------------------------------------------------------
INSERT INTO `bmhp_batches` (`bmhp_item_id`, `fiscal_year`, `budget_source`, `batch_no`, `expiry_date`, `initial_stock`, `stock`, `unit_price`)
SELECT i.id, '2026', 'BLUD', 'BATCH-001', '2029-04-30', 100, 140, 50000
FROM `bmhp_items` i
WHERE (i.code = 'BMHP-POUCH-01' OR i.name LIKE '%Flat Roll Pouch%')
  AND NOT EXISTS (SELECT 1 FROM `bmhp_batches` b WHERE b.bmhp_item_id = i.id AND b.batch_no = 'BATCH-001')
LIMIT 1;

INSERT INTO `bmhp_batches` (`bmhp_item_id`, `fiscal_year`, `budget_source`, `batch_no`, `expiry_date`, `initial_stock`, `stock`, `unit_price`)
SELECT i.id, '2026', 'APBD', 'BATCH-002', '2029-06-30', 100, 100, 50000
FROM `bmhp_items` i
WHERE (i.code = 'BMHP-POUCH-01' OR i.name LIKE '%Flat Roll Pouch%')
  AND NOT EXISTS (SELECT 1 FROM `bmhp_batches` b WHERE b.bmhp_item_id = i.id AND b.batch_no = 'BATCH-002')
LIMIT 1;

INSERT INTO `bmhp_batches` (`bmhp_item_id`, `fiscal_year`, `budget_source`, `batch_no`, `expiry_date`, `initial_stock`, `stock`, `unit_price`)
SELECT i.id, '2025', 'BLUD', 'BATCH-010', '2028-12-31', 40, 40, 45000
FROM `bmhp_items` i
WHERE (i.code = 'BMHP-POUCH-01' OR i.name LIKE '%Flat Roll Pouch%')
  AND NOT EXISTS (SELECT 1 FROM `bmhp_batches` b WHERE b.bmhp_item_id = i.id AND b.batch_no = 'BATCH-010')
LIMIT 1;

SET FOREIGN_KEY_CHECKS = 1;
