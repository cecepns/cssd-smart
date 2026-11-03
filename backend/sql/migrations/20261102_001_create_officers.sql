-- ============================================================
-- Migration: 20261102_001_create_officers.sql
-- Description: Membuat tabel master petugas CSSD (officers)
--              beserta tanda tangan digital dan data awal.
-- ============================================================

CREATE TABLE IF NOT EXISTS `officers` (
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

-- Sample Data Petugas (insert jika belum ada)
INSERT INTO `officers` (`id`, `nip`, `name`, `role`, `phone`) VALUES
(1, 'PEG-001', 'Inge Kusryaningsih', 'Petugas CSSD', '081234567890'),
(2, 'PEG-002', 'Rahma', 'Petugas Penerima CSSD', '081234567891'),
(3, 'PEG-003', 'Zamra', 'Petugas Pengeringan', '081234567892'),
(4, 'PEG-004', 'Inge', 'Petugas CSSD', '081234567894'),
(5, 'PEG-005', 'Budi Santoso', 'Operator Sterilisasi', '081234567893')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

