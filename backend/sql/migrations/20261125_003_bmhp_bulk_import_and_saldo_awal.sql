-- =========================================================================================
-- MIGRATION: BMHP BULK IMPORT EXCEL & TRANSAKSI KHUSUS SALDO AWAL
-- Tanggal: 25 November 2026
-- Database: MySQL / MariaDB (Kompatibel phpMyAdmin cPanel)
-- =========================================================================================

-- 1. Pastikan kolom type pada bmhp_transactions mendukung 'SALDO_AWAL'
ALTER TABLE `bmhp_transactions` MODIFY COLUMN `type` VARCHAR(30) NOT NULL DEFAULT 'MASUK';

-- 2. Pastikan kolom doc_number dan doc_type ada pada bmhp_transactions
ALTER TABLE `bmhp_transactions` ADD COLUMN IF NOT EXISTS `doc_number` VARCHAR(60) DEFAULT NULL AFTER `type`;
ALTER TABLE `bmhp_transactions` ADD COLUMN IF NOT EXISTS `doc_type` VARCHAR(30) DEFAULT NULL AFTER `doc_number`;
ALTER TABLE `bmhp_transactions` ADD COLUMN IF NOT EXISTS `ref_transaction_id` INT UNSIGNED DEFAULT NULL AFTER `doc_type`;
ALTER TABLE `bmhp_transactions` ADD COLUMN IF NOT EXISTS `correction_reason` VARCHAR(255) DEFAULT NULL AFTER `notes`;
ALTER TABLE `bmhp_transactions` ADD COLUMN IF NOT EXISTS `receiver_name` VARCHAR(100) DEFAULT NULL AFTER `officer`;

-- 3. Pastikan kolom metadata barang ada pada bmhp_items
ALTER TABLE `bmhp_items` ADD COLUMN IF NOT EXISTS `brand` VARCHAR(100) DEFAULT NULL AFTER `is_active`;
ALTER TABLE `bmhp_items` ADD COLUMN IF NOT EXISTS `manufacturer` VARCHAR(150) DEFAULT NULL AFTER `brand`;
ALTER TABLE `bmhp_items` ADD COLUMN IF NOT EXISTS `packaging_label` VARCHAR(50) DEFAULT NULL AFTER `manufacturer`;
ALTER TABLE `bmhp_items` ADD COLUMN IF NOT EXISTS `contents_per_package` INT DEFAULT 1 AFTER `packaging_label`;
ALTER TABLE `bmhp_items` ADD COLUMN IF NOT EXISTS `account_code` VARCHAR(50) DEFAULT NULL AFTER `contents_per_package`;
ALTER TABLE `bmhp_items` ADD COLUMN IF NOT EXISTS `storage_location` VARCHAR(100) DEFAULT NULL AFTER `account_code`;

-- 4. Indeks untuk mempercepat mapping batch BMHP
ALTER TABLE `bmhp_batches` ADD INDEX IF NOT EXISTS `idx_bmhp_batch_lookup` (`bmhp_item_id`, `fiscal_year`, `budget_source`, `batch_no`);
