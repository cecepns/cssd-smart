-- ============================================================
-- Migration: 20261103_002_create_instrument_discrepancies.sql
-- Description: Membuat tabel riwayat instrumen hilang, rusak, atau kurang
--              (instrument_discrepancy_logs) untuk menu Monitoring Set Instrumen.
-- ============================================================

CREATE TABLE IF NOT EXISTS `instrument_discrepancy_logs` (
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

-- Sample insiden awal jika tabel masih kosong
INSERT INTO `instrument_discrepancy_logs` (`id`, `set_id`, `instrument_name`, `incident_type`, `quantity`, `unit_origin`, `officer`, `incident_date`, `notes`, `resolution_status`)
VALUES
(1, 4, 'Gunting episiotomi', 'Rusak', 1, 'Ruang Bersalin (VK)', 'Inge Kusryaningsih', '2026-11-01', 'Gunting episiotomi mata gunting tumpul / dalam perbaikan teknisi', 'Belum Selesai')
ON DUPLICATE KEY UPDATE `instrument_name` = VALUES(`instrument_name`);

