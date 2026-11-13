-- ============================================================
-- CSSD SMART - Sterile Management System
-- RSU Serpong Utara
-- Database export (MySQL 8+ / MariaDB 10.4+)
-- Import: mysql -u root -p < sql/database.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS `cssd_smart` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cssd_smart`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `bmhp_transactions`;
DROP TABLE IF EXISTS `bmhp_items`;
DROP TABLE IF EXISTS `activity_notifications`;
DROP TABLE IF EXISTS `machine_usage_logs`;
DROP TABLE IF EXISTS `unit_requisitions`;
DROP TABLE IF EXISTS `item_proposals`;
DROP TABLE IF EXISTS `distributions`;
DROP TABLE IF EXISTS `quarantines`;
DROP TABLE IF EXISTS `sterile_stock`;
DROP TABLE IF EXISTS `verifications`;
DROP TABLE IF EXISTS `sterilization_items`;
DROP TABLE IF EXISTS `sterilizations`;
DROP TABLE IF EXISTS `packagings`;
DROP TABLE IF EXISTS `dryings`;
DROP TABLE IF EXISTS `washings`;
DROP TABLE IF EXISTS `dirty_receipts`;
DROP TABLE IF EXISTS `machines`;
DROP TABLE IF EXISTS `items`;
DROP TABLE IF EXISTS `dtt_distributions`;
DROP TABLE IF EXISTS `dtt_receipts`;
DROP TABLE IF EXISTS `item_units`;
DROP TABLE IF EXISTS `distributions`;
DROP TABLE IF EXISTS `quarantines`;
DROP TABLE IF EXISTS `sterile_stock`;
DROP TABLE IF EXISTS `verifications`;
DROP TABLE IF EXISTS `sterilization_items`;
DROP TABLE IF EXISTS `sterilizations`;
DROP TABLE IF EXISTS `packagings`;
DROP TABLE IF EXISTS `dryings`;
DROP TABLE IF EXISTS `washings`;
DROP TABLE IF EXISTS `dirty_receipts`;
DROP TABLE IF EXISTS `instrument_discrepancy_logs`;
DROP TABLE IF EXISTS `instrument_set_items`;
DROP TABLE IF EXISTS `instrument_sets`;
DROP TABLE IF EXISTS `bmhp_transactions`;
DROP TABLE IF EXISTS `bmhp_items`;
DROP TABLE IF EXISTS `packaging_materials`;
DROP TABLE IF EXISTS `officers`;
DROP TABLE IF EXISTS `machines`;
DROP TABLE IF EXISTS `items`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `units`;
DROP TABLE IF EXISTS `counters`;

-- ------------------------------------------------------------
-- Counters (penomoran otomatis barcode / siklus)
-- ------------------------------------------------------------
CREATE TABLE `counters` (
  `name` VARCHAR(50) NOT NULL,
  `counter_date` DATE NOT NULL,
  `value` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`name`, `counter_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Master data: Unit Rumah Sakit
