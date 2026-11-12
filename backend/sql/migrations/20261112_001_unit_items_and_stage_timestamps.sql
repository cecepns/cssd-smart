-- ============================================================
-- CSSD SMART - MIGRATION SCRIPT
-- File: backend/sql/migrations/20261112_001_unit_items_and_stage_timestamps.sql
-- Tanggal: 2026-11-12
--
-- Pembaruan:
-- 1. Pemisahan Master Data Alat (`items`) berdasarkan Unit Asal (`unit_id`)
-- 2. Pencatatan jam mulai (`started_at`) dan jam selesai (`completed_at`) otomatis
--    pada seluruh tahapan proses CSSD & DTT untuk laporan lama proses & waktu tunggu
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

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

-- 1. Master Alat berdasarkan Unit Asal
CALL `AddColIfNotExist`('items', 'unit_id', 'INT UNSIGNED DEFAULT NULL AFTER `id`');

SET @idx_items_unit = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'items' AND index_name = 'idx_items_unit_id'
);
SET @sql_items_unit_idx = IF(@idx_items_unit = 0, 'ALTER TABLE `items` ADD KEY `idx_items_unit_id` (`unit_id`)', 'SELECT 1');
PREPARE stmt FROM @sql_items_unit_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_items_unit = (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'items' AND constraint_name = 'fk_items_unit'
);
SET @sql_items_unit_fk = IF(
  @fk_items_unit = 0,
  'ALTER TABLE `items` ADD CONSTRAINT `fk_items_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_items_unit_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Jam Mulai (started_at) & Jam Selesai (completed_at) di seluruh tahapan CSSD & DTT
CALL `AddColIfNotExist`('dirty_receipts', 'started_at', 'DATETIME NULL AFTER `receipt_date`');
CALL `AddColIfNotExist`('dirty_receipts', 'completed_at', 'DATETIME NULL AFTER `started_at`');

CALL `AddColIfNotExist`('washings', 'started_at', 'DATETIME NULL AFTER `wash_date`');
CALL `AddColIfNotExist`('washings', 'completed_at', 'DATETIME NULL AFTER `started_at`');

CALL `AddColIfNotExist`('dryings', 'started_at', 'DATETIME NULL AFTER `dry_date`');
CALL `AddColIfNotExist`('dryings', 'completed_at', 'DATETIME NULL AFTER `started_at`');

CALL `AddColIfNotExist`('packagings', 'started_at', 'DATETIME NULL AFTER `pack_date`');
CALL `AddColIfNotExist`('packagings', 'completed_at', 'DATETIME NULL AFTER `started_at`');

CALL `AddColIfNotExist`('sterilizations', 'started_at', 'DATETIME NULL AFTER `steril_date`');
CALL `AddColIfNotExist`('sterilizations', 'completed_at', 'DATETIME NULL AFTER `started_at`');

CALL `AddColIfNotExist`('verifications', 'started_at', 'DATETIME NULL AFTER `verify_date`');
CALL `AddColIfNotExist`('verifications', 'completed_at', 'DATETIME NULL AFTER `started_at`');

CALL `AddColIfNotExist`('sterile_stock', 'started_at', 'DATETIME NULL AFTER `sterile_date`');
CALL `AddColIfNotExist`('sterile_stock', 'completed_at', 'DATETIME NULL AFTER `started_at`');

CALL `AddColIfNotExist`('distributions', 'started_at', 'DATETIME NULL AFTER `dist_date`');
CALL `AddColIfNotExist`('distributions', 'completed_at', 'DATETIME NULL AFTER `started_at`');

CALL `AddColIfNotExist`('dtt_receipts', 'started_at', 'DATETIME NULL AFTER `receipt_datetime`');
CALL `AddColIfNotExist`('dtt_receipts', 'completed_at', 'DATETIME NULL AFTER `started_at`');

CALL `AddColIfNotExist`('dtt_distributions', 'started_at', 'DATETIME NULL AFTER `dist_datetime`');
CALL `AddColIfNotExist`('dtt_distributions', 'completed_at', 'DATETIME NULL AFTER `started_at`');

-- Backfill data lama yang belum memiliki started_at / completed_at agar laporan & ketertelusuran tetap terisi
UPDATE `dirty_receipts` SET `started_at` = COALESCE(`started_at`, `created_at`), `completed_at` = COALESCE(`completed_at`, `created_at`) WHERE `started_at` IS NULL OR `completed_at` IS NULL;
UPDATE `washings` SET `started_at` = COALESCE(`started_at`, `created_at`), `completed_at` = COALESCE(`completed_at`, `created_at`) WHERE `started_at` IS NULL OR `completed_at` IS NULL;
UPDATE `dryings` SET `started_at` = COALESCE(`started_at`, `created_at`), `completed_at` = COALESCE(`completed_at`, `created_at`) WHERE `started_at` IS NULL OR `completed_at` IS NULL;
UPDATE `packagings` SET `started_at` = COALESCE(`started_at`, `created_at`), `completed_at` = COALESCE(`completed_at`, `created_at`) WHERE `started_at` IS NULL OR `completed_at` IS NULL;
UPDATE `sterilizations` SET `started_at` = COALESCE(`started_at`, `created_at`), `completed_at` = COALESCE(`completed_at`, `created_at`) WHERE `started_at` IS NULL OR `completed_at` IS NULL;
UPDATE `verifications` SET `started_at` = COALESCE(`started_at`, `created_at`), `completed_at` = COALESCE(`completed_at`, `created_at`) WHERE `started_at` IS NULL OR `completed_at` IS NULL;
UPDATE `sterile_stock` SET `started_at` = COALESCE(`started_at`, `created_at`) WHERE `started_at` IS NULL;
UPDATE `distributions` SET `started_at` = COALESCE(`started_at`, `created_at`), `completed_at` = COALESCE(`completed_at`, `created_at`) WHERE `started_at` IS NULL OR `completed_at` IS NULL;
UPDATE `dtt_receipts` SET `started_at` = COALESCE(`started_at`, `receipt_datetime`, `created_at`), `completed_at` = COALESCE(`completed_at`, `created_at`) WHERE `started_at` IS NULL OR `completed_at` IS NULL;
UPDATE `dtt_distributions` SET `started_at` = COALESCE(`started_at`, `dist_datetime`, `created_at`), `completed_at` = COALESCE(`completed_at`, `created_at`) WHERE `started_at` IS NULL OR `completed_at` IS NULL;

DROP PROCEDURE IF EXISTS `AddColIfNotExist`;

SET FOREIGN_KEY_CHECKS = 1;

