-- ============================================================
-- Migration: Master Data Bahan Kemasan (Packaging Materials)
-- Tanggal: 2026-11-03
-- ============================================================

CREATE TABLE IF NOT EXISTS `packaging_materials` (
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

-- Data Awal Bahan Kemasan Standar CSSD
INSERT IGNORE INTO `packaging_materials` (`code`, `name`, `description`, `is_active`) VALUES
('SMS', 'SMS Wrap', 'Kain pembungkus SMS non-woven standar CSSD', 1),
('POUCH', 'Pouch', 'Kantung sterilisasi kertas / film transparan', 1),
('CONT', 'Container', 'Kotak kontainer instrumen tahan panas', 1),
('LINEN', 'Linen', 'Kain katun / linen pembungkus alat steril', 1),
('KREP', 'Kertas Krep', 'Kertas krep medikal untuk pembungkus', 1);

