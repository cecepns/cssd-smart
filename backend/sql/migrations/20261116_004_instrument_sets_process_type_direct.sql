-- =============================================================================
-- CSSD SMART - MIGRATION DIRECT SQL (PILIHAN 2: TANPA STORED PROCEDURE)
-- File    : 20261116_004_instrument_sets_process_type_direct.sql
-- Support : Bisa langsung di-copy-paste ke Tab SQL phpMyAdmin (cPanel)
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tambah kolom process_type pada instrument_sets
ALTER TABLE `instrument_sets`
  ADD `process_type` ENUM('Steril', 'DTT') NOT NULL DEFAULT 'Steril' AFTER `name`,
  ADD INDEX `idx_instrument_sets_process_type` (`process_type`);

-- 2. Update otomatis set instrumen yang namanya mengandung kata 'DTT'
UPDATE `instrument_sets` 
SET `process_type` = 'DTT' 
WHERE `name` LIKE '%DTT%' OR `code` LIKE '%DTT%';

-- 3. Sinkronkan kategori ke tabel items untuk set DTT
UPDATE `items` 
SET `process_type` = 'DTT' 
WHERE `name` LIKE '%DTT%' OR `code` LIKE '%DTT%' OR `name` LIKE '%SIRKUIT%';

SET FOREIGN_KEY_CHECKS = 1;
