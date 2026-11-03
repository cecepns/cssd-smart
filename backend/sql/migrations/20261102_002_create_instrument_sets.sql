-- ============================================================
-- Migration: 20261102_002_create_instrument_sets.sql
-- Description: Membuat tabel master Set Instrumen (instrument_sets)
--              dan rincian item dalam 1 set (instrument_set_items).
-- ============================================================

CREATE TABLE IF NOT EXISTS `instrument_sets` (
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

CREATE TABLE IF NOT EXISTS `instrument_set_items` (
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

-- Sample Data Set Instrumen (insert jika belum ada)
INSERT INTO `instrument_sets` (`id`, `code`, `name`, `completeness_status`, `missing_notes`, `description`) VALUES
(1, 'SET-LAP', 'SET LAPAROTOMI', 'Lengkap', NULL, 'Set instrumen bedah laparotomi mayor'),
(2, 'SET-MNR', 'SET MINOR', 'Lengkap', NULL, 'Set bedah minor rawat jalan & IGD'),
(3, 'SET-SC', 'SET SECTIO CAESAREA', 'Lengkap', NULL, 'Set bedah sesar / SC kamar operasi VK'),
(4, 'SET-PRT', 'SET PARTUS', 'Tidak Lengkap', 'Gunting episiotomi kurang 1 pcs dalam perbaikan teknisi', 'Set pertolongan persalinan normal')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Rincian Instrumen per Set
INSERT INTO `instrument_set_items` (`id`, `set_id`, `instrument_name`, `quantity`, `unit_label`, `sort_order`) VALUES
-- Set Laparotomi (14 buah sesuai referensi)
(1, 1, 'Pinset anatomis', 2, 'Buah', 1),
(2, 1, 'Pinset sirurgis', 2, 'Buah', 2),
(3, 1, 'Gunting Mayo', 2, 'Buah', 3),
(4, 1, 'Klem Pean', 6, 'Buah', 4),
(5, 1, 'Needle holder', 2, 'Buah', 5),

-- Set Minor (10 buah)
(6, 2, 'Gunting bedah lurus', 1, 'Buah', 1),
(7, 2, 'Gunting bedah bengkok', 1, 'Buah', 2),
(8, 2, 'Pinset anatomis', 2, 'Buah', 3),
(9, 2, 'Pinset sirurgis', 2, 'Buah', 4),
(10, 2, 'Klem arteri Pean', 2, 'Buah', 5),
(11, 2, 'Needle holder', 1, 'Buah', 6),
(12, 2, 'Bak instrumen', 1, 'Buah', 7),

-- Set SC (22 buah)
(13, 3, 'Pinset sirurgis', 2, 'Buah', 1),
(14, 3, 'Pinset anatomis', 2, 'Buah', 2),
(15, 3, 'Gunting Metzenbaum', 2, 'Buah', 3),
(16, 3, 'Gunting Mayo', 2, 'Buah', 4),
(17, 3, 'Klem Kocher', 4, 'Buah', 5),
(18, 3, 'Klem Pean', 4, 'Buah', 6),
(19, 3, 'Needle holder', 2, 'Buah', 7),
(20, 3, 'Retraktor Abdomen', 2, 'Buah', 8),
(21, 3, 'Ring forceps / Klem kassa', 2, 'Buah', 9),

-- Set Partus (8 buah)
(22, 4, 'Gunting episiotomi', 1, 'Buah', 1),
(23, 4, 'Gunting tali pusat', 1, 'Buah', 2),
(24, 4, 'Klem tali pusat', 2, 'Buah', 3),
(25, 4, 'Pinset anatomis', 1, 'Buah', 4),
(26, 4, 'Needle holder', 1, 'Buah', 5),
(27, 4, 'Catheter nelaton', 1, 'Buah', 6),
(28, 4, 'Setengah kocher', 1, 'Buah', 7)
ON DUPLICATE KEY UPDATE `instrument_name` = VALUES(`instrument_name`), `quantity` = VALUES(`quantity`);

-- Stok Awal Set Laparotomi di Stok Steril (5 Set Tersedia)
INSERT INTO `sterile_stock` (`packaging_id`, `barcode`, `category`, `item_name`, `batch_no`, `sterile_date`, `expiry_date`, `quantity`, `unit_label`, `status`)
SELECT 1, 'SM-301026-003', 'Instrumen / Set Alat', 'SET LAPAROTOMI', 'AU1-301026-025', '2026-10-30', '2027-04-30', 5, 'set', 'Tersedia'
WHERE NOT EXISTS (
  SELECT 1 FROM `sterile_stock` WHERE `barcode` = 'SM-301026-003'
);

