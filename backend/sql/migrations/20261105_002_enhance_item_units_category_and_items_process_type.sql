-- ============================================================
-- CSSD SMART - MIGRATION SCRIPT (PART 2)
-- File: backend/sql/migrations/20261105_002_enhance_item_units_category_and_items_process_type.sql
-- Tanggal: 2026-11-05
-- 
-- Pembaruan Tambahan (Lanjutan dari migrasi sebelumnya):
-- 1. Tambah kolom `category` pada tabel `item_units` (Semua, Steril, DTT)
-- 2. Tambah data master satuan `BUAH` (Buah) dan perbarui kategori masing-masing satuan
-- 3. Tambah kolom `process_type` (Steril / DTT) dan `unit_label` pada tabel `items`
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- Prosedur Helper: Tambah kolom jika belum ada (Aman / Idempotent)
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS `AddColIfNotExist`;
DELIMITER $$
CREATE PROCEDURE `AddColIfNotExist`(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_coldef TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = p_table AND column_name = p_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_coldef);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$
DELIMITER ;

-- ------------------------------------------------------------
-- 1. Tambah Kolom Category pada Tabel item_units
-- ------------------------------------------------------------
CALL `AddColIfNotExist`('item_units', 'category', "ENUM('Semua', 'Steril', 'DTT') NOT NULL DEFAULT 'Semua' AFTER `name`");

-- ------------------------------------------------------------
-- 2. Tambah Data Satuan BUAH dan Perbarui Kategori Seluruh Satuan
-- ------------------------------------------------------------
INSERT INTO `item_units` (`code`, `name`, `category`, `description`) VALUES
('SET', 'Set', 'Semua', 'Set instrumen bedah/tindakan lengkap'),
('PCS', 'Pcs', 'Semua', 'Alat satuan / lepasan per pcs'),
('BUAH', 'Buah', 'Semua', 'Alat satuan per buah'),
('TABUNG', 'Tabung', 'DTT', 'Instrumen berbentuk tabung / kanul suction / trocar DTT'),
('SUNGKUP', 'Sungkup', 'DTT', 'Sungkup anestesi / resusitasi / nebulizer DTT'),
('PASANG', 'Pasang', 'Steril', 'Alat / sarung tangan bedah berpasangan'),
('LEMBAR', 'Lembar', 'Steril', 'Duk, kain linen, wrap steril'),
('ROL', 'Rol', 'Steril', 'Kasa rol dan pita indikator'),
('PAKET', 'Paket', 'Semua', 'Paket gabungan alat atau linen'),
('POUCH', 'Pouch', 'Steril', 'Kemasan steril pouch')
ON DUPLICATE KEY UPDATE 
  `name` = VALUES(`name`), 
  `category` = VALUES(`category`), 
  `description` = VALUES(`description`);

-- ------------------------------------------------------------
-- 3. Tambah Kolom process_type dan unit_label pada Tabel items
-- ------------------------------------------------------------
CALL `AddColIfNotExist`('items', 'process_type', "ENUM('Steril','DTT') NOT NULL DEFAULT 'Steril' AFTER `name`");
CALL `AddColIfNotExist`('items', 'unit_label', "VARCHAR(50) NOT NULL DEFAULT 'Set' AFTER `category`");

-- Tambah index process_type jika belum ada
SET @idx_items_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'items' AND index_name = 'idx_items_process_type'
);
SET @sql_items_idx = IF(@idx_items_exists = 0, 'ALTER TABLE `items` ADD KEY `idx_items_process_type` (`process_type`)', 'SELECT 1');
PREPARE stmt_items_idx FROM @sql_items_idx;
EXECUTE stmt_items_idx;
DEALLOCATE PREPARE stmt_items_idx;

-- Hapus prosedur helper setelah selesai
DROP PROCEDURE IF EXISTS `AddColIfNotExist`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Selesai: Migrasi Part 2 CSSD SMART Berhasil Dijalankan
-- ============================================================
