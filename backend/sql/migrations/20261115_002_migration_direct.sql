-- =============================================================================
-- CSSD SMART - MIGRATION DIRECT SQL (PILIHAN 2: TANPA STORED PROCEDURE)
-- File    : 20261115_002_migration_direct.sql
-- Support : Bisa langsung di-copy-paste ke Tab SQL phpMyAdmin maupun di-upload
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tambah kolom bug fix penerimaan alat kotor pada dirty_receipts
ALTER TABLE `dirty_receipts`
  ADD `confirmed_at` DATETIME DEFAULT NULL,
  ADD `confirmed_by` VARCHAR(100) DEFAULT NULL,
  ADD `items_detail` LONGTEXT DEFAULT NULL,
  ADD `extra_items` LONGTEXT DEFAULT NULL,
  ADD `checklist_status` ENUM('Lengkap', 'Tidak Lengkap', 'Ada Kerusakan') DEFAULT 'Lengkap';

-- 2. Buat tabel kelompok anggaran & batch BMHP
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

-- 3. Tambah kolom alur BMHP terpadu & harga satuan/total pada bmhp_transactions
ALTER TABLE `bmhp_transactions`
  ADD `fiscal_year` VARCHAR(10) DEFAULT '2026',
  ADD `budget_source` VARCHAR(50) DEFAULT 'BLUD',
  ADD `batch_id` INT UNSIGNED DEFAULT NULL,
  ADD `unit_price` DECIMAL(15,2) DEFAULT 0,
  ADD `total_price` DECIMAL(15,2) DEFAULT 0,
  ADD `purpose` VARCHAR(255) DEFAULT NULL,
  ADD `proof_image` LONGTEXT DEFAULT NULL,
  ADD `officer_signature` LONGTEXT DEFAULT NULL,
  ADD `unit_name` VARCHAR(100) DEFAULT 'Instalasi CSSD',
  ADD `trx_time` VARCHAR(20) DEFAULT NULL;

-- 4. Pastikan unit Instalasi CSSD terdaftar di Master Data units
INSERT INTO `units` (`code`, `name`, `pic_name`, `phone`, `is_active`)
SELECT 'CSSD', 'Instalasi CSSD', 'Kepala Instalasi CSSD', '081200000007', 1
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `code` = 'CSSD' OR `name` LIKE '%CSSD%');

-- 5. Nonaktifkan Kassa & Linen dari Master BMHP jika ada data lama
UPDATE `bmhp_items` SET `is_active` = 0 
WHERE `category` LIKE '%Kassa%' OR `category` LIKE '%Linen%' OR `name` LIKE '%Kassa%' OR `name` LIKE '%Linen%';

-- 6. Seed batch sample awal untuk BMHP Flat Roll Pouch jika belum ada
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