-- ------------------------------------------------------------
CREATE TABLE `units` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `pic_name` VARCHAR(100) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_units_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Master data: Satuan (Item Units)
-- ------------------------------------------------------------
CREATE TABLE `item_units` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `category` ENUM('Semua', 'Steril', 'DTT') NOT NULL DEFAULT 'Semua',
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_item_units_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Users (akun admin dibuat otomatis oleh server saat pertama jalan)
-- Role: admin (Akses penuh), petugas (Petugas CSSD), unit (Petugas Unit Luar)
-- ------------------------------------------------------------
CREATE TABLE `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin','petugas','unit') NOT NULL DEFAULT 'petugas',
  `unit_id` INT UNSIGNED DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  KEY `idx_users_unit_id` (`unit_id`),
  CONSTRAINT `fk_users_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `unit_id` INT UNSIGNED DEFAULT NULL,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `process_type` ENUM('Steril','DTT') NOT NULL DEFAULT 'Steril',
  `category` ENUM('Alat Satuan','Set Instrumen','Duk & Jas Operasi','Kasa Steril') NOT NULL,
  `unit_label` VARCHAR(50) NOT NULL DEFAULT 'Set',
  `shelf_life_months` TINYINT UNSIGNED NOT NULL DEFAULT 6,
  `photo` VARCHAR(255) DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_items_code` (`code`),
  KEY `idx_items_unit_id` (`unit_id`),
  KEY `idx_items_process_type` (`process_type`),
  CONSTRAINT `fk_items_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `machines` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(10) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_machines_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `officers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nip` VARCHAR(50) DEFAULT NULL,
  `name` VARCHAR(100) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'Petugas CSSD',
  `phone` VARCHAR(30) DEFAULT NULL,
  `signature` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_officers_active` (`is_active`),
  KEY `idx_officers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `packaging_materials` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pkg_mat_code` (`code`),
  KEY `idx_pkg_mat_name` (`name`),
  KEY `idx_pkg_mat_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `instrument_sets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `completeness_status` ENUM('Lengkap','Tidak Lengkap') NOT NULL DEFAULT 'Lengkap',
  `missing_notes` VARCHAR(255) DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_instrument_sets_code` (`code`),
  KEY `idx_instrument_sets_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `instrument_set_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `set_id` INT UNSIGNED NOT NULL,
  `instrument_name` VARCHAR(150) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'Buah',
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_set_items_set_id` (`set_id`),
  CONSTRAINT `fk_set_items_set` FOREIGN KEY (`set_id`) REFERENCES `instrument_sets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `instrument_discrepancy_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `set_id` INT UNSIGNED NOT NULL,
  `instrument_name` VARCHAR(150) NOT NULL,
  `incident_type` ENUM('Kurang', 'Hilang', 'Rusak', 'Ditemukan Kembali', 'Diganti Baru') NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_origin` VARCHAR(100) DEFAULT NULL,
  `officer` VARCHAR(100) NOT NULL,
  `incident_date` DATE NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `resolution_status` ENUM('Belum Selesai', 'Selesai') NOT NULL DEFAULT 'Belum Selesai',
  `resolution_notes` TEXT DEFAULT NULL,
  `resolved_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_disc_set_id` (`set_id`),
  KEY `idx_disc_status` (`resolution_status`),
  CONSTRAINT `fk_disc_set` FOREIGN KEY (`set_id`) REFERENCES `instrument_sets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tahap 1 - Alat Kotor Masuk (BARCODE)
-- stage: 1 diterima, 2 dicuci, 3 dikeringkan, 4 dikemas, 5 disterilkan, 6 diverifikasi
-- ------------------------------------------------------------
CREATE TABLE `dirty_receipts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `barcode` VARCHAR(50) NOT NULL,
  `receipt_date` DATE NOT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `item_id` INT UNSIGNED DEFAULT NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'set',
  `sender_name` VARCHAR(100) NOT NULL,
  `sender_signature` VARCHAR(255) DEFAULT NULL,
  `receiver_name` VARCHAR(100) NOT NULL,
  `receiver_signature` VARCHAR(255) DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `stage` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `status` ENUM('Diterima','Proses','Selesai','Karantina') NOT NULL DEFAULT 'Diterima',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipts_barcode` (`barcode`),
  KEY `idx_receipts_date` (`receipt_date`),
  KEY `idx_receipts_stage` (`stage`, `status`),
  CONSTRAINT `fk_receipts_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`),
  CONSTRAINT `fk_receipts_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tahap 2 - Pencucian
CREATE TABLE `washings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `receipt_id` INT UNSIGNED NOT NULL,
  `method` ENUM('Washer','Manual','Ultrasonik') NOT NULL DEFAULT 'Washer',
  `liquid` VARCHAR(100) DEFAULT NULL,
  `duration_min` SMALLINT UNSIGNED DEFAULT NULL,
  `officer` VARCHAR(100) NOT NULL,
  `wash_date` DATE NOT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_washings_date` (`wash_date`),
  CONSTRAINT `fk_washings_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `dirty_receipts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tahap 3 - Pengeringan & Pemeriksaan
CREATE TABLE `dryings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `receipt_id` INT UNSIGNED NOT NULL,
  `is_dry` TINYINT(1) NOT NULL DEFAULT 0,
  `no_rust` TINYINT(1) NOT NULL DEFAULT 0,
  `function_ok` TINYINT(1) NOT NULL DEFAULT 0,
  `officer` VARCHAR(100) NOT NULL,
  `dry_date` DATE NOT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dryings_date` (`dry_date`),
  CONSTRAINT `fk_dryings_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `dirty_receipts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tahap 4 - Pengemasan (menghasilkan barcode paket)
CREATE TABLE `packagings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `receipt_id` INT UNSIGNED NOT NULL,
  `package_type` ENUM('Alat Satuan','Set Instrumen','Duk & Jas Operasi','Kasa Steril') NOT NULL,
  `material` VARCHAR(80) NOT NULL,
  `barcode` VARCHAR(50) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'paket',
  `officer` VARCHAR(100) NOT NULL,
  `pack_date` DATE NOT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `status` ENUM('Dikemas','Disterilkan','Lulus','Karantina','Terdistribusi') NOT NULL DEFAULT 'Dikemas',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_packagings_barcode` (`barcode`),
  KEY `idx_packagings_date` (`pack_date`),
  KEY `idx_packagings_status` (`status`),
  CONSTRAINT `fk_packagings_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `dirty_receipts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tahap 5 - Sterilisasi
