-- ============================================================
-- Migration: Penambahan Field Lengkap Data Barang BMHP & Expiry Date
-- Tanggal: 2026-11-03
-- ============================================================

ALTER TABLE `bmhp_items`
  ADD COLUMN `category` VARCHAR(100) DEFAULT 'Kemasan Steril' AFTER `name`,
  ADD COLUMN `item_type` VARCHAR(100) DEFAULT NULL AFTER `category`,
  ADD COLUMN `specification` VARCHAR(255) DEFAULT NULL AFTER `item_type`,
  ADD COLUMN `package_volume` VARCHAR(100) DEFAULT NULL AFTER `unit_label`,
  ADD COLUMN `initial_stock` INT NOT NULL DEFAULT 0 AFTER `package_volume`,
  ADD COLUMN `batch_no` VARCHAR(50) DEFAULT NULL AFTER `min_stock`,
  ADD COLUMN `expiry_date` DATE DEFAULT NULL AFTER `batch_no`;

ALTER TABLE `bmhp_transactions`
  ADD COLUMN `expiry_date` DATE DEFAULT NULL AFTER `batch_no`;

