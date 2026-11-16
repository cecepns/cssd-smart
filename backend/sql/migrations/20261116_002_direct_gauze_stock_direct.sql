-- =============================================================================
-- CSSD SMART - MIGRATION DIRECT SQL (PILIHAN 2: TANPA STORED PROCEDURE)
-- File    : 20261116_002_direct_gauze_stock_direct.sql
-- Support : Bisa langsung di-copy-paste ke Tab SQL phpMyAdmin (cPanel)
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Izinkan packaging_id bernilai NULL pada sterile_stock
ALTER TABLE `sterile_stock` MODIFY COLUMN `packaging_id` INT UNSIGNED NULL;

-- 2. Tambah kolom unit_id, officer, dan notes jika belum ada
ALTER TABLE `sterile_stock`
  ADD `unit_id` INT UNSIGNED DEFAULT NULL AFTER `expiry_date`,
  ADD `officer` VARCHAR(100) DEFAULT NULL AFTER `unit_label`,
  ADD `notes` VARCHAR(500) DEFAULT NULL AFTER `officer`;

SET FOREIGN_KEY_CHECKS = 1;