CREATE TABLE `sterilizations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `machine_id` INT UNSIGNED NOT NULL,
  `cycle_no` VARCHAR(20) NOT NULL,
  `batch_no` VARCHAR(50) NOT NULL,
  `temperature` SMALLINT UNSIGNED NOT NULL,
  `duration_min` SMALLINT UNSIGNED NOT NULL,
  `officer` VARCHAR(100) NOT NULL,
  `steril_date` DATE NOT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('Menunggu Verifikasi','Lulus','Gagal') NOT NULL DEFAULT 'Menunggu Verifikasi',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sterilizations_batch` (`batch_no`),
  KEY `idx_sterilizations_date` (`steril_date`),
  CONSTRAINT `fk_sterilizations_machine` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sterilization_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sterilization_id` INT UNSIGNED NOT NULL,
  `packaging_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_si_packaging` (`packaging_id`),
  KEY `idx_si_sterilization` (`sterilization_id`),
  CONSTRAINT `fk_si_sterilization` FOREIGN KEY (`sterilization_id`) REFERENCES `sterilizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_si_packaging` FOREIGN KEY (`packaging_id`) REFERENCES `packagings` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tahap 6 - Verifikasi Sterilisasi (hasil dihitung otomatis: LULUS / GAGAL)
CREATE TABLE `verifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sterilization_id` INT UNSIGNED NOT NULL,
  `condition_packaging` ENUM('Baik','Rusak') NOT NULL DEFAULT 'Baik',
  `chem_internal` ENUM('Sesuai','Tidak Sesuai') NOT NULL,
  `chem_external` ENUM('Sesuai','Tidak Sesuai') NOT NULL,
  `bio_indicator` ENUM('Sesuai','Tidak Sesuai') NOT NULL,
  `bowie_dick` ENUM('Sesuai','Tidak Sesuai') NOT NULL,
  `result` ENUM('LULUS','GAGAL') NOT NULL,
  `fail_reason` VARCHAR(500) DEFAULT NULL,
  `officer` VARCHAR(100) NOT NULL,
  `signature` VARCHAR(255) DEFAULT NULL,
  `verify_date` DATE NOT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_verifications_sterilization` (`sterilization_id`),
  KEY `idx_verifications_date` (`verify_date`),
  CONSTRAINT `fk_verifications_sterilization` FOREIGN KEY (`sterilization_id`) REFERENCES `sterilizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tahap 7 - Stok Alat Steril (hanya dari verifikasi LULUS)
CREATE TABLE `sterile_stock` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `packaging_id` INT UNSIGNED NOT NULL,
  `barcode` VARCHAR(50) NOT NULL,
  `category` ENUM('Alat Satuan','Set Instrumen','Duk & Jas Operasi','Kasa Steril') NOT NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `batch_no` VARCHAR(50) NOT NULL,
  `sterile_date` DATE NOT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `expiry_date` DATE NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'paket',
  `status` ENUM('Tersedia','Terdistribusi') NOT NULL DEFAULT 'Tersedia',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_barcode` (`barcode`),
  UNIQUE KEY `uq_stock_packaging` (`packaging_id`),
  KEY `idx_stock_expiry` (`expiry_date`),
  CONSTRAINT `fk_stock_packaging` FOREIGN KEY (`packaging_id`) REFERENCES `packagings` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Karantina / Gagal (otomatis dari verifikasi GAGAL)
CREATE TABLE `quarantines` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `packaging_id` INT UNSIGNED NOT NULL,
  `verification_id` INT UNSIGNED DEFAULT NULL,
  `barcode` VARCHAR(50) NOT NULL,
  `batch_no` VARCHAR(50) NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `status` ENUM('Karantina','Diproses ulang','Dimusnahkan') NOT NULL DEFAULT 'Karantina',
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_quarantines_status` (`status`),
  CONSTRAINT `fk_quarantines_packaging` FOREIGN KEY (`packaging_id`) REFERENCES `packagings` (`id`),
  CONSTRAINT `fk_quarantines_verification` FOREIGN KEY (`verification_id`) REFERENCES `verifications` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tahap 8 & 9 - Distribusi Alat Steril / Kasa Steril (BARCODE)
CREATE TABLE `distributions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` ENUM('ALAT','KASA') NOT NULL,
  `barcode` VARCHAR(50) NOT NULL,
  `stock_id` INT UNSIGNED NOT NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `gauze_type` VARCHAR(100) DEFAULT NULL,
  `officer` VARCHAR(100) NOT NULL,
  `officer_signature` TEXT DEFAULT NULL,
  `receiver_name` VARCHAR(100) DEFAULT NULL,
  `receiver_signature` TEXT DEFAULT NULL,
  `dist_date` DATE NOT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_distributions_date` (`dist_date`),
  KEY `idx_distributions_type` (`type`),
  CONSTRAINT `fk_distributions_stock` FOREIGN KEY (`stock_id`) REFERENCES `sterile_stock` (`id`),
  CONSTRAINT `fk_distributions_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- DTT (Reuse) - Buku Kontrol Penggunaan Ulang Alat Medis (2 Barcode Transaksi)
-- ------------------------------------------------------------
-- Transaksi 1: Penerimaan Alat Kotor DTT (Reuse) (Unit -> CSSD)
CREATE TABLE `dtt_receipts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `barcode` VARCHAR(50) NOT NULL,
  `receipt_datetime` DATETIME NOT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `item_code` VARCHAR(50) DEFAULT NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'pcs',
  `reuse_count` INT UNSIGNED NOT NULL DEFAULT 1,
  `max_reuse_limit` INT UNSIGNED NOT NULL DEFAULT 10,
  `tool_condition` ENUM('Baik', 'Perlu Perbaikan', 'Rusak / Afkir') NOT NULL DEFAULT 'Baik',
  `sender_name` VARCHAR(100) NOT NULL,
  `sender_signature` TEXT DEFAULT NULL,
  `receiver_name` VARCHAR(100) NOT NULL,
  `receiver_signature` TEXT DEFAULT NULL,
  `process_stage` ENUM('Diterima', 'Pencucian DTT', 'Penyimpanan DTT', 'Siap Distribusi', 'Selesai') NOT NULL DEFAULT 'Diterima',
  `dtt_method` VARCHAR(100) DEFAULT 'DTT Manual (Perendaman Enzimatik & Disinfektan)',
  `dtt_liquid` VARCHAR(100) DEFAULT 'Glutaraldehyde 2%',
  `dtt_duration_min` INT UNSIGNED DEFAULT 20,
  `verification_result` ENUM('Belum Diverifikasi', 'Lolos', 'Gagal / Cuci Ulang') NOT NULL DEFAULT 'Belum Diverifikasi',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dtt_receipts_barcode` (`barcode`),
  KEY `idx_dtt_receipts_unit` (`unit_id`),
  KEY `idx_dtt_receipts_stage` (`process_stage`),
  CONSTRAINT `fk_dtt_receipts_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transaksi 2: Distribusi Alat Hasil DTT (Reuse) (CSSD -> Unit)
