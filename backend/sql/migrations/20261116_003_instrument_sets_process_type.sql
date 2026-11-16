-- =============================================================================
-- CSSD SMART - MIGRATION SCRIPT: KATEGORI PROSES SET (SET STERIL VS SET DTT)
-- File    : 20261116_003_instrument_sets_process_type.sql
-- Support : MySQL 5.7+, MySQL 8.0+, MariaDB 10.x+
-- Fitur   : Idempotent (Aman dieksekusi berulang kali)
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Helper Stored Procedure: Tambah kolom hanya jika belum ada di tabel
DROP PROCEDURE IF EXISTS `AddColSafeSetProcess`;
DELIMITER $$
CREATE PROCEDURE `AddColSafeSetProcess`(
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

-- 2. Tambah kolom process_type pada instrument_sets
CALL AddColSafeSetProcess('instrument_sets', 'process_type', "ENUM('Steril', 'DTT') NOT NULL DEFAULT 'Steril' AFTER `name`");

DROP PROCEDURE IF EXISTS `AddColSafeSetProcess`;

-- 3. Update otomatis set instrumen yang namanya mengandung kata 'DTT'
UPDATE `instrument_sets` 
SET `process_type` = 'DTT' 
WHERE `name` LIKE '%DTT%' OR `code` LIKE '%DTT%';

-- 4. Sinkronkan kategori ke tabel items untuk set DTT
UPDATE `items` 
SET `process_type` = 'DTT' 
WHERE `name` LIKE '%DTT%' OR `code` LIKE '%DTT%' OR `name` LIKE '%SIRKUIT%';

SET FOREIGN_KEY_CHECKS = 1;
