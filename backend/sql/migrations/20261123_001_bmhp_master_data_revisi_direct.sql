-- ============================================================================
-- CSSD SMART - RSUD Serpong Utara
-- Migration: 20261123_001_bmhp_master_data_revisi_direct.sql
-- Kompatibel 100% dengan phpMyAdmin / cPanel MariaDB & MySQL
-- (Tanpa DELIMITER $$, Tanpa Stored Procedure, Aman dijalankan berulang)
-- ============================================================================

-- ===== 1. TAMBAH KOLOM BARU DI bmhp_items (Master Data BMHP) =====
ALTER TABLE `bmhp_items`
  ADD COLUMN IF NOT EXISTS `nusp` VARCHAR(50) DEFAULT NULL AFTER `barcode`,
  ADD COLUMN IF NOT EXISTS `brand` VARCHAR(100) DEFAULT NULL AFTER `specification`,
  ADD COLUMN IF NOT EXISTS `manufacturer` VARCHAR(150) DEFAULT NULL AFTER `brand`,
  ADD COLUMN IF NOT EXISTS `default_supplier` VARCHAR(150) DEFAULT NULL AFTER `manufacturer`,
  ADD COLUMN IF NOT EXISTS `packaging_label` VARCHAR(50) DEFAULT NULL AFTER `unit_label`,
  ADD COLUMN IF NOT EXISTS `contents_per_package` INT DEFAULT NULL AFTER `packaging_label`,
  ADD COLUMN IF NOT EXISTS `account_code` VARCHAR(50) DEFAULT NULL AFTER `contents_per_package`,
  ADD COLUMN IF NOT EXISTS `default_budget_source` VARCHAR(50) DEFAULT NULL AFTER `account_code`,
  ADD COLUMN IF NOT EXISTS `default_fiscal_year` VARCHAR(10) DEFAULT NULL AFTER `default_budget_source`,
  ADD COLUMN IF NOT EXISTS `reference_price` DECIMAL(15,2) DEFAULT 0 AFTER `default_fiscal_year`,
  ADD COLUMN IF NOT EXISTS `storage_location` VARCHAR(100) DEFAULT NULL AFTER `reference_price`,
  ADD COLUMN IF NOT EXISTS `photo` VARCHAR(500) DEFAULT NULL AFTER `storage_location`;

-- ===== 2. TAMBAH KOLOM BARU DI bmhp_transactions (Transaksi Masuk & Keluar) =====
ALTER TABLE `bmhp_transactions`
  ADD COLUMN IF NOT EXISTS `supplier_name` VARCHAR(150) DEFAULT NULL AFTER `unit_name`,
  ADD COLUMN IF NOT EXISTS `po_number` VARCHAR(60) DEFAULT NULL AFTER `supplier_name`,
  ADD COLUMN IF NOT EXISTS `delivery_note` VARCHAR(60) DEFAULT NULL AFTER `po_number`,
  ADD COLUMN IF NOT EXISTS `invoice_number` VARCHAR(60) DEFAULT NULL AFTER `delivery_note`,
  ADD COLUMN IF NOT EXISTS `item_condition` VARCHAR(30) DEFAULT 'Baik' AFTER `invoice_number`,
  ADD COLUMN IF NOT EXISTS `storage_location` VARCHAR(100) DEFAULT NULL AFTER `item_condition`,
  ADD COLUMN IF NOT EXISTS `production_date` DATE DEFAULT NULL AFTER `storage_location`,
  ADD COLUMN IF NOT EXISTS `attachment_photos` LONGTEXT DEFAULT NULL AFTER `proof_image`,
  ADD COLUMN IF NOT EXISTS `verifier_signature` LONGTEXT DEFAULT NULL AFTER `officer_signature`,
  ADD COLUMN IF NOT EXISTS `verifier_name` VARCHAR(100) DEFAULT NULL AFTER `verifier_signature`,
  ADD COLUMN IF NOT EXISTS `handover_photo` LONGTEXT DEFAULT NULL AFTER `attachment_photos`;

-- ===== 3. BUAT TABEL MASTER PENDUKUNG (JIKA BELUM ADA) =====

-- Master Supplier / Penyedia
CREATE TABLE IF NOT EXISTS `bmhp_suppliers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `contact_person` VARCHAR(100) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `address` VARCHAR(500) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_supplier_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Kemasan
CREATE TABLE IF NOT EXISTS `bmhp_packaging_types` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_packaging_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Pabrik / Produsen
CREATE TABLE IF NOT EXISTS `bmhp_manufacturers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_manufacturer_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Kode Rekening Belanja
CREATE TABLE IF NOT EXISTS `bmhp_account_codes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Lokasi Penyimpanan
CREATE TABLE IF NOT EXISTS `bmhp_storage_locations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_storage_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Sumber Anggaran
CREATE TABLE IF NOT EXISTS `bmhp_budget_sources` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_source` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Tahun Anggaran
CREATE TABLE IF NOT EXISTS `bmhp_fiscal_years` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `year` VARCHAR(10) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fiscal_year` (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Unit Pemakai (Terkunci permanen ke Instalasi CSSD)
CREATE TABLE IF NOT EXISTS `bmhp_consumer_units` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL DEFAULT 'Instalasi CSSD',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_consumer_unit` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 4. DATA AWAL (INSERT IGNORE) =====
INSERT IGNORE INTO `bmhp_budget_sources` (`name`) VALUES ('BLUD'), ('APBD'), ('DAK'), ('BOK');
INSERT IGNORE INTO `bmhp_fiscal_years` (`year`) VALUES ('2023'), ('2024'), ('2025'), ('2026'), ('2027');
INSERT IGNORE INTO `bmhp_packaging_types` (`name`) VALUES ('Box'), ('Pack'), ('Dus'), ('Karton'), ('Roll'), ('Botol'), ('Pouch'), ('Sachet'), ('Tube');
INSERT IGNORE INTO `bmhp_storage_locations` (`name`) VALUES ('Gudang BMHP CSSD'), ('Rak A'), ('Rak B'), ('Rak C'), ('Lemari Penyimpanan');
INSERT IGNORE INTO `bmhp_consumer_units` (`name`) VALUES ('Instalasi CSSD');
INSERT IGNORE INTO `bmhp_account_codes` (`code`, `description`) VALUES ('5.1.02.01.01', 'Belanja BMHP');