CREATE TABLE `dtt_distributions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `barcode` VARCHAR(50) NOT NULL,
  `dtt_receipt_id` INT UNSIGNED NOT NULL,
  `dist_datetime` DATETIME NOT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'pcs',
  `reuse_count` INT UNSIGNED NOT NULL DEFAULT 1,
  `tool_condition` ENUM('Baik', 'Perlu Perbaikan', 'Rusak / Afkir') NOT NULL DEFAULT 'Baik',
  `officer` VARCHAR(100) NOT NULL,
  `officer_signature` TEXT DEFAULT NULL,
  `receiver_name` VARCHAR(100) NOT NULL,
  `receiver_signature` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dtt_dist_barcode` (`barcode`),
  KEY `idx_dtt_dist_unit` (`unit_id`),
  CONSTRAINT `fk_dtt_dist_receipt` FOREIGN KEY (`dtt_receipt_id`) REFERENCES `dtt_receipts` (`id`),
  CONSTRAINT `fk_dtt_dist_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Notifikasi Aktivitas Admin CSSD
-- ------------------------------------------------------------
CREATE TABLE `activity_notifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` ENUM('RECEIPT', 'DISTRIBUTION', 'DTT_RECEIPT', 'DTT_DISTRIBUTION', 'UNIT_REQUEST', 'NEW_ITEM_REQUEST') NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `unit_id` INT UNSIGNED DEFAULT NULL,
  `unit_name` VARCHAR(100) DEFAULT NULL,
  `item_name` VARCHAR(255) DEFAULT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) DEFAULT 'set',
  `barcode` VARCHAR(50) DEFAULT NULL,
  `officer_sender` VARCHAR(100) DEFAULT NULL,
  `officer_receiver` VARCHAR(100) DEFAULT NULL,
  `signature_sender` TEXT DEFAULT NULL,
  `signature_receiver` TEXT DEFAULT NULL,
  `trx_date` DATE DEFAULT NULL,
  `trx_time` VARCHAR(10) DEFAULT NULL,
  `ref_table` VARCHAR(50) NOT NULL,
  `ref_id` INT UNSIGNED NOT NULL,
  `data_payload` LONGTEXT DEFAULT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_read_created` (`is_read`, `created_at`),
  KEY `idx_notif_type` (`type`),
  KEY `idx_notif_ref` (`ref_table`, `ref_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Log Penggunaan Mesin Washer dan Steam
-- ------------------------------------------------------------
CREATE TABLE `machine_usage_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `log_code` VARCHAR(50) NOT NULL,
  `machine_type` ENUM('Washer', 'Steam') NOT NULL,
  `machine_id` INT UNSIGNED DEFAULT NULL,
  `machine_name` VARCHAR(100) NOT NULL,
  `officer` VARCHAR(100) NOT NULL,
  `log_date` DATE NOT NULL,
  `started_at` DATETIME NOT NULL,
  `completed_at` DATETIME NOT NULL,
  `cycle_batch_no` VARCHAR(50) NOT NULL,
  `load_description` TEXT NOT NULL,
  `temperature` DECIMAL(5,2) DEFAULT NULL,
  `pressure_bar` DECIMAL(4,2) DEFAULT NULL,
  `duration_min` INT UNSIGNED DEFAULT NULL,
  `process_result` ENUM('Berhasil', 'Gagal') NOT NULL DEFAULT 'Berhasil',
  `has_delay_issue` TINYINT(1) NOT NULL DEFAULT 0,
  `delay_reason` TEXT DEFAULT NULL,
  `action_taken` TEXT DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mlog_code` (`log_code`),
  KEY `idx_mlog_date` (`log_date`),
  KEY `idx_mlog_type` (`machine_type`),
  KEY `idx_mlog_result` (`process_result`),
  CONSTRAINT `fk_mlog_machine` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Kebutuhan Alat & Set Instrumen Unit (Multiple Operasi / Tindakan)
-- ------------------------------------------------------------
CREATE TABLE `unit_requisitions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `procedure_name` VARCHAR(150) NOT NULL,
  `procedure_date` DATE NOT NULL,
  `procedure_time` VARCHAR(10) DEFAULT NULL,
  `item_id` INT UNSIGNED DEFAULT NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'set',
  `requester_name` VARCHAR(100) NOT NULL,
  `urgency` ENUM('Rutin', 'Segera / Cito', 'Elektif') NOT NULL DEFAULT 'Rutin',
  `status` ENUM('Diajukan', 'Disiapkan CSSD', 'Siap Diambil', 'Selesai', 'Ditolak') NOT NULL DEFAULT 'Diajukan',
  `notes` TEXT DEFAULT NULL,
  `processed_by` VARCHAR(100) DEFAULT NULL,
  `rejection_reason` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_req_code` (`code`),
  KEY `idx_req_unit` (`unit_id`),
  KEY `idx_req_date` (`procedure_date`),
  KEY `idx_req_status` (`status`),
  CONSTRAINT `fk_req_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`),
  CONSTRAINT `fk_req_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Pengajuan Alat / Set Baru oleh Unit
-- ------------------------------------------------------------
CREATE TABLE `item_proposals` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `unit_id` INT UNSIGNED NOT NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `category` ENUM('Alat Satuan', 'Set Instrumen', 'Duk & Jas Operasi', 'Kasa Steril', 'Alat DTT') NOT NULL DEFAULT 'Set Instrumen',
  `proposed_quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'set',
  `specification` TEXT DEFAULT NULL,
  `reason` TEXT NOT NULL,
  `requester_name` VARCHAR(100) NOT NULL,
  `status` ENUM('Menunggu Verifikasi', 'Disetujui', 'Ditolak') NOT NULL DEFAULT 'Menunggu Verifikasi',
  `verified_by` VARCHAR(100) DEFAULT NULL,
  `admin_notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_prop_code` (`code`),
  KEY `idx_prop_unit` (`unit_id`),
  KEY `idx_prop_status` (`status`),
  CONSTRAINT `fk_prop_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Manajemen Stok BMHP (Barang Medis Habis Pakai)
-- ------------------------------------------------------------
CREATE TABLE `bmhp_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(30) NOT NULL,
  `barcode` VARCHAR(50) DEFAULT NULL,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(100) DEFAULT 'Kemasan Steril',
  `item_type` VARCHAR(100) DEFAULT NULL,
  `specification` VARCHAR(255) DEFAULT NULL,
  `unit_label` VARCHAR(30) NOT NULL DEFAULT 'pcs',
  `package_volume` VARCHAR(100) DEFAULT NULL,
  `initial_stock` INT NOT NULL DEFAULT 0,
  `stock` INT NOT NULL DEFAULT 0,
  `min_stock` INT NOT NULL DEFAULT 0,
  `batch_no` VARCHAR(50) DEFAULT NULL,
  `expiry_date` DATE DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bmhp_code` (`code`),
  UNIQUE KEY `uq_bmhp_barcode` (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bmhp_transactions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `bmhp_item_id` INT UNSIGNED NOT NULL,
  `type` ENUM('MASUK','KELUAR') NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `batch_no` VARCHAR(50) DEFAULT NULL,
  `expiry_date` DATE DEFAULT NULL,
  `unit_id` INT UNSIGNED DEFAULT NULL,
  `officer` VARCHAR(100) NOT NULL,
  `trx_date` DATE NOT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `stock_after` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bmhp_trx_date` (`trx_date`),
  CONSTRAINT `fk_bmhp_trx_item` FOREIGN KEY (`bmhp_item_id`) REFERENCES `bmhp_items` (`id`),
  CONSTRAINT `fk_bmhp_trx_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SAMPLE DATA
-- ============================================================

INSERT INTO `units` (`id`,`code`,`name`,`pic_name`,`phone`) VALUES
(1,'OK','Kamar Operasi','dr. Evi','081200000001'),
(2,'IGD','Instalasi Gawat Darurat','Ns. Budi','081200000002'),
(3,'ICU','Intensive Care Unit','Ns. Sari','081200000003'),
(4,'VK','Ruang Bersalin','Bdn. Rina','081200000004'),
(5,'RI','Rawat Inap','Ns. Dewi','081200000005'),
(6,'PG','Poli Gigi','drg. Andi','081200000006');

INSERT INTO `items` (`id`,`unit_id`,`code`,`name`,`category`,`shelf_life_months`,`description`) VALUES
(1,1,'SET-LAP','Set Laparotomi','Set Instrumen',6,'Set instrumen laparotomi'),
(2,2,'SET-MNR','Set Minor','Set Instrumen',6,'Set bedah minor'),
(3,1,'DUK-LAP','Duk Laparotomi','Duk & Jas Operasi',6,'Duk steril laparotomi'),
(4,5,'KSA-10','Kasa 10x10','Kasa Steril',6,'Kasa steril 10x10 cm'),
(5,1,'JAS-OP','Jas Operasi','Duk & Jas Operasi',6,'Jas operasi steril'),
(6,2,'ALT-GNT','Gunting Hecting Satuan','Alat Satuan',6,'Gunting angkat jahitan / hecting lepasan'),
(7,6,'ALT-PNS','Pinset Sirurgis Satuan','Alat Satuan',6,'Pinset sirurgis lepasan Poli Gigi');

INSERT INTO `item_units` (`id`,`code`,`name`,`category`,`description`) VALUES
(1,'SET','Set','Semua','Set instrumen bedah/tindakan lengkap'),
(2,'PCS','Pcs','Semua','Alat satuan / lepasan per pcs'),
(3,'BUAH','Buah','Semua','Alat satuan per buah'),
(4,'TABUNG','Tabung','DTT','Instrumen berbentuk tabung / kanul suction / trocar DTT'),
(5,'SUNGKUP','Sungkup','DTT','Sungkup anestesi / resusitasi / nebulizer DTT'),
(6,'PASANG','Pasang','Steril','Alat / sarung tangan berpasangan'),
(7,'LEMBAR','Lembar','Steril','Duk, kain linen, wrap steril'),
(8,'ROL','Rol','Steril','Kasa rol dan pita indikator'),
(9,'PAKET','Paket','Semua','Paket gabungan alat atau linen'),
(10,'POUCH','Pouch','Steril','Kemasan steril pouch');

INSERT INTO `machines` (`id`,`code`,`name`,`type`) VALUES
(1,'AU1','Autoclave 1','Steam'),
(2,'AU2','Autoclave 2','Steam'),
(3,'ST1','Steam Sterilizer','Steam'),
(4,'PL1','Plasma Sterilizer','Plasma'),
(5,'DT1','DTT Manual','DTT'),
(6,'WD1','Washer Disinfector 1','Washer'),
(7,'WD2','Washer Disinfector 2','Washer');

INSERT INTO `packaging_materials` (`id`,`code`,`name`,`description`,`is_active`) VALUES
(1,'SMS','SMS Wrap','Kain pembungkus SMS non-woven standar CSSD',1),
(2,'POUCH','Pouch','Kantung sterilisasi kertas / film transparan',1),
(3,'CONT','Container','Kotak kontainer instrumen tahan panas',1),
(4,'LINEN','Linen','Kain katun / linen pembungkus alat steril',1),
(5,'KREP','Kertas Krep','Kertas krep medikal untuk pembungkus',1);

INSERT INTO `officers` (`id`,`nip`,`name`,`role`,`phone`) VALUES
(1,'PEG-001','Inge Kusryaningsih','Petugas CSSD','081234567890'),
(2,'PEG-002','Rahma','Petugas Penerima CSSD','081234567891'),
(3,'PEG-003','Zamra','Petugas Pengeringan','081234567892'),
(4,'PEG-004','Inge','Petugas CSSD','081234567894'),
(5,'PEG-005','Budi Santoso','Operator Sterilisasi','081234567893');

INSERT INTO `dirty_receipts`
(`id`,`barcode`,`receipt_date`,`unit_id`,`item_id`,`item_name`,`quantity`,`unit_label`,`sender_name`,`receiver_name`,`stage`,`status`) VALUES
(1,'AK-301026-001','2026-10-30',1,2,'Set Minor',10,'set','dr. Evi','Rahma',6,'Selesai'),
(2,'AK-301026-002','2026-10-30',2,1,'Set Laparotomi',2,'set','Ns. Budi','Rahma',6,'Karantina'),
(3,'AK-301026-003','2026-10-30',1,3,'Duk Laparotomi',10,'pcs','dr. Evi','Rahma',6,'Selesai'),
(4,'AK-301026-004','2026-10-30',5,4,'Kasa 10x10',50,'pcs','Ns. Dewi','Rahma',6,'Selesai'),
(5,'AK-311026-001','2026-10-31',3,1,'Set Laparotomi',1,'set','Ns. Sari','Rahma',1,'Diterima');

INSERT INTO `washings` (`receipt_id`,`method`,`liquid`,`duration_min`,`officer`,`wash_date`) VALUES
(1,'Washer','Prozim Aktif',10,'Inge','2026-10-30'),
(2,'Washer','Prozim Aktif',10,'Inge','2026-10-30'),
(3,'Washer','Prozim Aktif',10,'Inge','2026-10-30'),
(4,'Washer','Prozim Aktif',10,'Inge','2026-10-30');

INSERT INTO `dryings` (`receipt_id`,`is_dry`,`no_rust`,`function_ok`,`officer`,`dry_date`) VALUES
(1,1,1,1,'Zamra','2026-10-30'),
(2,1,1,1,'Zamra','2026-10-30'),
(3,1,1,1,'Zamra','2026-10-30'),
(4,1,1,1,'Zamra','2026-10-30');

INSERT INTO `packagings`
(`id`,`receipt_id`,`package_type`,`material`,`barcode`,`quantity`,`unit_label`,`officer`,`pack_date`,`status`) VALUES
(1,3,'Duk & Jas Operasi','SMS Wrap','PG-301026-001',10,'paket','Inge','2026-10-30','Lulus'),
(2,4,'Kasa Steril','Pouch','KS-301026-001',50,'paket','Inge','2026-10-30','Lulus'),
(3,1,'Set Instrumen','Container','SM-301026-001',10,'set','Inge','2026-10-30','Lulus'),
(4,2,'Set Instrumen','Container','SM-301026-002',2,'set','Inge','2026-10-30','Karantina');

INSERT INTO `sterilizations`
(`id`,`machine_id`,`cycle_no`,`batch_no`,`temperature`,`duration_min`,`officer`,`steril_date`,`status`) VALUES
(1,1,'025','AU1-301026-025',134,40,'Inge','2026-10-30','Lulus'),
(2,2,'021','AU2-301026-021',134,40,'Inge','2026-10-30','Gagal');

INSERT INTO `sterilization_items` (`sterilization_id`,`packaging_id`) VALUES (1,1),(1,2),(1,3),(2,4);

INSERT INTO `verifications`
(`id`,`sterilization_id`,`condition_packaging`,`chem_internal`,`chem_external`,`bio_indicator`,`bowie_dick`,`result`,`fail_reason`,`officer`,`verify_date`) VALUES
(1,1,'Baik','Sesuai','Sesuai','Sesuai','Sesuai','LULUS',NULL,'Inge Kusryaningsih','2026-10-30'),
(2,2,'Baik','Sesuai','Sesuai','Tidak Sesuai','Sesuai','GAGAL','Indikator biologi (BI) tidak sesuai','Inge Kusryaningsih','2026-10-30');

INSERT INTO `sterile_stock`
(`packaging_id`,`barcode`,`category`,`item_name`,`batch_no`,`sterile_date`,`expiry_date`,`quantity`,`unit_label`,`status`) VALUES
(1,'PG-301026-001','Duk & Jas Operasi','Duk Laparotomi','AU1-301026-025','2026-10-30','2027-04-30',10,'paket','Tersedia'),
(2,'KS-301026-001','Kasa Steril','Kasa 10x10','AU1-301026-025','2026-10-30','2027-04-30',50,'paket','Tersedia'),
(3,'SM-301026-001','Set Instrumen','Set Minor','AU1-301026-025','2026-10-30','2027-04-30',10,'set','Tersedia'),
(1,'SM-301026-003','Set Instrumen','SET LAPAROTOMI','AU1-301026-025','2026-10-30','2027-04-30',5,'set','Tersedia');

INSERT INTO `instrument_sets` (`id`, `code`, `name`, `completeness_status`, `missing_notes`, `description`) VALUES
(1, 'SET-LAP', 'SET LAPAROTOMI', 'Lengkap', NULL, 'Set instrumen bedah laparotomi mayor'),
(2, 'SET-MNR', 'SET MINOR', 'Lengkap', NULL, 'Set bedah minor rawat jalan & IGD'),
(3, 'SET-SC', 'SET SECTIO CAESAREA', 'Lengkap', NULL, 'Set bedah sesar / SC kamar operasi VK'),
(4, 'SET-PRT', 'SET PARTUS', 'Tidak Lengkap', 'Gunting episiotomi kurang 1 pcs dalam perbaikan teknisi', 'Set pertolongan persalinan normal');

INSERT INTO `instrument_set_items` (`set_id`, `instrument_name`, `quantity`, `unit_label`, `sort_order`) VALUES
-- Set Laparotomi (14 buah)
(1, 'Pinset anatomis', 2, 'Buah', 1),
(1, 'Pinset sirurgis', 2, 'Buah', 2),
(1, 'Gunting Mayo', 2, 'Buah', 3),
(1, 'Klem Pean', 6, 'Buah', 4),
(1, 'Needle holder', 2, 'Buah', 5),
-- Set Minor (10 buah)
(2, 'Gunting bedah lurus', 1, 'Buah', 1),
(2, 'Gunting bedah bengkok', 1, 'Buah', 2),
(2, 'Pinset anatomis', 2, 'Buah', 3),
(2, 'Pinset sirurgis', 2, 'Buah', 4),
(2, 'Klem arteri Pean', 2, 'Buah', 5),
(2, 'Needle holder', 1, 'Buah', 6),
(2, 'Bak instrumen', 1, 'Buah', 7),
-- Set SC (22 buah)
(3, 'Pinset sirurgis', 2, 'Buah', 1),
(3, 'Pinset anatomis', 2, 'Buah', 2),
(3, 'Gunting Metzenbaum', 2, 'Buah', 3),
(3, 'Gunting Mayo', 2, 'Buah', 4),
(3, 'Klem Kocher', 4, 'Buah', 5),
(3, 'Klem Pean', 4, 'Buah', 6),
(3, 'Needle holder', 2, 'Buah', 7),
(3, 'Retraktor Abdomen', 2, 'Buah', 8),
(3, 'Ring forceps / Klem kassa', 2, 'Buah', 9),
-- Set Partus (8 buah)
(4, 'Gunting episiotomi', 1, 'Buah', 1),
(4, 'Gunting tali pusat', 1, 'Buah', 2),
(4, 'Klem tali pusat', 2, 'Buah', 3),
(4, 'Pinset anatomis', 1, 'Buah', 4),
(4, 'Needle holder', 1, 'Buah', 5),
(4, 'Catheter nelaton', 1, 'Buah', 6),
(4, 'Setengah kocher', 1, 'Buah', 7);

INSERT INTO `instrument_discrepancy_logs` (`id`, `set_id`, `instrument_name`, `incident_type`, `quantity`, `unit_origin`, `officer`, `incident_date`, `notes`, `resolution_status`)
VALUES
(1, 4, 'Gunting episiotomi', 'Rusak', 1, 'Ruang Bersalin (VK)', 'Inge Kusryaningsih', '2026-11-01', 'Gunting episiotomi mata gunting tumpul / dalam perbaikan teknisi', 'Belum Selesai');

INSERT INTO `quarantines` (`packaging_id`,`verification_id`,`barcode`,`batch_no`,`reason`,`status`) VALUES
(4,2,'SM-301026-002','AU2-301026-021','Indikator biologi (BI) tidak sesuai','Karantina');

INSERT INTO `bmhp_items` (`id`,`code`,`barcode`,`name`,`unit_label`,`stock`,`min_stock`) VALUES
(1,'BMHP-001','8991001000011','Sterilization Pouch 10x20','box',40,10),
(2,'BMHP-002','8991001000028','Indikator Kimia Eksternal (Tape)','roll',25,10),
(3,'BMHP-003','8991001000035','Biological Indicator','ampul',8,10),
(4,'BMHP-004','8991001000042','Wrap SMS 60x60','lembar',300,100),
(5,'BMHP-005','8991001000059','Deterjen Enzimatik','liter',12,5);

INSERT INTO `bmhp_transactions`
(`bmhp_item_id`,`type`,`quantity`,`batch_no`,`unit_id`,`officer`,`trx_date`,`notes`,`stock_after`) VALUES
(1,'MASUK',50,'LOT-2610-A',NULL,'Rahma','2026-10-28','Pembelian rutin',50),
(1,'KELUAR',10,NULL,NULL,'Inge','2026-10-30','Pemakaian pengemasan',40),
(3,'KELUAR',2,NULL,NULL,'Inge','2026-10-30','Pemakaian verifikasi',8);

INSERT INTO `distributions`
(`id`,`type`,`barcode`,`stock_id`,`unit_id`,`quantity`,`gauze_type`,`officer`,`officer_signature`,`receiver_name`,`receiver_signature`,`dist_date`,`notes`) VALUES
(1,'ALAT','PG-301026-001',1,1,10,NULL,'Inge Kusryaningsih',NULL,'dr. Evi',NULL,'2026-10-31','Distribusi duk operasi'),
(2,'KASA','KS-301026-001',2,2,20,'Kasa Lipat OK','Inge Kusryaningsih',NULL,'Ns. Budi',NULL,'2026-10-31','Distribusi kasa steril IGD');

INSERT INTO `dtt_receipts`
(`id`,`barcode`,`receipt_datetime`,`unit_id`,`item_code`,`item_name`,`quantity`,`unit_label`,`reuse_count`,`max_reuse_limit`,`tool_condition`,`sender_name`,`receiver_name`,`process_stage`,`dtt_method`,`dtt_liquid`,`dtt_duration_min`,`verification_result`,`notes`) VALUES
(1,'RD-301026-001','2026-10-30 09:15:00',1,'DTT-SC','Sungkup Laring / LMA',2,'sungkup',3,10,'Baik','dr. Evi','Rahma','Siap Distribusi','DTT Manual (Perendaman Enzimatik & Disinfektan)','Glutaraldehyde 2%',20,'Lolos','DTT selesai, siap diserahkan ke unit'),
(2,'RD-301026-002','2026-10-31 10:30:00',2,'DTT-TB','Tabung Suction Kaca',1,'tabung',2,8,'Baik','Ns. Budi','Rahma','Diterima','DTT Manual (Perendaman Enzimatik & Disinfektan)','Glutaraldehyde 2%',20,'Belum Diverifikasi','Penerimaan alat kotor DTT');

INSERT INTO `dtt_distributions`
(`id`,`barcode`,`dtt_receipt_id`,`dist_datetime`,`unit_id`,`item_name`,`quantity`,`unit_label`,`reuse_count`,`tool_condition`,`officer`,`receiver_name`,`notes`) VALUES
(1,'DDTT-301026-001',1,'2026-10-30 14:00:00',1,'Sungkup Laring / LMA',2,'sungkup',3,'Baik','Inge Kusryaningsih','dr. Evi','Penyerahan alat hasil DTT kembali ke unit OK');

-- Penomoran otomatis dilanjutkan dari data contoh
INSERT INTO `counters` (`name`,`counter_date`,`value`) VALUES
('AK','2026-10-30',4),
('AK','2026-10-31',1),
('PG','2026-10-30',1),
('KS','2026-10-30',1),
('SM','2026-10-30',2),
('RD','2026-10-30',2),
('DDTT','2026-10-30',1),
('CYCLE-AU1','1970-01-01',25),
('CYCLE-AU2','1970-01-01',21);
