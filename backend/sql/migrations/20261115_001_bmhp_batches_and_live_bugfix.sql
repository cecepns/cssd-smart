-- ============================================================
-- CSSD SMART MIGRATION: BMHP Kelompok Anggaran & Batch + Live Bug Fix
-- Tanggal: 2026-11-15
-- ============================================================

-- 1. Perbaikan bug kolom dirty_receipts (Unknown column 'confirmed_at')
ALTER TABLE `dirty_receipts`
  ADD COLUMN IF NOT EXISTS `confirmed_at` DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `confirmed_by` VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `items_detail` LONGTEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `extra_items` LONGTEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `checklist_status` ENUM('Lengkap', 'Tidak Lengkap', 'Ada Kerusakan') DEFAULT 'Lengkap',
  ADD COLUMN IF NOT EXISTS `started_at` DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `unit_label` VARCHAR(50) NOT NULL DEFAULT 'Set';

-- 2. Pastikan tabel tahapan CSSD & DTT memiliki kolom started_at & completed_at
ALTER TABLE `washings` ADD COLUMN IF NOT EXISTS `started_at` DATETIME DEFAULT NULL, ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL;
ALTER TABLE `dryings` ADD COLUMN IF NOT EXISTS `started_at` DATETIME DEFAULT NULL, ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL;
ALTER TABLE `packagings` ADD COLUMN IF NOT EXISTS `started_at` DATETIME DEFAULT NULL, ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL;
ALTER TABLE `sterilizations` ADD COLUMN IF NOT EXISTS `started_at` DATETIME DEFAULT NULL, ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL;
ALTER TABLE `verifications` ADD COLUMN IF NOT EXISTS `started_at` DATETIME DEFAULT NULL, ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL;
ALTER TABLE `sterile_stock` ADD COLUMN IF NOT EXISTS `started_at` DATETIME DEFAULT NULL, ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL;
ALTER TABLE `distributions` ADD COLUMN IF NOT EXISTS `started_at` DATETIME DEFAULT NULL, ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL;
ALTER TABLE `dtt_receipts` ADD COLUMN IF NOT EXISTS `started_at` DATETIME DEFAULT NULL, ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL;
ALTER TABLE `dtt_distributions` ADD COLUMN IF NOT EXISTS `started_at` DATETIME DEFAULT NULL, ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL;

-- 3. Tabel Batch & Kelompok Anggaran BMHP (Tahun Anggaran & Sumber Dana Terpisah)
CREATE TABLE IF NOT EXISTS `bmhp_batches` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `bmhp_item_id` INT UNSIGNED NOT NULL,
  `fiscal_year` VARCHAR(10) NOT NULL DEFAULT '2026',
  `budget_source` VARCHAR(50) NOT NULL DEFAULT 'BLUD',
  `batch_no` VARCHAR(50) NOT NULL,
  `expiry_date` DATE DEFAULT NULL,
  `initial_stock` INT NOT NULL DEFAULT 0,
  `stock` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batch_item` (`bmhp_item_id`),
  KEY `idx_batch_group` (`bmhp_item_id`, `fiscal_year`, `budget_source`, `batch_no`),
  CONSTRAINT `fk_bmhp_batches_item` FOREIGN KEY (`bmhp_item_id`) REFERENCES `bmhp_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Penambahan kolom pada bmhp_transactions untuk keperluan alur BMHP terpadu
ALTER TABLE `bmhp_transactions`
  ADD COLUMN IF NOT EXISTS `fiscal_year` VARCHAR(10) DEFAULT '2026',
  ADD COLUMN IF NOT EXISTS `budget_source` VARCHAR(50) DEFAULT 'BLUD',
  ADD COLUMN IF NOT EXISTS `batch_id` INT UNSIGNED DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `purpose` VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `proof_image` LONGTEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `officer_signature` LONGTEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `unit_name` VARCHAR(100) DEFAULT 'Instalasi CSSD',
  ADD COLUMN IF NOT EXISTS `trx_time` VARCHAR(20) DEFAULT NULL;
