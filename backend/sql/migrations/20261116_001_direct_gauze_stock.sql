-- =============================================================================
-- CSSD SMART - MIGRATION SCRIPT: STOK AWAL & PRODUKSI KASA STERIL
-- File    : 20261116_001_direct_gauze_stock.sql
-- Support : MySQL 5.7+, MySQL 8.0+, MariaDB 10.x+
-- Fitur   : Idempotent (Aman dieksekusi berulang kali)
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Izinkan packaging_id bernilai NULL pada sterile_stock (untuk input stok awal / produksi langsung kasa)
ALTER TABLE `sterile_stock` MODIFY COLUMN `packaging_id` INT UNSIGNED NULL;

-- 2. Helper Stored Procedure: Tambah kolom hanya jika belum ada di tabel
DROP PROCEDURE IF EXISTS `AddColSafeGauze`;
DELIMITER $$
CREATE PROCEDURE `AddColSafeGauze`(
    IN in_table_name VARCHAR(64),
    IN in_col_name VARCHAR(64),
    IN in_col_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = in_table_name 
          AND COLUMN_NAME = in_col_name
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', in_table_name, '` ADD `', in_col_name, '` ', in_col_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- 3. Tambah kolom unit_id, officer, dan notes pada sterile_stock
CALL AddColSafeGauze('sterile_stock', 'unit_id', 'INT UNSIGNED DEFAULT NULL AFTER `expiry_date`');
CALL AddColSafeGauze('sterile_stock', 'officer', 'VARCHAR(100) DEFAULT NULL AFTER `unit_label`');
CALL AddColSafeGauze('sterile_stock', 'notes', 'VARCHAR(500) DEFAULT NULL AFTER `officer`');

DROP PROCEDURE IF EXISTS `AddColSafeGauze`;

SET FOREIGN_KEY_CHECKS = 1;
