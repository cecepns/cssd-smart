-- Migration: 20261113_001_notifications_machinelogs_and_requisitions.sql
-- Deskripsi:
-- 1. Tabel activity_notifications untuk notifikasi otomatis Admin CSSD
-- 2. Tabel machine_usage_logs untuk pemantauan log mesin Washer dan Steam
-- 3. Tabel unit_requisitions untuk input kebutuhan alat/set unit (multiple operasi)
-- 4. Tabel item_proposals untuk pengajuan alat/set baru oleh unit
-- 5. Tambah mesin Washer ke tabel machines

-- 1. Notifikasi Aktivitas Admin CSSD
CREATE TABLE IF NOT EXISTS `activity_notifications` (
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

-- 2. Log Penggunaan Mesin Washer dan Steam
CREATE TABLE IF NOT EXISTS `machine_usage_logs` (
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

-- 3. Kebutuhan Alat & Set Instrumen Unit (Multiple Operasi / Tindakan)
CREATE TABLE IF NOT EXISTS `unit_requisitions` (
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

-- 4. Pengajuan Alat / Set Baru oleh Unit
CREATE TABLE IF NOT EXISTS `item_proposals` (
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

-- 5. Tambahkan mesin Washer standar jika belum ada
INSERT IGNORE INTO `machines` (`code`, `name`, `type`, `is_active`) VALUES
('WD1', 'Washer Disinfector 1', 'Washer', 1),
('WD2', 'Washer Disinfector 2', 'Washer', 1);

